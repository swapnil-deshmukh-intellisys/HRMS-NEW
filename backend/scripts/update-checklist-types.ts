import XLSX from 'xlsx-js-style';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

// File paths
const checklistPath = path.join(rootDir, 'Manual_Testing_Checklist.xlsx');
const bugTrackerPath = path.join(rootDir, 'HRMS_Failed_Tests_And_Bugs.xlsx');

const HEADER_STYLE = {
  fill: { fgColor: { rgb: '1E3A5F' } },
  font: { name: 'Segoe UI', bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: { bottom: { style: 'medium', color: { rgb: '4FC3F7' } } }
};

const AUTOMATED_STYLE = { fill: { fgColor: { rgb: 'E8F5E9' } } }; // Light Green row
const MANUAL_STYLE = { fill: { fgColor: { rgb: 'FFF3E0' } } };    // Light Orange row

function makeSheet(testCases: any[]) {
  const headers = [
    'TC-ID', 'Module', 'Feature', 'Preconditions', 'Test Steps', 
    'Expected Result', 'Testing Type', 'Actual Result', 'Status', 
    'Priority', 'Severity', 'Bug ID', 'Remarks'
  ];
  const ws: any = {};

  // Headers
  headers.forEach((h, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i });
    ws[cell] = { v: h, t: 's', s: HEADER_STYLE };
  });

  // Data rows
  testCases.forEach((tc, ri) => {
    const row = ri + 1;
    const values = [
      tc.id, tc.module, tc.feature, tc.pre, tc.steps,
      tc.expected, tc.type, '', '', tc.priority, tc.severity, '', ''
    ];
    
    const bgStyle = tc.type === 'AUTOMATED' ? AUTOMATED_STYLE : MANUAL_STYLE;

    values.forEach((v, ci) => {
      const cell = XLSX.utils.encode_cell({ r: row, c: ci });
      ws[cell] = {
        v: v || '',
        t: 's',
        s: {
          ...bgStyle,
          font: { name: 'Segoe UI', sz: 9 },
          alignment: { wrapText: true, vertical: 'top' },
          border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } }
        }
      };
    });
  });

  ws['!cols'] = [
    { wch: 15 }, // TC-ID
    { wch: 15 }, // Module
    { wch: 25 }, // Feature
    { wch: 30 }, // Preconditions
    { wch: 55 }, // Steps
    { wch: 50 }, // Expected
    { wch: 15 }, // Testing Type
    { wch: 30 }, // Actual
    { wch: 10 }, // Status
    { wch: 12 }, // Priority
    { wch: 12 }, // Severity
    { wch: 12 }, // Bug ID
    { wch: 25 }, // Remarks
  ];

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: testCases.length, c: headers.length - 1 } });
  ws['!rows'] = [{ hpt: 30 }, ...testCases.map(() => ({ hpt: 55 }))];
  return ws;
}

