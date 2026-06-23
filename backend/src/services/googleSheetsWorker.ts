import { PrismaClient } from "@prisma/client";
import { getGoogleClients, initializeYearlySheets } from "./googleSheets.service.js";

const prisma = new PrismaClient();
let isRunning = false;

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Main worker loop invoked by the Scheduler
 */
export async function processGoogleSheetSyncQueue() {
  if (isRunning) return;
  
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return; // Silently ignore if Google credentials aren't configured
  }

  isRunning = true;
  try {
    const pendingTasks = await prisma.googleSheetSyncQueue.findMany({
      where: { status: "PENDING" },
      take: 20, // Batch limit to prevent API quotas
      orderBy: { createdAt: "asc" }
    });

    if (pendingTasks.length === 0) {
      isRunning = false;
      return;
    }

    console.log(`[GoogleSheetsWorker] Processing ${pendingTasks.length} pending sync tasks...`);

    const year = new Date().getFullYear();
    const config = await initializeYearlySheets(year);
    const { sheetsClient } = await getGoogleClients();

    for (const task of pendingTasks) {
      try {
        if (task.entityType === "ATTENDANCE") {
          await syncAttendanceToSheets(task.entityId, config, sheetsClient);
        }
        
        await prisma.googleSheetSyncQueue.update({
          where: { id: task.id },
          data: { status: "COMPLETED", lastError: null }
        });
      } catch (err: any) {
        console.error(`[GoogleSheetsWorker] Task ${task.id} failed:`, err.message);
        const retryCount = task.retryCount + 1;
        await prisma.googleSheetSyncQueue.update({
          where: { id: task.id },
          data: { 
            status: retryCount >= 3 ? "FAILED" : "PENDING",
            retryCount,
            lastError: err.message
          }
        });
      }
    }
  } catch (err) {
    console.error("[GoogleSheetsWorker] Global error:", err);
  } finally {
    isRunning = false;
  }
}

/**
 * Handles logic to sync both Workbooks for a specific attendance record
 */
async function syncAttendanceToSheets(attendanceId: number, config: any, sheetsClient: any) {
  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    include: { employee: { include: { department: true, manager: true } } }
  });

  if (!attendance) throw new Error(`Attendance record ${attendanceId} not found in DB`);

  const emp = attendance.employee;
  
  // 1. Sync to Employee_Attendance_YYYY
  await syncEmployeeAttendanceTab(attendance, emp, config.attendanceId, sheetsClient);
  
  // 2. Sync to Daily_Work_Updates_YYYY
  if (attendance.todaysUpdate && attendance.todaysUpdate.trim().length > 0) {
    await appendDailyWorkUpdate(attendance, emp, config.updatesId, sheetsClient);
  }
}

/**
 * Updates the specific row in the individual employee's tab
 */
async function syncEmployeeAttendanceTab(attendance: any, emp: any, spreadsheetId: string, sheetsClient: any) {
  const sheetName = `${emp.firstName}_${emp.lastName}`;
  const dateObj = new Date(attendance.attendanceDate);
  
  // Calculate day of year to map directly to a row index (Row 1 = Header, Row 2 = Jan 1, etc.)
  const start = new Date(dateObj.getFullYear(), 0, 0);
  const diff = (dateObj.getTime() - start.getTime()) + ((start.getTimezoneOffset() - dateObj.getTimezoneOffset()) * 60 * 1000);
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  
  const rowIndex = dayOfYear + 1; // e.g. Jan 1 = Row 2

  // 1. Check if sheet exists, if not create it and add headers
  await ensureSheetExists(spreadsheetId, sheetsClient, sheetName, ["Date", "Check In", "Check Out", "Status", "Leave Type", "Work Hours (Mins)", "Late Penalty", "Notes"]);

  // 2. Prepare the row data
  const dateStr = dateObj.toISOString().split('T')[0];
  const checkInStr = attendance.checkInTime ? new Date(attendance.checkInTime).toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata" }) : "";
  const checkOutStr = attendance.checkOutTime ? new Date(attendance.checkOutTime).toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata" }) : "";
  const status = attendance.status;
  const leaveType = "N/A"; // Assuming we map this later if status is LEAVE
  const workMins = attendance.workedMinutes.toString();
  const penalty = attendance.penaltyMinutes > 0 ? `${attendance.penaltyMinutes} mins` : "";

  // 3. Upsert specific row using A1 notation
  const range = `${sheetName}!A${rowIndex}:H${rowIndex}`;
  
  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[dateStr, checkInStr, checkOutStr, status, leaveType, workMins, penalty, ""]]
    }
  });
}

/**
 * Appends the work update to the Monthly tab
 */
async function appendDailyWorkUpdate(attendance: any, emp: any, spreadsheetId: string, sheetsClient: any) {
  const dateObj = new Date(attendance.attendanceDate);
  const sheetName = `${MONTH_NAMES[dateObj.getMonth()]}-${dateObj.getFullYear()}`;
  
  // 1. Check if sheet exists, if not create it
  await ensureSheetExists(spreadsheetId, sheetsClient, sheetName, ["Date", "Employee ID", "Employee Name", "Department", "Reporting Manager", "Today's Work Update"]);

  const dateStr = dateObj.toISOString().split('T')[0];
  const empName = `${emp.firstName} ${emp.lastName}`;
  const deptName = emp.department?.name || "N/A";
  const managerName = emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : "None";
  
  // 2. Append row
  const range = `${sheetName}!A:F`;
  await sheetsClient.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[dateStr, emp.employeeCode, empName, deptName, managerName, attendance.todaysUpdate]]
    }
  });
}

/**
 * Helper to dynamically create a sheet tab if it doesn't exist
 */
async function ensureSheetExists(spreadsheetId: string, sheetsClient: any, title: string, headers: string[]) {
  const meta = await sheetsClient.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets.some((s: any) => s.properties.title === title);

  if (!exists) {
    console.log(`[GoogleSheetsWorker] Creating missing tab '${title}'...`);
    const addRes = await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: { properties: { title } }
          }
        ]
      }
    });

    const newSheetId = addRes.data?.replies?.[0]?.addSheet?.properties?.sheetId;

    // Write Headers to Row 1
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A1:${String.fromCharCode(64 + headers.length)}1`, // e.g. A1:F1
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [headers] }
    });
    
    // Bold the headers
    if (newSheetId !== undefined) {
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: newSheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                },
                cell: { userEnteredFormat: { textFormat: { bold: true } } },
                fields: "userEnteredFormat.textFormat.bold"
              }
            }
          ]
        }
      }).catch(() => console.log("Failed to bold headers, skipping."));
    }
  }
}
