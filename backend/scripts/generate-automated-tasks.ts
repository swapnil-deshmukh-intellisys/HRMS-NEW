import XLSX from 'xlsx-js-style';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const outputPath = path.join(rootDir, 'HRMS_Automated_Tasks_List.xlsx');

const HEADER_STYLE = {
  fill: { fgColor: { rgb: '1B5E20' } }, // Green theme for automated tasks
  font: { name: 'Segoe UI', bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: { bottom: { style: 'medium', color: { rgb: 'A5D6A7' } } }
};

const TASK_ROW_STYLE = {
  fill: { fgColor: { rgb: 'F1F8E9' } },
  font: { name: 'Segoe UI', sz: 9 },
  alignment: { wrapText: true, vertical: 'top' },
  border: { bottom: { style: 'thin', color: { rgb: 'DCEDC8' } } }
};

// ─── Only AUTOMATED Test Cases ──────────────────────────────────────────────
const AUTOMATED_TCS = [
  // Auth
  { id: 'TC-AUTH-001', module: 'Authentication', feature: 'Valid Login (Employee)', steps: 'Log in using testuser@intellisys.com / Test@1234.' },
  { id: 'TC-AUTH-002', module: 'Authentication', feature: 'Invalid Password', steps: 'Log in with valid email but wrong password.' },
  { id: 'TC-AUTH-003', module: 'Authentication', feature: 'Empty Email', steps: 'Try login leaving the Email field empty.' },
  { id: 'TC-AUTH-004', module: 'Authentication', feature: 'Empty Password', steps: 'Try login leaving the Password field empty.' },
  { id: 'TC-AUTH-005', module: 'Authentication', feature: 'Invalid Email Format', steps: 'Try login with badly formatted email e.g. "invalidemail".' },
  { id: 'TC-AUTH-006', module: 'Authentication', feature: 'Non-existent User', steps: 'Try login with email not registered.' },
  { id: 'TC-AUTH-007', module: 'Authentication', feature: 'Session Persistence', steps: 'Log in and refresh browser. Should stay logged in.' },
  { id: 'TC-AUTH-008', module: 'Authentication', feature: 'Login as ADMIN', steps: 'Log in with Admin credentials and check full menu access.' },
  { id: 'TC-AUTH-009', module: 'Authentication', feature: 'Login as HR', steps: 'Log in as HR and check payroll/leave menu permissions.' },
  { id: 'TC-AUTH-010', module: 'Authentication', feature: 'Login as MANAGER', steps: 'Log in as Manager and check team task console access.' },
  { id: 'TC-AUTH-011', module: 'Authentication', feature: 'Login as EMPLOYEE', steps: 'Log in as employee. Confirm directory/payroll links are hidden.' },
  { id: 'TC-AUTH-012', module: 'Authentication', feature: 'Logout', steps: 'Click logout. Ensure redirected to login page and session cleared.' },
  { id: 'TC-AUTH-013', module: 'Authentication', feature: 'Protected Route Without Auth', steps: 'Access protected route directly without being logged in.' },
  { id: 'TC-AUTH-014', module: 'Authentication', feature: 'Session Timeout Warning', steps: 'Wait for session timeout warning banner to show.' },
  { id: 'TC-AUTH-015', module: 'Authentication', feature: 'Refresh Session', steps: 'Click continue session on warning banner.' },
  { id: 'TC-AUTH-016', module: 'Authentication', feature: 'Stale Token After Logout', steps: 'Log out and press back button. Ensure login screen is shown.' },

  // Dashboard
  { id: 'TC-DASH-001', module: 'Dashboard', feature: 'Dashboard Loads (Employee)', steps: 'Navigate to dashboard. Check widgets load correctly.' },
  { id: 'TC-DASH-002', module: 'Dashboard', feature: 'Check-In Quick Action', steps: 'Check-In button visible if not clocked in.' },
  { id: 'TC-DASH-003', module: 'Dashboard', feature: 'Attendance Stats', steps: 'Verify Present/Absent counts on dashboard match history.' },
  { id: 'TC-DASH-004', module: 'Dashboard', feature: 'Leave Balance Card', steps: 'Verify leave counts (CL, SL, EL) are shown.' },
  { id: 'TC-DASH-005', module: 'Dashboard', feature: 'Workday Timeline', steps: 'Verify check-in timeline updates on dashboard after clock-in.' },
  { id: 'TC-DASH-006', module: 'Dashboard', feature: 'Admin Dashboard', steps: 'Log in as Admin and check company metrics widgets.' },
  { id: 'TC-DASH-007', module: 'Dashboard', feature: 'All Nav Links Work', steps: 'Click all sidebar menu links. Verify no routing errors.' },
  { id: 'TC-DASH-008', module: 'Dashboard', feature: 'Analytics Page Loads', steps: 'Verify analytics page loads charts with data.' },

  // Attendance
  { id: 'TC-ATT-001', module: 'Attendance', feature: 'Check-In', steps: 'Go to Attendance page, click Check In. Timer starts.' },
  { id: 'TC-ATT-002', module: 'Attendance', feature: 'Duplicate Check-In Prevention', steps: 'Verify Check-In button is hidden after clock-in.' },
  { id: 'TC-ATT-003', module: 'Attendance', feature: 'Check-Out', steps: 'Click Check Out, confirm modal. Verify timer stops.' },
  { id: 'TC-ATT-004', module: 'Attendance', feature: 'Late Check-In Penalty', steps: 'Check in past shift grace time. Verify Late status.' },
  { id: 'TC-ATT-005', module: 'Attendance', feature: 'Early Checkout Warning', steps: 'Click Check Out before 9 hours. Verify warning popup.' },
  { id: 'TC-ATT-006', module: 'Attendance', feature: 'Checkout During Active Break', steps: 'Try checking out while on an active break.' },
  { id: 'TC-ATT-007', module: 'Attendance', feature: 'Start Morning Tea Break', steps: 'Start Morning Tea. Verify status changes to Away.' },
  { id: 'TC-ATT-008', module: 'Attendance', feature: 'End Break', steps: 'End break. Status returns to Active.' },
  { id: 'TC-ATT-009', module: 'Attendance', feature: 'Long Break Penalty', steps: 'End break after time limit. Check if penalty applied.' },
  { id: 'TC-ATT-010', module: 'Attendance', feature: 'Lunch Only for Morning Shift', steps: 'Check break options on morning shift. Confirm Dinner is absent.' },
  { id: 'TC-ATT-011', module: 'Attendance', feature: 'Dinner Only for Night Shift', steps: 'Check break options on night shift. Confirm Lunch is absent.' },
  { id: 'TC-ATT-012', module: 'Attendance', feature: 'Nested Break Prevention', steps: 'Verify break options are disabled while already on break.' },
  { id: 'TC-ATT-013', module: 'Attendance', feature: 'View Attendance History', steps: 'Check attendance history table populated.' },
  { id: 'TC-ATT-014', module: 'Attendance', feature: 'Month/Year Switcher', steps: 'Change month. Confirm table data updates.' },
  { id: 'TC-ATT-015', module: 'Attendance', feature: 'Saturday = Off Day', steps: 'Check Saturday row status is Off Day.' },
  { id: 'TC-ATT-016', module: 'Attendance', feature: 'Sunday = Off Day', steps: 'Check Sunday row status is Off Day.' },
  { id: 'TC-ATT-017', module: 'Attendance', feature: 'Working Saturday Display', steps: 'Check marked working Saturday status is Working Saturday.' },
  { id: 'TC-ATT-018', module: 'Attendance', feature: 'Holiday Display', steps: 'Check Maharashtra Day (May 1) status is Holiday.' },
  { id: 'TC-ATT-019', module: 'Attendance', feature: 'Future Day = Scheduled', steps: 'Check future dates do not show Absent.' },
  { id: 'TC-ATT-020', module: 'Attendance', feature: 'Summary Counts Accuracy', steps: 'Verify summary cards math matches table rows.' },
  { id: 'TC-ATT-021', module: 'Attendance', feature: 'Submit Regularization', steps: 'Request regularization for absent day.' },
  { id: 'TC-ATT-022', module: 'Attendance', feature: 'Approve Regularization', steps: 'Approve regularization as Admin/HR. Check day updates to Present.' },
  { id: 'TC-ATT-023', module: 'Attendance', feature: 'Reject Regularization', steps: 'Reject regularization request. Check day remains Absent.' },
  { id: 'TC-ATT-024', module: 'Attendance', feature: 'Empty Regularization Reason', steps: 'Try submitting regularization without reason.' },
  { id: 'TC-ATT-025', module: 'Attendance', feature: 'Submit OT Pre-Approval', steps: 'Request overtime before 5 PM.' },
  { id: 'TC-ATT-026', module: 'Attendance', feature: 'OT Request After 5 PM Cutoff', steps: 'Try overtime request after 5 PM.' },

  // Leaves
  { id: 'TC-LV-001', module: 'Leaves', feature: 'Apply Casual Leave', steps: 'Apply for CL with valid dates and reason.' },
  { id: 'TC-LV-002', module: 'Leaves', feature: 'Apply Leave No Balance', steps: 'Try applying for CL with 0 balance.' },
  { id: 'TC-LV-003', module: 'Leaves', feature: 'Weekend Exclusion from Leave', steps: 'Apply leave spanning weekends. Verify days count.' },
  { id: 'TC-LV-004', module: 'Leaves', feature: 'Holiday Exclusion from Leave', steps: 'Apply leave spanning public holiday. Verify days count.' },
  { id: 'TC-LV-005', module: 'Leaves', feature: 'Overlapping Leave', steps: 'Try applying leave on dates already approved.' },
  { id: 'TC-LV-006', module: 'Leaves', feature: 'Empty Leave Reason', steps: 'Try applying leave without reason.' },
  { id: 'TC-LV-007', module: 'Leaves', feature: 'End Date Before Start Date', steps: 'Try applying leave with invalid date order.' },
  { id: 'TC-LV-008', module: 'Leaves', feature: 'Half-Day Leave', steps: 'Apply half day leave. Verify count is 0.5.' },
  { id: 'TC-LV-009', module: 'Leaves', feature: 'Approve Leave', steps: 'Approve leave request. Verify balance decreases.' },
  { id: 'TC-LV-010', module: 'Leaves', feature: 'Reject Leave', steps: 'Reject leave request. Verify balance unchanged.' },
  { id: 'TC-LV-011', module: 'Leaves', feature: 'Employee Cannot Approve Leave', steps: 'Verify no approval options visible to employee.' },
  { id: 'TC-LV-012', module: 'Leaves', feature: 'Cancel Pending Leave', steps: 'Cancel pending leave. Verify request removed.' },
  { id: 'TC-LV-013', module: 'Leaves', feature: 'Balance Deduction on Approval', steps: 'Verify balance decreases on approval.' },
  { id: 'TC-LV-014', module: 'Leaves', feature: 'Balance Unchanged on Rejection', steps: 'Verify balance remains same on rejection.' },
  { id: 'TC-LV-015', module: 'Leaves', feature: 'Leave History Filter', steps: 'Filter leave requests by status.' },

  // Employees
  { id: 'TC-EMP-001', module: 'Employees', feature: 'View Employee Directory', steps: 'Verify employee list loading for Admin/HR.' },
  { id: 'TC-EMP-002', module: 'Employees', feature: 'Search by Name', steps: 'Search employee by name.' },
  { id: 'TC-EMP-003', module: 'Employees', feature: 'Filter by Department', steps: 'Filter employees list by department.' },
  { id: 'TC-EMP-004', module: 'Employees', feature: 'EMPLOYEE Cannot Access Directory', steps: 'Verify regular employee cannot see list.' },
  { id: 'TC-EMP-005', module: 'Employees', feature: 'View Own Profile', steps: 'Verify profile details load correctly.' },
  { id: 'TC-EMP-006', module: 'Employees', feature: 'Attendance Tab Month Switch', steps: 'Change month inside profile attendance tab.' },
  { id: 'TC-EMP-007', module: 'Employees', feature: 'Edit Employee', steps: 'Edit employee details as Admin.' },
  { id: 'TC-EMP-008', module: 'Employees', feature: 'Edit Required Field Blank', steps: 'Try saving employee edit with blank first name.' },
  { id: 'TC-EMP-009', module: 'Employees', feature: 'Avatar Upload (Valid)', steps: 'Upload JPG/PNG profile photo.' },
  { id: 'TC-EMP-010', module: 'Employees', feature: 'Avatar Upload (Invalid Type)', steps: 'Try uploading non-image avatar file.' },
  { id: 'TC-EMP-011', module: 'Employees', feature: 'Deactivate Employee', steps: 'Deactivate employee account. Verify login blocked.' },
  { id: 'TC-EMP-012', module: 'Employees', feature: 'Create Employee', steps: 'Create new employee profile.' },
  { id: 'TC-EMP-013', module: 'Employees', feature: 'Duplicate Email on Create', steps: 'Try creating employee with existing email.' },
  { id: 'TC-EMP-014', module: 'Employees', feature: 'Missing Required Fields on Create', steps: 'Try creating employee with blank required fields.' },

  // Payroll
  { id: 'TC-PAY-001', module: 'Payroll', feature: 'View Payroll Page', steps: 'Verify payroll logs visible to Admin/HR.' },
  { id: 'TC-PAY-002', module: 'Payroll', feature: 'Generate Payroll', steps: 'Generate payroll for current month.' },
  { id: 'TC-PAY-003', module: 'Payroll', feature: 'View Draft Details', steps: 'Check breakdown calculations on draft payslip.' },
  { id: 'TC-PAY-004', module: 'Payroll', feature: 'Publish Payroll', steps: 'Publish draft payroll record.' },
  { id: 'TC-PAY-005', module: 'Payroll', feature: 'Employee Views Own Payslip', steps: 'Log in as employee, check published payslip.' },
  { id: 'TC-PAY-006', module: 'Payroll', feature: 'Employee Cannot See Draft', steps: 'Confirm draft payroll is invisible to employee.' },
  { id: 'TC-PAY-007', module: 'Payroll', feature: 'LOP Deduction', steps: 'Verify salary deduction math for absent days.' },
  { id: 'TC-PAY-008', module: 'Payroll', feature: 'Add Incentive', steps: 'Add incentive. Verify included in payslip.' },

  // Shifts
  { id: 'TC-SH-001', module: 'Shifts', feature: 'View Shifts Page', steps: 'Verify shifts details loading for Admin.' },
  { id: 'TC-SH-002', module: 'Shifts', feature: 'EMPLOYEE Cannot Access Shifts', steps: 'Confirm shifts route blocked for regular employee.' },
  { id: 'TC-SH-003', module: 'Shifts', feature: 'Create New Shift', steps: 'Create shift with custom start/end times.' },
  { id: 'TC-SH-004', module: 'Shifts', feature: 'Edit Shift', steps: 'Edit shift times.' },
  { id: 'TC-SH-005', module: 'Shifts', feature: 'Break Config - Disable All', steps: 'Disable breaks option. Verify break start disabled.' },
  { id: 'TC-SH-006', module: 'Shifts', feature: 'Custom Break Timing', steps: 'Set specific Morning Tea times.' },
  { id: 'TC-SH-007', module: 'Shifts', feature: 'Lunch Only for Morning Shift', steps: 'Confirm Lunch options for morning shifts.' },
  { id: 'TC-SH-008', module: 'Shifts', feature: 'Dinner Only for Night Shift', steps: 'Confirm Dinner options for night shifts.' },
  { id: 'TC-SH-009', module: 'Shifts', feature: 'Assign Shift to Employee', steps: 'Assign shift to employee. Verify clocking rules update.' },

  // Calendar
  { id: 'TC-CAL-001', module: 'Calendar', feature: 'View Calendar', steps: 'Verify calendar renders correctly.' },
  { id: 'TC-CAL-002', module: 'Calendar', feature: 'Holidays Shown', steps: 'Check holiday highlight on calendar.' },
  { id: 'TC-CAL-003', module: 'Calendar', feature: 'Working Saturdays Shown', steps: 'Check working Saturday highlight on calendar.' },
  { id: 'TC-CAL-004', module: 'Calendar', feature: 'Add Working Saturday', steps: 'Mark Saturday working. Verify highlight.' },
  { id: 'TC-CAL-005', module: 'Calendar', feature: 'Add Holiday', steps: 'Create public holiday exception.' },
  { id: 'TC-CAL-006', module: 'Calendar', feature: 'Employee Cannot Edit Calendar', steps: 'Verify edit option blocked for regular employee.' },
  { id: 'TC-CAL-007', module: 'Calendar', feature: 'Navigate Months', steps: 'Click next/prev month. Verify exceptions refresh.' },

  // RBAC
  { id: 'TC-RBAC-001', module: 'RBAC', feature: 'EMPLOYEE No Shifts Access', steps: 'Attempt navigating to /shifts as employee.' },
  { id: 'TC-RBAC-002', module: 'RBAC', feature: 'EMPLOYEE No Payroll Management', steps: 'Attempt managing payroll as employee.' },
  { id: 'TC-RBAC-003', module: 'RBAC', feature: 'HR Can Approve Leaves', steps: 'Approve leave request as HR.' },
  { id: 'TC-RBAC-004', module: 'RBAC', feature: 'ADMIN Full Access', steps: 'Access all sections as Admin.' },
  { id: 'TC-RBAC-005', module: 'RBAC', feature: 'EMPLOYEE Cannot Edit Other Profile', steps: 'Attempt editing teammate profile as employee.' },
  { id: 'TC-RBAC-006', module: 'RBAC', feature: 'API Without Token', steps: 'Attempt backend API call without authorization token.' },
  { id: 'TC-RBAC-007', module: 'RBAC', feature: 'EMPLOYEE Token on Admin API', steps: 'Attempt calling Admin delete API with employee token.' },

  // UI/UX & Security
  { id: 'TC-UI-002', module: 'UI/UX', feature: 'Loading States', steps: 'Navigate pages under throttled network.' },
  { id: 'TC-UI-004', module: 'UI/UX', feature: 'Toast Notifications', steps: 'Verify notification alert auto-dismisses.' },
  { id: 'TC-UI-005', module: 'UI/UX', feature: 'Confirmation Dialog on Delete', steps: 'Verify popup blocker on deleting item.' },
  { id: 'TC-UI-006', module: 'UI/UX', feature: 'Empty State Messages', steps: 'Open empty list. Verify placeholder text.' },
  { id: 'TC-UI-007', module: 'UI/UX', feature: 'Form Reset on Cancel', steps: 'Cancel edits. Verify fields return to normal.' },
  { id: 'TC-DATA-001', module: 'Security', feature: 'IST Timezone Accuracy', steps: 'Verify timestamp timezone matches IST.' },
  { id: 'TC-DATA-002', module: 'Security', feature: 'XSS Prevention', steps: 'Input script tag. Verify escaped.' },
  { id: 'TC-DATA-003', module: 'Security', feature: 'SQL Injection Prevention', steps: 'Input database query string in search.' },
  { id: 'TC-DATA-004', module: 'Security', feature: 'Concurrent Check-In Prevention', steps: 'Try clocking in from 2 tabs simultaneously.' },
  { id: 'TC-DATA-005', module: 'Security', feature: 'Balance Restored on Cancellation', steps: 'Cancel approved leave. Check balance.' },
  { id: 'TC-DATA-006', module: 'Security', feature: 'Long Text Input', steps: 'Input 1000+ character string in text field.' },
];

const ws: any = {};
const headers = ['TC-ID', 'Module', 'Feature', 'Steps to Execute', 'Status', 'Date Run', 'Remarks'];

// Header Styles
headers.forEach((h, i) => {
  const cell = XLSX.utils.encode_cell({ r: 0, c: i });
  ws[cell] = { v: h, t: 's', s: HEADER_STYLE };
});

// Row Styles
AUTOMATED_TCS.forEach((tc, ri) => {
  const row = ri + 1;
  const values = [tc.id, tc.module, tc.feature, tc.steps, 'PENDING', '', ''];
  values.forEach((v, ci) => {
    const cell = XLSX.utils.encode_cell({ r: row, c: ci });
    ws[cell] = {
      v: v,
      t: 's',
      s: TASK_ROW_STYLE
    };
  });
});

ws['!cols'] = [
  { wch: 15 }, // TC-ID
  { wch: 18 }, // Module
  { wch: 30 }, // Feature
  { wch: 65 }, // Steps
  { wch: 15 }, // Status
  { wch: 15 }, // Date Run
  { wch: 30 }, // Remarks
];

ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: AUTOMATED_TCS.length, c: headers.length - 1 } });
ws['!rows'] = [{ hpt: 30 }, ...AUTOMATED_TCS.map(() => ({ hpt: 35 }))];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Automated Tasks List');
XLSX.writeFile(wb, outputPath);

console.log(`\n✅ Generated automated tasks sheet: ${outputPath}`);
