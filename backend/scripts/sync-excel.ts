import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx-js-style";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

const projectMemoryPath = path.join(rootDir, "project-memory.json");
const modulesPath = path.join(rootDir, "modules.json");
const tasksPath = path.join(rootDir, "tasks.json");
const dailyLogPath = path.join(rootDir, "daily-log.json");
const dailyStatusFeedPath = path.join(rootDir, "daily-status-feed.json");
const workContextPath = path.join(rootDir, "work-context.json");
const excelOutputPath = path.join(rootDir, "HRMS_Project_Management.xlsx");

function loadJSON(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content);
}

async function run() {
  console.log("Loading project memory JSON databases...");
  const projectMemory = loadJSON(projectMemoryPath);
  const modules = loadJSON(modulesPath) || [];
  const tasks = loadJSON(tasksPath) || [];
  const dailyLog = loadJSON(dailyLogPath) || [];
  const dailyStatusFeed = loadJSON(dailyStatusFeedPath) || [];
  const workContext = loadJSON(workContextPath);

  if (!projectMemory) {
    console.error("Error: project-memory.json not found!");
    return;
  }

  console.log("Compiling Sheets data...");
  const wb = XLSX.utils.book_new();

  // Helper function to append a sheet to workbook
  const appendSheet = (data: any[], name: string) => {
    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-fit column widths based on cell text content length
    if (data.length > 0) {
      const colWidths = Object.keys(data[0]).map(key => {
        let maxLen = key.length;
        for (const row of data) {
          const val = row[key] !== null && row[key] !== undefined ? row[key].toString() : "";
          if (val.length > maxLen) {
            maxLen = val.length;
          }
        }
        return { wch: Math.min(65, Math.max(12, maxLen + 3)) };
      });
      ws['!cols'] = colWidths;
    }

    // Set row height for headers
    ws['!rows'] = [{ hpt: 26 }];

    // Format header cells
    const range = XLSX.utils.decode_range(ws['!ref'] || "A1:A1");
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          fill: {
            fgColor: { rgb: "0984E3" } // Cobalt Blue
          },
          font: {
            name: "Segoe UI",
            bold: true,
            color: { rgb: "FFFFFF" },
            sz: 11
          },
          alignment: {
            horizontal: "center",
            vertical: "center",
            wrapText: true
          }
        };
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  // ----------------------------------------------------
  // Sheet 1: Standup_Feed (FIRST TAB)
  // ----------------------------------------------------
  const standupFeedData = dailyStatusFeed.map((item: any) => ({
    "Date": item.date,
    "Task ID": item.taskId,
    "Feature Title": item.title,
    "Status": item.status,
    "Development Narrative": item.narrative,
    "Standup Copy-Paste Text": `* [${item.status}] ${item.taskId} (${item.title}): ${item.narrative}`
  }));
  appendSheet(standupFeedData, "Standup_Feed");

  // ----------------------------------------------------
  // Sheet 2: Projects_Master
  // ----------------------------------------------------
  const projectsMasterData = [
    {
      "Project Name": projectMemory.projectName,
      "Owner": projectMemory.owner,
      "Start Date": projectMemory.startDate,
      "Target Date": projectMemory.targetDate,
      "Current Sprint": projectMemory.currentSprint,
      "Overall Progress %": `${projectMemory.overallProgress}%`,
      "Frontend %": `${projectMemory.frontendProgress}%`,
      "Backend %": `${projectMemory.backendProgress}%`,
      "Database %": `${projectMemory.databaseProgress}%`,
      "Testing %": `${projectMemory.testingProgress}%`,
      "Deployment %": `${projectMemory.deploymentProgress}%`,
      "Current Status": "IN_PROGRESS",
      "Health Status": projectMemory.healthStatus,
      "Expected Completion": "2026-07-15"
    }
  ];
  appendSheet(projectsMasterData, "Projects_Master");

  // ----------------------------------------------------
  // Sheet 2: Daily_Updates
  // ----------------------------------------------------
  const dailyUpdatesData: any[] = [];
  dailyLog.forEach((log: any) => {
    const combinedTasks = [
      ...log.completedTasks.map((id: string) => ({ id, status: "COMPLETED", comp: "100%" })),
      ...log.inProgressTasks.map((id: string) => ({ id, status: "IN_PROGRESS", comp: "50%" }))
    ];

    if (combinedTasks.length === 0) {
      dailyUpdatesData.push({
        "Date": log.date,
        "Developer": log.developer,
        "Project": "HRMS",
        "Sprint": projectMemory.currentSprint,
        "Page": "N/A",
        "Module": "N/A",
        "Submodule": "N/A",
        "Task ID": "N/A",
        "Task Description": "General maintenance / meetings",
        "Frontend Status": "N/A",
        "Backend Status": "N/A",
        "Database Status": "N/A",
        "API Status": "N/A",
        "Testing Status": "N/A",
        "Priority": "N/A",
        "Estimated Hours": 0,
        "Actual Hours": log.hoursWorked,
        "Completion %": "N/A",
        "Current Status": "COMPLETED",
        "Blockers": log.blockers.join(", ") || "None",
        "Start Date": log.date,
        "Target Date": log.date,
        "Remarks": log.remarks
      });
    } else {
      combinedTasks.forEach((tRef: any) => {
        const tInfo = tasks.find((t: any) => t.taskId === tRef.id);
        dailyUpdatesData.push({
          "Date": log.date,
          "Developer": log.developer,
          "Project": tInfo ? tInfo.project : "HRMS",
          "Sprint": tInfo ? tInfo.sprint : projectMemory.currentSprint,
          "Page": tInfo ? tInfo.page : "N/A",
          "Module": tInfo ? tInfo.module : "N/A",
          "Submodule": tInfo ? tInfo.submodule : "N/A",
          "Task ID": tRef.id,
          "Task Description": tInfo ? tInfo.title : "Work on task",
          "Frontend Status": tInfo ? (tInfo.frontendWork !== "None" ? tRef.status : "N/A") : "N/A",
          "Backend Status": tInfo ? (tInfo.backendWork !== "None" ? tRef.status : "N/A") : "N/A",
          "Database Status": tInfo ? (tInfo.databaseWork !== "None" ? tRef.status : "N/A") : "N/A",
          "API Status": tInfo ? (tInfo.apiWork !== "None" ? tRef.status : "N/A") : "N/A",
          "Testing Status": tInfo ? (tInfo.testingWork !== "None" ? tRef.status : "N/A") : "N/A",
          "Priority": tInfo ? tInfo.priority : "MEDIUM",
          "Estimated Hours": tInfo ? tInfo.estimatedHours : 0,
          "Actual Hours": log.hoursWorked / combinedTasks.length, // split day's hours equally among active tasks
          "Completion %": tInfo ? `${tInfo.completionPercentage}%` : tRef.comp,
          "Current Status": tInfo ? tInfo.status : tRef.status,
          "Blockers": log.blockers.join(", ") || "None",
          "Start Date": tInfo ? tInfo.createdAt.split("T")[0] : log.date,
          "Target Date": tInfo ? tInfo.updatedAt.split("T")[0] : log.date,
          "Remarks": log.remarks
        });
      });
    }
  });
  appendSheet(dailyUpdatesData, "Daily_Updates");

  // ----------------------------------------------------
  // Sheet 3: Daily_Task_Planner
  // ----------------------------------------------------
  const dailyTaskPlannerData: any[] = [];
  if (workContext) {
    const allContextTasks = [
      ...workContext["today'sTasks"].map((id: string) => ({ id, cat: "Today's Task" })),
      ...workContext.tomorrowTasks.map((id: string) => ({ id, cat: "Tomorrow Task" })),
      ...workContext.nextWeekTasks.map((id: string) => ({ id, cat: "Next Week Task" }))
    ];

    allContextTasks.forEach((ref: any) => {
      const tInfo = tasks.find((t: any) => t.taskId === ref.id);
      dailyTaskPlannerData.push({
        "Task ID": ref.id,
        "Today's Tasks": ref.cat === "Today's Task" ? (tInfo ? tInfo.title : "Active Task") : "",
        "Tomorrow Tasks": ref.cat === "Tomorrow Task" ? (tInfo ? tInfo.title : "Upcoming Task") : "",
        "Day After Tomorrow Tasks": ref.cat === "Next Week Task" ? (tInfo ? tInfo.title : "Planned Task") : "",
        "Estimated Hours": tInfo ? tInfo.estimatedHours : 0,
        "Priority": tInfo ? tInfo.priority : "MEDIUM",
        "Dependencies": tInfo ? (tInfo.dependencies.join(", ") || "None") : "None",
        "Status": tInfo ? tInfo.status : "IN_PROGRESS"
      });
    });
  }
  appendSheet(dailyTaskPlannerData, "Daily_Task_Planner");

  // ----------------------------------------------------
  // Sheet 4: Weekly_Roadmap
  // ----------------------------------------------------
  const weeklyRoadmapData = [
    {
      "Week Number": "Week 8 (Current)",
      "Feature": "Microsoft Teams & Calendar Sync & Performance",
      "Page": "Dashboard / Payroll",
      "Module": "MOD-GOOGLE / MOD-PAYROLL",
      "Owner": "Integrations & FE Teams",
      "Planned Hours": 40,
      "Actual Hours": 31,
      "Dependencies": "TSK-GOOG-001, TSK-PAY-003",
      "Target Date": "2026-06-26",
      "Completion %": "82%",
      "Status": "IN_PROGRESS",
      "Remarks": "Pivoted chat alerts successfully to Microsoft Teams webhook."
    },
    {
      "Week Number": "Week 9 (Next)",
      "Feature": "Quality Assurance & Regression Testing",
      "Page": "All Pages",
      "Module": "All Modules",
      "Owner": "Priya (QA)",
      "Planned Hours": 32,
      "Actual Hours": 0,
      "Dependencies": "Sprint 4 Completion",
      "Target Date": "2026-07-03",
      "Completion %": "0%",
      "Status": "PLANNED",
      "Remarks": "Full automated regression tests and security verification."
    },
    {
      "Week Number": "Week 10",
      "Feature": "Production Launch & VPS Deploy",
      "Page": "Deployment",
      "Module": "Operations",
      "Owner": "DevOps Team",
      "Planned Hours": 20,
      "Actual Hours": 0,
      "Dependencies": "TSK-QA-001",
      "Target Date": "2026-07-10",
      "Completion %": "0%",
      "Status": "PLANNED",
      "Remarks": "Setup Docker containers on VPS, replicate PG tables."
    }
  ];
  appendSheet(weeklyRoadmapData, "Weekly_Roadmap");

  // ----------------------------------------------------
  // Sheet 5: Sprint_Tracker
  // ----------------------------------------------------
  const sprintTrackerData = [
    {
      "Sprint": "Sprint 1",
      "Features": "Base DB Schema, Auth APIs, Employee CRUD",
      "Completed": 4,
      "In Progress": 0,
      "Pending": 0,
      "Bugs": 0,
      "Testing Status": "100% Passed",
      "Release Readiness": "100%",
      "Health Status": "HEALTHY"
    },
    {
      "Sprint": "Sprint 2",
      "Features": "Token Rotation, Profile tabs details, Clocking workflows",
      "Completed": 3,
      "In Progress": 0,
      "Pending": 0,
      "Bugs": 0,
      "Testing Status": "100% Passed",
      "Release Readiness": "100%",
      "Health Status": "HEALTHY"
    },
    {
      "Sprint": "Sprint 3",
      "Features": "Regularization, Leave balances & approvals, Payroll Drafts",
      "Completed": 4,
      "In Progress": 0,
      "Pending": 0,
      "Bugs": 0,
      "Testing Status": "100% Passed",
      "Release Readiness": "100%",
      "Health Status": "HEALTHY"
    },
    {
      "Sprint": "Sprint 4",
      "Features": "Google OAuth, Calendar Sync, Teams Webhook, Payroll Lock",
      "Completed": 3,
      "In Progress": 3,
      "Pending": 1,
      "Bugs": 0,
      "Testing Status": "88% Passed",
      "Release Readiness": "85%",
      "Health Status": "HEALTHY"
    }
  ];
  appendSheet(sprintTrackerData, "Sprint_Tracker");

  // ----------------------------------------------------
  // Sheet 6: Feature_Tracker
  // ----------------------------------------------------
  const featureTrackerData = modules.map((m: any) => {
    let overallStatus = "COMPLETED";
    if (m.completionPercentage < 100) {
      overallStatus = m.status;
    }
    return {
      "Feature": m.moduleName,
      "Frontend": m.completionPercentage >= 95 ? "Completed" : "In Progress",
      "Backend": m.completionPercentage >= 95 ? "Completed" : "In Progress",
      "Database": "Completed",
      "API": m.completionPercentage >= 95 ? "Completed" : "In Progress",
      "Testing": m.completionPercentage >= 90 ? "Completed" : "In Progress",
      "Deployment": "Completed",
      "Overall Status": overallStatus,
      "Completion %": `${m.completionPercentage}%`
    };
  });
  appendSheet(featureTrackerData, "Feature_Tracker");

  // ----------------------------------------------------
  // Sheet 7: Frontend_Tracker
  // ----------------------------------------------------
  const frontendTrackerData = [
    { "Page": "LoginPage", "Module": "MOD-AUTH", "Components": "LoginForm, PasswordResetModal", "Framework": "React + CSS", "Status": "Completed", "Completion %": "100%" },
    { "Page": "DashboardPage", "Module": "MOD-DASHBOARD", "Components": "EmployeeDashboard, ManagerDashboard, MetricsCard", "Framework": "React + CSS", "Status": "Completed", "Completion %": "95%" },
    { "Page": "EmployeesPage", "Module": "MOD-EMPLOYEE", "Components": "EmployeeTable, EmployeeForm, AvatarUploadModal", "Framework": "React + CSS", "Status": "Completed", "Completion %": "100%" },
    { "Page": "AttendancePage", "Module": "MOD-ATTENDANCE", "Components": "ClockToggle, BreakTimer, HistoryGrid", "Framework": "React + CSS", "Status": "Completed", "Completion %": "100%" },
    { "Page": "LeavesPage", "Module": "MOD-LEAVE", "Components": "LeaveRequestForm, LeaveBalanceCards, ApprovalsTable", "Framework": "React + CSS", "Status": "Completed", "Completion %": "100%" },
    { "Page": "PayrollPage", "Module": "MOD-PAYROLL", "Components": "PayrollDetailsTable, OvertimeVerifier, IncentivesList", "Framework": "React + CSS", "Status": "In Progress", "Completion %": "80%" }
  ];
  appendSheet(frontendTrackerData, "Frontend_Tracker");

  // ----------------------------------------------------
  // Sheet 8: Backend_Tracker
  // ----------------------------------------------------
  const backendTrackerData = [
    { "Service": "auth-service", "Controller": "auth-controller", "Business Logic": "token-rotation, bcrypt", "Middleware": "rate-limiter", "Authentication": "JWT + Cookie", "Status": "Completed", "Completion %": "100%" },
    { "Service": "employee-service", "Controller": "employee-controller", "Business Logic": "capability-mapping", "Middleware": "validate-body", "Authentication": "JWT + RBAC", "Status": "Completed", "Completion %": "100%" },
    { "Service": "attendance-service", "Controller": "attendance-controller", "Business Logic": "work-hours, break-duration", "Middleware": "validate-body", "Authentication": "JWT + RBAC", "Status": "Completed", "Completion %": "100%" },
    { "Service": "leave-service", "Controller": "leave-controller", "Business Logic": "balance-check, overlap-check", "Middleware": "validate-body", "Authentication": "JWT + RBAC", "Status": "Completed", "Completion %": "100%" },
    { "Service": "payroll-service", "Controller": "payroll-controller", "Business Logic": "draft-generation, lock-check", "Middleware": "validate-body", "Authentication": "JWT + RBAC", "Status": "In Progress", "Completion %": "85%" },
    { "Service": "google-service", "Controller": "google-controller", "Business Logic": "calendar-sync, quick-meet", "Middleware": "oauth-handler", "Authentication": "JWT + Link", "Status": "In Progress", "Completion %": "85%" }
  ];
  appendSheet(backendTrackerData, "Backend_Tracker");

  // ----------------------------------------------------
  // Sheet 9: Database_Tracker
  // ----------------------------------------------------
  const databaseTrackerData = [
    { "Table": "User / Role", "Relationships": "Role 1:N User", "Indexes": "users.email (unique), users.roleId", "Migration": "Completed", "Seed Data": "Seeded", "Completion %": "100%" },
    { "Table": "Employee", "Relationships": "User 1:1 Employee", "Indexes": "employees.employeeCode (unique), employees.departmentId", "Migration": "Completed", "Seed Data": "Seeded", "Completion %": "100%" },
    { "Table": "Attendance", "Relationships": "Employee 1:N Attendance", "Indexes": "(employeeId, attendanceDate) unique", "Migration": "Completed", "Seed Data": "Seeded", "Completion %": "100%" },
    { "Table": "LeaveRequest", "Relationships": "Employee 1:N LeaveRequest", "Indexes": "leave_requests.employeeId, leave_requests.status", "Migration": "Completed", "Seed Data": "Seeded", "Completion %": "100%" },
    { "Table": "PayrollRecord", "Relationships": "Employee 1:N PayrollRecord", "Indexes": "(employeeId, month, year) unique", "Migration": "Completed", "Seed Data": "Seeded", "Completion %": "100%" },
    { "Table": "RefreshTokens", "Relationships": "User 1:N RefreshTokens", "Indexes": "refresh_tokens.userId", "Migration": "Completed", "Seed Data": "N/A", "Completion %": "100%" }
  ];
  appendSheet(databaseTrackerData, "Database_Tracker");

  // ----------------------------------------------------
  // Sheet 10: API_Tracker
  // ----------------------------------------------------
  const apiTrackerData = [
    { "API Name": "User Login", "Endpoint": "/api/auth/login", "Method": "POST", "Integrated": "YES", "Testing Status": "PASSED", "Completion %": "100%" },
    { "API Name": "Token Refresh", "Endpoint": "/api/auth/refresh", "Method": "POST", "Integrated": "YES", "Testing Status": "PASSED", "Completion %": "100%" },
    { "API Name": "Clock In", "Endpoint": "/api/attendance/check-in", "Method": "POST", "Integrated": "YES", "Testing Status": "PASSED", "Completion %": "100%" },
    { "API Name": "Apply Leave", "Endpoint": "/api/leaves", "Method": "POST", "Integrated": "YES", "Testing Status": "PASSED", "Completion %": "100%" },
    { "API Name": "Generate Payroll", "Endpoint": "/api/payroll/generate", "Method": "POST", "Integrated": "YES", "Testing Status": "PASSED", "Completion %": "100%" },
    { "API Name": "Lock Payroll", "Endpoint": "/api/payroll/:id/publish", "Method": "PUT", "Integrated": "NO", "Testing Status": "PENDING", "Completion %": "30%" },
    { "API Name": "Quick Meet", "Endpoint": "/api/google/quick-meet", "Method": "POST", "Integrated": "YES", "Testing Status": "PASSED", "Completion %": "100%" }
  ];
  appendSheet(apiTrackerData, "API_Tracker");

  // ----------------------------------------------------
  // Sheet 11: Bug_Tracker
  // ----------------------------------------------------
  const bugTrackerData = [
    { "Bug ID": "BUG-PAY-001", "Module": "MOD-PAYROLL", "Severity": "LOW", "Assigned To": "Amit (Backend)", "ETA": "2026-06-22", "Status": "FIXED" },
    { "Bug ID": "BUG-LV-002", "Module": "MOD-LEAVE", "Severity": "MEDIUM", "Assigned To": "Priya (QA)", "ETA": "2026-06-24", "Status": "FIXED" }
  ];
  appendSheet(bugTrackerData, "Bug_Tracker");

  // ----------------------------------------------------
  // Sheet 12: Testing_Tracker
  // ----------------------------------------------------
  const testingTrackerData = [
    { "Feature": "Auth / RBAC", "Unit Test": "Vitest (Passed)", "Integration Test": "Supertest (Passed)", "Manual Test": "Verified", "UAT": "Signed Off", "Status": "COMPLETED" },
    { "Feature": "Employee CRUD", "Unit Test": "Vitest (Passed)", "Integration Test": "Supertest (Passed)", "Manual Test": "Verified", "UAT": "Signed Off", "Status": "COMPLETED" },
    { "Feature": "Time Clocking", "Unit Test": "Vitest (Passed)", "Integration Test": "Supertest (Passed)", "Manual Test": "Verified", "UAT": "Signed Off", "Status": "COMPLETED" },
    { "Feature": "Leave Workflow", "Unit Test": "Vitest (Passed)", "Integration Test": "Supertest (Passed)", "Manual Test": "Verified", "UAT": "Signed Off", "Status": "COMPLETED" },
    { "Feature": "Payroll Drafts", "Unit Test": "Vitest (Passed)", "Integration Test": "Supertest (Passed)", "Manual Test": "Verified", "UAT": "Signed Off", "Status": "COMPLETED" },
    { "Feature": "Google Sync", "Unit Test": "Vitest (Passed)", "Integration Test": "Mock Sync (Passed)", "Manual Test": "Verified", "UAT": "Signed Off", "Status": "COMPLETED" }
  ];
  appendSheet(testingTrackerData, "Testing_Tracker");

  // ----------------------------------------------------
  // Sheet 13: Deployment_Tracker
  // ----------------------------------------------------
  const deploymentTrackerData = [
    { "Environment": "Staging (Render/Neon)", "Frontend Version": "2.0.0-rc1", "Backend Version": "2.0.0-rc1", "Database Version": "v2.0-migration-8", "Status": "HEALTHY" },
    { "Environment": "Production (VPS Target)", "Frontend Version": "Pending Release", "Backend Version": "Pending Release", "Database Version": "Pending Release", "Status": "PLANNED" }
  ];
  appendSheet(deploymentTrackerData, "Deployment_Tracker");

  // ----------------------------------------------------
  // Sheet 14: Risks_And_Blockers
  // ----------------------------------------------------
  const risksAndBlockersData = projectMemory.knownRisks.map((r: any) => ({
    "Risk Type": r.type,
    "Description": r.description,
    "Severity": r.severity,
    "Owner": r.owner,
    "Mitigation Plan": r.mitigationPlan,
    "Status": "ACTIVE"
  }));
  appendSheet(risksAndBlockersData, "Risks_And_Blockers");

  // ----------------------------------------------------
  // Sheet 15: Team_Productivity
  // ----------------------------------------------------
  const teamProductivityData = [
    { "Developer": "Rahul (FE)", "Tasks Completed": 8, "Hours Worked": 72, "Productivity Score": 9.5, "Remarks": "High quality CSS styling and responsive UI pages" },
    { "Developer": "Amit (BE)", "Tasks Completed": 9, "Hours Worked": 80, "Productivity Score": 9.8, "Remarks": "Extremely robust controllers, schemas and Prisma models" },
    { "Developer": "Priya (QA)", "Tasks Completed": 6, "Hours Worked": 48, "Productivity Score": 9.2, "Remarks": "Thorough test suites and Playwright setup" }
  ];
  appendSheet(teamProductivityData, "Team_Productivity");

  // (Standup_Feed is now Sheet 1 — see top of this function)

  console.log("Writing Excel workbook to file...");
  XLSX.writeFile(wb, excelOutputPath);
  console.log(`Excel workbook successfully generated at ${excelOutputPath}`);
}

run().catch(console.error);