// ─── Test Cases with automation type marked ──────────────────────────────────
const AUTH_TCS = [
  { id:'TC-AUTH-001', module:'Authentication', feature:'Valid Login (Employee)', pre:'App running, test user exists', steps:'1. Go to /login  2. Enter testuser@intellisys.com / Test@1234  3. Click Sign In', expected:'Redirect to Dashboard; Navbar shows user name', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-AUTH-002', module:'Authentication', feature:'Invalid Password', pre:'App running', steps:'1. Enter correct email  2. Enter wrong password  3. Click Sign In', expected:'Error toast: Invalid credentials', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-AUTH-003', module:'Authentication', feature:'Empty Email', pre:'Login page open', steps:'1. Leave email blank  2. Enter any password  3. Click Sign In', expected:'Form validation error; no API call', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-AUTH-004', module:'Authentication', feature:'Empty Password', pre:'Login page open', steps:'1. Enter valid email  2. Leave password blank  3. Submit', expected:'Form validation error; no API call', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-AUTH-005', module:'Authentication', feature:'Invalid Email Format', pre:'Login page open', steps:'1. Enter "notanemail" as email  2. Enter any password', expected:'Validation error: invalid email format', type:'AUTOMATED', priority:'MEDIUM', severity:'MINOR' },
  { id:'TC-AUTH-006', module:'Authentication', feature:'Non-existent User', pre:'Login page open', steps:'1. Enter ghost@test.com  2. Enter any password  3. Submit', expected:'Error: user not found / invalid credentials', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-AUTH-007', module:'Authentication', feature:'Session Persistence', pre:'Logged in', steps:'1. Reload the browser page', expected:'User remains logged in; token refreshed via cookie', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-AUTH-008', module:'Authentication', feature:'Login as ADMIN', pre:'ADMIN credentials available', steps:'1. Login with admin email/password', expected:'Admin nav links visible: Employees, Payroll, Shifts, Departments', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-AUTH-009', module:'Authentication', feature:'Login as HR', pre:'HR credentials available', steps:'1. Login with HR account', expected:'HR-level navigation visible; payroll accessible', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-AUTH-010', module:'Authentication', feature:'Login as MANAGER', pre:'Manager credentials available', steps:'1. Login with manager account', expected:'Manager nav visible; team management accessible', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-AUTH-011', module:'Authentication', feature:'Login as EMPLOYEE', pre:'testuser@intellisys.com', steps:'1. Login with employee account', expected:'Limited nav: no Employees directory link, no Payroll management', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-AUTH-012', module:'Authentication', feature:'Logout', pre:'Logged in', steps:'1. Click avatar/topbar menu  2. Click Logout', expected:'Session cleared; redirected to /login', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-AUTH-013', module:'Authentication', feature:'Protected Route Without Auth', pre:'Not logged in', steps:'1. Navigate directly to /attendance in browser', expected:'Redirected to /login', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-AUTH-014', module:'Authentication', feature:'Session Timeout Warning', pre:'Logged in; idle for long time', steps:'1. Leave app idle for session duration', expected:'Session warning banner appears asking to continue', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-AUTH-015', module:'Authentication', feature:'Refresh Session', pre:'Session warning shown', steps:'1. Click "Continue Session" on warning banner', expected:'Session refreshed; warning dismissed', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-AUTH-016', module:'Authentication', feature:'Stale Token After Logout', pre:'After logout', steps:'1. Use browser back button to revisit a protected page', expected:'Redirected to /login; no stale data shown', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
];

const DASH_TCS = [
  { id:'TC-DASH-001', module:'Dashboard', feature:'Dashboard Loads (Employee)', pre:'Logged in as EMPLOYEE', steps:'1. Navigate to /', expected:'Dashboard cards load: Today Status, Quick Actions, Announcements', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-DASH-002', module:'Dashboard', feature:'Check-In Quick Action', pre:'Not checked in today', steps:'1. View Check-In card on dashboard', expected:'Check-In button visible and clickable', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-DASH-003', module:'Dashboard', feature:'Attendance Stats', pre:'Logged in', steps:'1. View attendance summary card', expected:'Shows Present, Absent, Leave counts for current month', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-DASH-004', module:'Dashboard', feature:'Leave Balance Card', pre:'Logged in', steps:'1. View leave balance section', expected:'CL, SL, EL balances shown with correct numbers', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-DASH-005', module:'Dashboard', feature:'Workday Timeline', pre:'Checked in today', steps:'1. View timeline on dashboard', expected:'Shows check-in time, breaks, current status', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-DASH-006', module:'Dashboard', feature:'Admin Dashboard', pre:'Logged in as ADMIN', steps:'1. Go to /', expected:'Admin sees company-wide metrics, team attendance, headcount', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-DASH-007', module:'Dashboard', feature:'All Nav Links Work', pre:'Logged in', steps:'1. Click each sidebar link one by one', expected:'Each navigates to correct page without error', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-DASH-008', module:'Dashboard', feature:'Analytics Page Loads', pre:'Logged in (ADMIN/HR)', steps:'1. Navigate to /analytics', expected:'Charts and graphs load with data', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
];

const ATT_TCS = [
  { id:'TC-ATT-001', module:'Attendance', feature:'Check-In', pre:'Not checked in today', steps:'1. Go to /attendance  2. Click Check In', expected:'Status = ACTIVE, timer starts, check-in time recorded', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-ATT-002', module:'Attendance', feature:'Duplicate Check-In Prevention', pre:'Already checked in', steps:'1. Try to click Check-In again', expected:'Check-In button hidden/disabled; shows already checked in state', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-ATT-003', module:'Attendance', feature:'Check-Out', pre:'Checked in', steps:'1. Click Check Out  2. Confirm in modal', expected:'Session ends; worked hours calculated and displayed', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-ATT-004', module:'Attendance', feature:'Late Check-In Penalty', pre:'After shift grace period', steps:'1. Check in late  2. View attendance record', expected:'LATE penalty applied; reflected in total worked hours', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-ATT-005', module:'Attendance', feature:'Early Checkout Warning', pre:'Before completing 9h', steps:'1. Click Check-Out before required hours', expected:'Warning modal shows remaining hours required', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-ATT-006', module:'Attendance', feature:'Checkout During Active Break', pre:'Currently on break', steps:'1. Start break  2. Try to check out', expected:'Error or prompt to end break first', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-ATT-007', module:'Attendance', feature:'Start Morning Tea Break', pre:'Checked in; morning shift', steps:'1. Click Start Break  2. Select Morning Tea', expected:'Break starts; timer shows; status = AWAY', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-ATT-008', module:'Attendance', feature:'End Break', pre:'Currently on break', steps:'1. Click End Break', expected:'Break session recorded; status returns to ACTIVE', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-ATT-009', module:'Attendance', feature:'Long Break Penalty', pre:'Break exceeds limit', steps:'1. Start break  2. End after limit exceeded', expected:'Over-duration recorded; penalty may apply', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-ATT-010', module:'Attendance', feature:'Lunch Only for Morning Shift', pre:'Morning shift checked in', steps:'1. Click Start Break  2. Select Lunch', expected:'Lunch starts; Dinner not available for morning shift', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-ATT-011', module:'Attendance', feature:'Dinner Only for Night Shift', pre:'Night shift checked in', steps:'1. Click Start Break  2. Select Dinner', expected:'Dinner allowed up to 40 min; Lunch not available', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-ATT-012', module:'Attendance', feature:'Nested Break Prevention', pre:'Already on break', steps:'1. Try to start another break', expected:'Break button disabled; only End Break shown', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-ATT-013', module:'Attendance', feature:'View Attendance History', pre:'Logged in', steps:'1. Go to Attendance page  2. Click History tab', expected:'Table shows attendance records for current month', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-ATT-014', module:'Attendance', feature:'Month/Year Switcher', pre:'History tab open', steps:'1. Change month dropdown to previous month', expected:'Table refreshes with that month\'s records', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-ATT-015', module:'Attendance', feature:'Saturday = Off Day', pre:'History tab loaded', steps:'1. Scroll to any Saturday row', expected:'Shows "Off Day" not "Absent"', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-ATT-016', module:'Attendance', feature:'Sunday = Off Day', pre:'History tab loaded', steps:'1. Scroll to any Sunday row', expected:'Shows "Off Day" not "Absent"', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-ATT-017', module:'Attendance', feature:'Working Saturday Display', pre:'Switch to April 2026', steps:'1. Check April 11 and April 25', expected:'Shows "Working Saturday" status', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-ATT-018', module:'Attendance', feature:'Holiday Display', pre:'Switch to May 2026', steps:'1. Check May 1', expected:'Shows "Maharashtra Day" Holiday status', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-ATT-019', module:'Attendance', feature:'Future Day = Scheduled', pre:'Any future date', steps:'1. View any future date row', expected:'Shows "Scheduled" not "Absent"', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-ATT-020', module:'Attendance', feature:'Summary Counts Accuracy', pre:'History tab loaded', steps:'1. Check summary cards above table', expected:'Present, Absent, Off Days, Working Days counts are accurate', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-ATT-021', module:'Attendance', feature:'Submit Regularization', pre:'Absent day exists', steps:'1. Click Regularize  2. Fill reason  3. Submit', expected:'Regularization submitted with Pending status', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-ATT-022', module:'Attendance', feature:'Approve Regularization', pre:'ADMIN/HR/Manager logged in', steps:'1. Go to /attendance/requests  2. Click Approve', expected:'Attendance updated to Present for that date', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-ATT-023', module:'Attendance', feature:'Reject Regularization', pre:'ADMIN/HR/Manager logged in', steps:'1. Go to /attendance/requests  2. Click Reject', expected:'Status set to Rejected', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-ATT-024', module:'Attendance', feature:'Empty Regularization Reason', pre:'Regularization modal open', steps:'1. Click Submit without entering reason', expected:'Validation error: reason is required', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-ATT-025', module:'Attendance', feature:'Submit OT Pre-Approval', pre:'Before 5 PM on working day', steps:'1. Click Request Paid Overtime  2. Enter reason  3. Submit', expected:'OT request submitted; status Pending', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-ATT-026', module:'Attendance', feature:'OT Request After 5 PM Cutoff', pre:'After 5 PM', steps:'1. Submit OT pre-approval request', expected:'Error: past daily cutoff time', type:'AUTOMATED', priority:'MEDIUM', severity:'MINOR' },
];

const LV_TCS = [
  { id:'TC-LV-001', module:'Leaves', feature:'Apply Casual Leave', pre:'CL balance available', steps:'1. Go to /leaves  2. Click Apply Leave  3. Select CL  4. Pick dates  5. Enter reason  6. Submit', expected:'Leave request created with PENDING status', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-LV-002', module:'Leaves', feature:'Apply Leave No Balance', pre:'Zero CL balance', steps:'1. Try to apply CL with 0 balance', expected:'Error: insufficient leave balance', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-LV-003', module:'Leaves', feature:'Weekend Exclusion from Leave', pre:'Date range spans weekend', steps:'1. Apply leave Monday to Friday', expected:'Sat/Sun excluded from leave count', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-LV-004', module:'Leaves', feature:'Holiday Exclusion from Leave', pre:'Date range includes holiday', steps:'1. Apply leave spanning a public holiday', expected:'Holiday excluded from leave deduction', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-LV-005', module:'Leaves', feature:'Overlapping Leave', pre:'Existing approved leave exists', steps:'1. Apply leave on already-approved dates', expected:'Error: overlapping with existing leave', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-LV-006', module:'Leaves', feature:'Empty Leave Reason', pre:'Leave form open', steps:'1. Submit without entering reason', expected:'Validation error: reason is required', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-LV-007', module:'Leaves', feature:'End Date Before Start Date', pre:'Leave form open', steps:'1. Set end date before start date', expected:'Validation error: invalid date range', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-LV-008', module:'Leaves', feature:'Half-Day Leave', pre:'Leave form available', steps:'1. Select half-day  2. Choose AM or PM  3. Submit', expected:'Counted as 0.5 days against balance', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-LV-009', module:'Leaves', feature:'Approve Leave', pre:'ADMIN/HR/Manager; pending leave', steps:'1. View Approvals tab  2. Click Approve', expected:'Status = APPROVED; balance deducted', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-LV-010', module:'Leaves', feature:'Reject Leave', pre:'ADMIN/HR/Manager; pending leave', steps:'1. Click Reject on pending leave', expected:'Status = REJECTED; balance NOT deducted', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-LV-011', module:'Leaves', feature:'Employee Cannot Approve Leave', pre:'EMPLOYEE logged in', steps:'1. Navigate to leaves page', expected:'Approve button not visible', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-LV-012', module:'Leaves', feature:'Cancel Pending Leave', pre:'Employee; pending request', steps:'1. Cancel a pending leave request', expected:'Request removed; balance unaffected', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-LV-013', module:'Leaves', feature:'Balance Deduction on Approval', pre:'Leave approved', steps:'1. Note balance  2. Approve  3. Check balance', expected:'Balance reduced by correct number of working days', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-LV-014', module:'Leaves', feature:'Balance Unchanged on Rejection', pre:'Leave rejected', steps:'1. Note balance  2. Reject  3. Check balance', expected:'Balance unchanged', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-LV-015', module:'Leaves', feature:'Leave History Filter', pre:'Leaves page', steps:'1. Filter by Pending / Approved / Rejected', expected:'Table filters correctly to selected status', type:'AUTOMATED', priority:'MEDIUM', severity:'MINOR' },
];

const EMP_TCS = [
  { id:'TC-EMP-001', module:'Employees', feature:'View Employee Directory', pre:'ADMIN/HR/MANAGER', steps:'1. Go to /employees', expected:'Table shows all active employees with code, name, dept, status', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-EMP-002', module:'Employees', feature:'Search by Name', pre:'Directory open', steps:'1. Type employee name in search box', expected:'Table filters in real-time to matching employees', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-EMP-003', module:'Employees', feature:'Filter by Department', pre:'Directory open', steps:'1. Select department from dropdown', expected:'Only employees from that department shown', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-EMP-004', module:'Employees', feature:'EMPLOYEE Cannot Access Directory', pre:'EMPLOYEE logged in', steps:'1. Navigate to /employees', expected:'Directory link not in sidebar OR access denied', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-EMP-005', module:'Employees', feature:'View Own Profile', pre:'EMPLOYEE logged in', steps:'1. Click profile link', expected:'Profile page opens: Overview, Attendance, Leaves tabs', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-EMP-006', module:'Employees', feature:'Attendance Tab Month Switch', pre:'Attendance tab open', steps:'1. Switch month to April 2026', expected:'Exceptions re-fetched; Working Saturdays shown correctly', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-EMP-007', module:'Employees', feature:'Edit Employee', pre:'ADMIN/HR', steps:'1. Click Edit  2. Change field  3. Save', expected:'Changes saved and reflected immediately', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-EMP-008', module:'Employees', feature:'Edit Required Field Blank', pre:'Edit modal open', steps:'1. Clear First Name  2. Click Save', expected:'Validation error; not saved', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-EMP-009', module:'Employees', feature:'Avatar Upload (Valid)', pre:'Profile page', steps:'1. Click avatar  2. Upload valid JPG/PNG', expected:'Avatar updated; cropping UI shown', type:'AUTOMATED', priority:'MEDIUM', severity:'MINOR' },
  { id:'TC-EMP-010', module:'Employees', feature:'Avatar Upload (Invalid Type)', pre:'Avatar modal open', steps:'1. Try uploading a PDF or .exe', expected:'Error: invalid file type', type:'AUTOMATED', priority:'MEDIUM', severity:'MINOR' },
  { id:'TC-EMP-011', module:'Employees', feature:'Deactivate Employee', pre:'ADMIN logged in', steps:'1. Click Deactivate  2. Confirm', expected:'Employee marked Inactive; cannot login', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-EMP-012', module:'Employees', feature:'Create Employee', pre:'ADMIN/HR logged in', steps:'1. Click Add Employee  2. Fill required fields  3. Submit', expected:'New employee created; appears in directory', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-EMP-013', module:'Employees', feature:'Duplicate Email on Create', pre:'Add employee form', steps:'1. Enter existing email  2. Submit', expected:'Error: email already in use', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-EMP-014', module:'Employees', feature:'Missing Required Fields on Create', pre:'Add employee form', steps:'1. Leave First Name blank  2. Submit', expected:'Validation error shown on required fields', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
];

const PAY_TCS = [
  { id:'TC-PAY-001', module:'Payroll', feature:'View Payroll Page', pre:'ADMIN/HR logged in', steps:'1. Go to /payroll', expected:'Payroll records table loads with month/year selector', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-PAY-002', module:'Payroll', feature:'Generate Payroll', pre:'ADMIN/HR; end of month', steps:'1. Select month/year  2. Click Generate Payroll', expected:'Draft payroll records created for all employees', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-PAY-003', module:'Payroll', feature:'View Draft Details', pre:'Draft payroll exists', steps:'1. Click on a draft record', expected:'Opens: basic, HRA, deductions, net pay breakdown', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-PAY-004', module:'Payroll', feature:'Publish Payroll', pre:'Draft payroll exists', steps:'1. Click Publish on draft', expected:'Payroll locked; employees can view payslip', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-PAY-005', module:'Payroll', feature:'Employee Views Own Payslip', pre:'Payroll published', steps:'1. Login as employee  2. Own profile Payroll tab', expected:'Published payslip visible with salary breakdowns', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-PAY-006', module:'Payroll', feature:'Employee Cannot See Draft', pre:'Draft payroll exists', steps:'1. Login as employee  2. Check payroll tab', expected:'Draft records NOT visible to employees', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-PAY-007', module:'Payroll', feature:'LOP Deduction', pre:'Employee has unpaid absences', steps:'1. Generate payroll for employee with LOP', expected:'Loss of Pay deducted correctly from net salary', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-PAY-008', module:'Payroll', feature:'Add Incentive', pre:'Admin logged in', steps:'1. Go to /incentives  2. Select employee  3. Enter amount  4. Submit', expected:'Incentive added; appears in payslip for that month', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
];

const SHIFT_TCS = [
  { id:'TC-SH-001', module:'Shifts', feature:'View Shifts Page', pre:'ADMIN logged in', steps:'1. Go to /shifts', expected:'Shift profiles listed with timing and break details', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-SH-002', module:'Shifts', feature:'EMPLOYEE Cannot Access Shifts', pre:'EMPLOYEE logged in', steps:'1. Navigate to /shifts', expected:'Access denied; not in sidebar', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-SH-003', module:'Shifts', feature:'Create New Shift', pre:'Admin on shifts page', steps:'1. Click Add Shift  2. Enter name, start/end times  3. Submit', expected:'New shift created and visible', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-SH-004', module:'Shifts', feature:'Edit Shift', pre:'Admin; existing shift', steps:'1. Click Edit  2. Modify times  3. Save', expected:'Shift updated; linked employees get updated rules', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-SH-005', module:'Shifts', feature:'Break Config - Disable All', pre:'Edit shift modal', steps:'1. Toggle hasBreaks OFF', expected:'Break options hidden; break start blocked for employees', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-SH-006', module:'Shifts', feature:'Custom Break Timing', pre:'Shift with breaks enabled', steps:'1. Enable Morning Tea  2. Set start 10:30 end 11:15', expected:'Custom timing saved and shown on shift card', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-SH-007', module:'Shifts', feature:'Lunch Only for Morning Shift', pre:'Morning shift', steps:'1. Enable Lunch; verify Dinner not available', expected:'Dinner checkbox absent/disabled for morning shifts', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-SH-008', module:'Shifts', feature:'Dinner Only for Night Shift', pre:'Night shift', steps:'1. Enable Dinner; verify Lunch not available', expected:'Lunch checkbox absent/disabled for night shifts', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-SH-009', module:'Shifts', feature:'Assign Shift to Employee', pre:'Admin; employee exists', steps:'1. Use Shift Switcher  2. Select employee  3. Assign shift', expected:'Employee shift updated; check-in rules recalculate', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
];

const CAL_TCS = [
  { id:'TC-CAL-001', module:'Calendar', feature:'View Calendar', pre:'Any role', steps:'1. Go to /calendar', expected:'Monthly calendar renders for current month', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-CAL-002', module:'Calendar', feature:'Holidays Shown', pre:'May 2026', steps:'1. View May 2026', expected:'May 1 shown as Maharashtra Day holiday', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-CAL-003', module:'Calendar', feature:'Working Saturdays Shown', pre:'April 2026', steps:'1. View April 2026', expected:'April 11 and 25 shown as Working Saturday', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-CAL-004', module:'Calendar', feature:'Add Working Saturday', pre:'ADMIN logged in', steps:'1. Click any Saturday  2. Mark as Working Saturday', expected:'Saturday highlighted as working day', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-CAL-005', module:'Calendar', feature:'Add Holiday', pre:'ADMIN logged in', steps:'1. Click any weekday  2. Add holiday with name', expected:'Day marked as holiday on calendar', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-CAL-006', module:'Calendar', feature:'Employee Cannot Edit Calendar', pre:'EMPLOYEE logged in', steps:'1. Click on a calendar day', expected:'No edit option shown; read-only view', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-CAL-007', module:'Calendar', feature:'Navigate Months', pre:'Calendar page', steps:'1. Click Next/Previous arrows', expected:'Calendar navigates; exceptions load for that month', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
];

const RBAC_TCS = [
  { id:'TC-RBAC-001', module:'RBAC', feature:'EMPLOYEE No Shifts Access', pre:'EMPLOYEE logged in', steps:'1. Navigate to /shifts', expected:'Access denied; not in sidebar', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-RBAC-002', module:'RBAC', feature:'EMPLOYEE No Payroll Management', pre:'EMPLOYEE logged in', steps:'1. Navigate to /payroll', expected:'Only own published payslips shown; no generate/publish button', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-RBAC-003', module:'RBAC', feature:'HR Can Approve Leaves', pre:'HR logged in', steps:'1. Go to Leaves Approvals', expected:'Approve button visible and functional', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-RBAC-004', module:'RBAC', feature:'ADMIN Full Access', pre:'ADMIN logged in', steps:'1. Navigate all routes', expected:'All routes accessible without restriction', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-RBAC-005', module:'RBAC', feature:'EMPLOYEE Cannot Edit Other Profile', pre:'EMPLOYEE logged in', steps:'1. View another employee profile', expected:'Edit button not visible', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-RBAC-006', module:'RBAC', feature:'API Without Token', pre:'No Authorization header', steps:'1. Call GET /api/employees without token', expected:'401 Unauthorized response', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-RBAC-007', module:'RBAC', feature:'EMPLOYEE Token on Admin API', pre:'EMPLOYEE JWT', steps:'1. Call DELETE /api/employees/1 with employee token', expected:'403 Forbidden response', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
];

const UI_TCS = [
  { id:'TC-UI-001', module:'UI/UX', feature:'Theme Consistency', pre:'Any page', steps:'1. Review color theme across all pages', expected:'Consistent dark/blue theme throughout', type:'MANUAL', priority:'MEDIUM', severity:'MINOR' },
  { id:'TC-UI-002', module:'UI/UX', feature:'Loading States', pre:'Slow network (3G)', steps:'1. Throttle network  2. Navigate pages', expected:'Skeleton loaders or spinners shown during load', type:'AUTOMATED', priority:'MEDIUM', severity:'MINOR' },
  { id:'TC-UI-003', module:'UI/UX', feature:'Error States', pre:'Backend unavailable', steps:'1. Turn off backend  2. Load dashboard', expected:'User-friendly error message; not raw error/JSON', type:'MANUAL', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-UI-004', module:'UI/UX', feature:'Toast Notifications', pre:'Any action', steps:'1. Perform save action', expected:'Toast appears and auto-dismisses after ~3 seconds', type:'AUTOMATED', priority:'MEDIUM', severity:'MINOR' },
  { id:'TC-UI-005', module:'UI/UX', feature:'Confirmation Dialog on Delete', pre:'Any delete action', steps:'1. Click delete on any item', expected:'Confirmation dialog appears before execution', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-UI-006', module:'UI/UX', feature:'Empty State Messages', pre:'List with no data', steps:'1. View section with no records', expected:'Empty state message shown; not blank screen', type:'AUTOMATED', priority:'MEDIUM', severity:'MINOR' },
  { id:'TC-UI-007', module:'UI/UX', feature:'Form Reset on Cancel', pre:'Edit modal', steps:'1. Open edit  2. Change fields  3. Click Cancel', expected:'Original values restored; no dirty state', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-UI-008', module:'UI/UX', feature:'Responsive Tablet', pre:'Browser devtools', steps:'1. Resize to 768px width', expected:'Layout adapts; no horizontal overflow', type:'MANUAL', priority:'MEDIUM', severity:'MINOR' },
];

const SEC_TCS = [
  { id:'TC-DATA-001', module:'Security & Integrity', feature:'IST Timezone Accuracy', pre:'Any attendance record', steps:'1. Check attendance date/time values', expected:'Dates and times reflect IST correctly; not UTC', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-DATA-002', module:'Security & Integrity', feature:'XSS Prevention', pre:'Any text input field', steps:'1. Enter <script>alert(\'xss\')</script> in any field', expected:'Input escaped; no script executed', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-DATA-003', module:'Security & Integrity', feature:'SQL Injection Prevention', pre:'Any search or form input', steps:'1. Enter \' OR 1=1 -- in search', expected:'Input sanitized; no DB error or data leak', type:'AUTOMATED', priority:'CRITICAL', severity:'BLOCKER' },
  { id:'TC-DATA-004', module:'Security & Integrity', feature:'Concurrent Check-In Prevention', pre:'Same account; two tabs', steps:'1. Try to check in from two browser tabs simultaneously', expected:'Only one check-in succeeds', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-DATA-005', module:'Security & Integrity', feature:'Balance Restored on Cancellation', pre:'Approved leave cancelled', steps:'1. Cancel approved leave  2. Check balance', expected:'Balance restored correctly', type:'AUTOMATED', priority:'HIGH', severity:'MAJOR' },
  { id:'TC-DATA-006', module:'Security & Integrity', feature:'Long Text Input', pre:'Any reason/description field', steps:'1. Paste 1000+ characters', expected:'Either truncated or max-length validation shown', type:'AUTOMATED', priority:'MEDIUM', severity:'MINOR' },
];

// Write update to Master Testing Checklist
const wbChecklist = XLSX.utils.book_new();

const allSheets: [string, any[]][] = [
  ['Auth & Session', AUTH_TCS],
  ['Dashboard', DASH_TCS],
  ['Attendance', ATT_TCS],
  ['Leaves', LV_TCS],
  ['Employees', EMP_TCS],
  ['Payroll', PAY_TCS],
  ['Shifts', SHIFT_TCS],
  ['Calendar', CAL_TCS],
  ['RBAC', RBAC_TCS],
  ['UI_UX', UI_TCS],
  ['Security & Integrity', SEC_TCS],
];

// 1. Build Summary sheet
const summaryData = allSheets.map(([name, tcs]) => ({
  'Module': name,
  'Total TCs': tcs.length,
  'Automated': tcs.filter(t => t.type === 'AUTOMATED').length,
  'Manual': tcs.filter(t => t.type === 'MANUAL').length,
  'Critical': tcs.filter(t => t.priority === 'CRITICAL').length,
  'High': tcs.filter(t => t.priority === 'HIGH').length,
  'Medium': tcs.filter(t => t.priority === 'MEDIUM').length,
  'Passed': '',
  'Failed': '',
  'Pass Rate': ''
}));

const summaryWs = XLSX.utils.json_to_sheet(summaryData);
summaryWs['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
summaryWs['!rows'] = [{ hpt: 28 }, ...summaryData.map(() => ({ hpt: 22 }))];
Object.keys(summaryData[0]).forEach((_, i) => {
  const cell = XLSX.utils.encode_cell({ r: 0, c: i });
  if (summaryWs[cell]) summaryWs[cell].s = HEADER_STYLE;
});
XLSX.utils.book_append_sheet(wbChecklist, summaryWs, 'Summary');

allSheets.forEach(([name, tcs]) => {
  XLSX.utils.book_append_sheet(wbChecklist, makeSheet(tcs), name);
});
XLSX.writeFile(wbChecklist, checklistPath);

// 2. Build Empty Bug Tracker Workbook
const wbBugs = XLSX.utils.book_new();
const bugHeaders = [
  'Bug ID', 'TC-ID', 'Module', 'Feature', 'Severity', 'Priority', 
  'Expected Result', 'Actual Result', 'Steps to Reproduce', 'Status', 'Remarks'
];
const bugWs: any = {};
bugHeaders.forEach((h, i) => {
  const cell = XLSX.utils.encode_cell({ r: 0, c: i });
  bugWs[cell] = { v: h, t: 's', s: HEADER_STYLE };
});
bugWs['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 10, c: bugHeaders.length - 1 } });
bugWs['!cols'] = [
  { wch: 12 }, // Bug ID
  { wch: 15 }, // TC-ID
  { wch: 15 }, // Module
  { wch: 25 }, // Feature
  { wch: 12 }, // Severity
  { wch: 12 }, // Priority
  { wch: 45 }, // Expected
  { wch: 45 }, // Actual
  { wch: 55 }, // Steps
  { wch: 12 }, // Status
  { wch: 30 }  // Remarks
];
XLSX.utils.book_append_sheet(wbBugs, bugWs, 'Failed Cases & Bugs');
XLSX.writeFile(wbBugs, bugTrackerPath);

console.log(`\n✅ Generated updated master checklist: ${checklistPath}`);
console.log(`✅ Generated blank bug tracker sheet: ${bugTrackerPath}`);
