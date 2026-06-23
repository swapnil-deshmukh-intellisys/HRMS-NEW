import { google } from "googleapis";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

let sheetsClient: any = null;
let driveClient: any = null;

/**
 * Initializes and returns Google API clients using the service account credentials.
 */
export async function getGoogleClients() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS environment variable is not set. Background sync will not run.");
  }

  if (!sheetsClient || !driveClient) {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
      ],
    });
    
    const authClient = await auth.getClient();
    sheetsClient = google.sheets({ version: "v4", auth: authClient as any });
    driveClient = google.drive({ version: "v3", auth: authClient as any });
  }

  return { sheetsClient, driveClient };
}

/**
 * Checks if the Google Workbooks exist for the given year.
 * If not, it creates them via the Google Drive API and saves the IDs to the database.
 */
export async function initializeYearlySheets(year: number) {
  const { sheetsClient, driveClient } = await getGoogleClients();
  
  let config = await prisma.googleSheetConfig.findUnique({ where: { year } });
  
  if (!config) {
    config = await prisma.googleSheetConfig.create({
      data: { year }
    });
  }

  // 1. Initialize Employee Attendance Sheet
  if (!config.attendanceId) {
    console.log(`[GoogleSheets] Creating Employee_Attendance_${year} spreadsheet...`);
    const attendanceRes = await sheetsClient.spreadsheets.create({
      requestBody: {
        properties: { title: `Employee_Attendance_${year}` },
        sheets: [
          {
            properties: { title: "Index" }
          }
        ]
      }
    });

    const attendanceId = attendanceRes.data.spreadsheetId;

    // Automatically share it with the HR admin so they can view it
    if (process.env.HR_ADMIN_EMAIL) {
      await driveClient.permissions.create({
        fileId: attendanceId,
        requestBody: { type: "user", role: "writer", emailAddress: process.env.HR_ADMIN_EMAIL }
      });
    }

    config = await prisma.googleSheetConfig.update({
      where: { id: config.id },
      data: { attendanceId }
    });
  }

  // 2. Initialize Daily Work Updates Sheet
  if (!config.updatesId) {
    console.log(`[GoogleSheets] Creating Daily_Work_Updates_${year} spreadsheet...`);
    const updatesRes = await sheetsClient.spreadsheets.create({
      requestBody: {
        properties: { title: `Daily_Work_Updates_${year}` }
      }
    });

    const updatesId = updatesRes.data.spreadsheetId;

    if (process.env.HR_ADMIN_EMAIL) {
      await driveClient.permissions.create({
        fileId: updatesId,
        requestBody: { type: "user", role: "writer", emailAddress: process.env.HR_ADMIN_EMAIL }
      });
    }

    config = await prisma.googleSheetConfig.update({
      where: { id: config.id },
      data: { updatesId }
    });
  }

  return config;
}

/**
 * Helper to queue an attendance sync request.
 * Call this function whenever an attendance record is created or updated.
 */
export async function queueAttendanceSync(attendanceId: number) {
  await prisma.googleSheetSyncQueue.create({
    data: {
      entityType: "ATTENDANCE",
      entityId: attendanceId,
      action: "UPSERT"
    }
  });
}
