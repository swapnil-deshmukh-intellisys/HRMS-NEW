# HRMS — Manual Testing Plan
**Version:** 1.0 | **Date:** 2026-06-29 | **Environment:** Staging
**Test Account:** `testuser@intellisys.com` / `Test@1234` (Role: EMPLOYEE)
**Admin Account:** Use existing ADMIN credentials for role-based tests

---

## Test Case Conventions

| Field | Description |
|---|---|
| TC-ID | Unique test case identifier |
| Priority | CRITICAL / HIGH / MEDIUM / LOW |
| Severity | BLOCKER / MAJOR / MINOR / TRIVIAL |
| Status | PASS / FAIL / SKIP / BLOCKED |

---

## MODULE 1 — Authentication & Session Management

### 1.1 Login

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-AUTH-001 | Valid Login (Employee) | App running, test user exists | 1. Go to /login 2. Enter testuser@intellisys.com / Test@1234 3. Click Sign In | Redirect to Dashboard, Navbar shows user name | | | CRITICAL | BLOCKER | | |
| TC-AUTH-002 | Invalid Password | App running | 1. Enter correct email 2. Enter wrong password 3. Click Sign In | Error toast: "Invalid credentials" | | | CRITICAL | BLOCKER | | |
| TC-AUTH-003 | Empty Email | Login page open | 1. Leave email blank 2. Enter any password 3. Click Sign In | Form validation error, no API call made | | | HIGH | MAJOR | | |
| TC-AUTH-004 | Empty Password | Login page open | 1. Enter valid email 2. Leave password blank 3. Click Sign In | Form validation error, no API call made | | | HIGH | MAJOR | | |
| TC-AUTH-005 | Invalid Email Format | Login page open | 1. Enter "notanemail" as email 2. Enter any password | Validation error: invalid email format | | | MEDIUM | MINOR | | |
| TC-AUTH-006 | Non-existent User | Login page open | 1. Enter ghost@test.com 2. Enter any password 3. Submit | Error: user not found / invalid credentials | | | HIGH | MAJOR | | |
| TC-AUTH-007 | Session Persistence | Logged in | 1. Reload the browser page | User remains logged in; token refreshed via cookie | | | CRITICAL | BLOCKER | | |
| TC-AUTH-008 | Login as ADMIN | ADMIN credentials available | 1. Login with admin email/password | Admin nav links visible: Employees, Payroll, Shifts, Departments | | | CRITICAL | BLOCKER | | |
| TC-AUTH-009 | Login as HR | HR credentials available | 1. Login with HR account | HR-level navigation visible; payroll accessible | | | HIGH | MAJOR | | |
| TC-AUTH-010 | Login as MANAGER | Manager credentials available | 1. Login with manager account | Manager nav visible; team management accessible | | | HIGH | MAJOR | | |
| TC-AUTH-011 | Login as EMPLOYEE | testuser@intellisys.com | 1. Login with employee account | Limited nav: no Employees directory link, no Payroll management | | | CRITICAL | BLOCKER | | |

### 1.2 Logout & Session

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-AUTH-012 | Logout | Logged in | 1. Click avatar/topbar menu 2. Click Logout | Session cleared, redirected to /login | | | CRITICAL | BLOCKER | | |
| TC-AUTH-013 | Protected Route Without Auth | Not logged in | 1. Navigate directly to /attendance in browser | Redirected to /login | | | CRITICAL | BLOCKER | | |
| TC-AUTH-014 | Session Timeout Warning | Logged in, idle for long time | 1. Leave app idle for session duration | Session warning banner appears asking to continue | | | HIGH | MAJOR | | |
| TC-AUTH-015 | Refresh Session | Session warning shown | 1. Click "Continue Session" on warning banner | Session refreshed; warning dismissed | | | HIGH | MAJOR | | |
| TC-AUTH-016 | Stale Token After Logout | After logout | 1. Use browser back button to revisit a protected page | Redirected to /login; no stale data shown | | | HIGH | MAJOR | | |

---

## MODULE 2 — Dashboard

### 2.1 Employee Dashboard

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-DASH-001 | Dashboard Loads | Logged in as EMPLOYEE | 1. Navigate to / | Dashboard cards load: Today Status, Quick Actions, Announcements | | | CRITICAL | BLOCKER | | |
| TC-DASH-002 | Check-In Quick Action | Not checked in today | 1. View Check-In card on dashboard | Check-In button visible and clickable | | | CRITICAL | BLOCKER | | |
| TC-DASH-003 | Attendance Stats | Logged in | 1. View attendance summary card | Shows Present, Absent, Leave counts for current month | | | HIGH | MAJOR | | |
| TC-DASH-004 | Leave Balance Card | Logged in | 1. View leave balance section | CL, SL, EL balances shown with correct numbers | | | HIGH | MAJOR | | |
| TC-DASH-005 | Recent Attendance | Logged in | 1. View recent activity section | Last 5-7 attendance records shown with dates and status | | | MEDIUM | MINOR | | |
| TC-DASH-006 | Announcements | Logged in | 1. View Announcements section | HR announcements displayed if any exist | | | MEDIUM | MINOR | | |
| TC-DASH-007 | Workday Timeline | Checked in today | 1. View timeline on dashboard | Shows check-in time, breaks, current status in timeline | | | HIGH | MAJOR | | |
| TC-DASH-008 | Admin Dashboard | Logged in as ADMIN | 1. Go to / | Admin sees company-wide metrics, team attendance, headcount | | | CRITICAL | BLOCKER | | |
| TC-DASH-009 | Manager Dashboard | Logged in as MANAGER | 1. Go to / | Manager sees team metrics and pending approvals | | | HIGH | MAJOR | | |
| TC-DASH-010 | Todo/Tasks Widget | Logged in | 1. Check dashboard todo section | Pending todos shown with Add button | | | MEDIUM | MINOR | | |
| TC-DASH-011 | All Navigation Links Work | Logged in | 1. Click each sidebar link one by one | Each navigates to correct page without error | | | CRITICAL | BLOCKER | | |

### 2.2 Analytics Page

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-DASH-012 | Analytics Page Loads | Logged in (ADMIN/HR) | 1. Navigate to /analytics | Charts and graphs load with data | | | HIGH | MAJOR | | |
| TC-DASH-013 | Department Filter | Analytics page open | 1. Change department dropdown | Charts update for selected department | | | MEDIUM | MINOR | | |
| TC-DASH-014 | Date Range Filter | Analytics page open | 1. Change date range picker | Data reflects selected period | | | MEDIUM | MINOR | | |

---

## MODULE 3 — Attendance

### 3.1 Check-In / Check-Out

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-ATT-001 | Check-In | Not checked in today | 1. Go to /attendance 2. Click Check In | Status = ACTIVE, timer starts, check-in time recorded | | | CRITICAL | BLOCKER | | |
| TC-ATT-002 | Duplicate Check-In | Already checked in | 1. Try to click Check-In again | Check-In button hidden/disabled; shows already checked in state | | | CRITICAL | BLOCKER | | |
| TC-ATT-003 | Check-Out | Checked in | 1. Click Check Out 2. Confirm in modal | Session ends; worked hours calculated and displayed | | | CRITICAL | BLOCKER | | |
| TC-ATT-004 | Late Check-In Penalty | After shift grace period | 1. Check in late 2. View attendance record | LATE penalty applied; reflected in total worked hours | | | HIGH | MAJOR | | |
| TC-ATT-005 | Early Checkout Warning | Before completing 9h | 1. Click Check-Out before required hours complete | Warning modal shows remaining hours required before checkout | | | HIGH | MAJOR | | |
| TC-ATT-006 | Checkout During Active Break | Currently on break | 1. Start break 2. Try to check out without ending break | Error or prompt to end break first | | | HIGH | MAJOR | | |

### 3.2 Breaks

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-ATT-007 | Start Morning Tea | Checked in; morning shift | 1. Click Start Break 2. Select Morning Tea | Break starts; timer shows; status = AWAY | | | HIGH | MAJOR | | |
| TC-ATT-008 | End Break | Currently on break | 1. Click End Break | Break session recorded; status returns to ACTIVE | | | HIGH | MAJOR | | |
| TC-ATT-009 | Long Break Duration | Break exceeds limit | 1. Start break 2. End break after limit exceeded | Over-duration recorded; penalty may apply | | | HIGH | MAJOR | | |
| TC-ATT-010 | Lunch Break (Morning Shift) | Morning shift checked in | 1. Click Start Break 2. Select Lunch | Lunch starts successfully for morning shift | | | HIGH | MAJOR | | |
| TC-ATT-011 | Dinner Break (Night Shift) | Night shift checked in | 1. Click Start Break 2. Select Dinner | Dinner break allowed up to 40 minutes | | | HIGH | MAJOR | | |
| TC-ATT-012 | Dinner Not Available on Morning Shift | Morning shift checked in | 1. Click Start Break | Dinner option absent or disabled in break menu | | | HIGH | MAJOR | | |
| TC-ATT-013 | Nested Break Prevention | Already on break | 1. Try to start another break | Break button disabled; only End Break shown | | | HIGH | MAJOR | | |

### 3.3 Attendance History

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-ATT-014 | View Attendance History | Logged in | 1. Go to Attendance page 2. Click History tab | Table shows attendance records for current month | | | HIGH | MAJOR | | |
| TC-ATT-015 | Month/Year Switcher | History tab open | 1. Change month dropdown to previous month | Table refreshes with that month's records | | | HIGH | MAJOR | | |
| TC-ATT-016 | Saturday = Off Day | History tab loaded | 1. Scroll to any Saturday | Shows "Off Day" not "Absent" | | | CRITICAL | BLOCKER | | |
| TC-ATT-017 | Sunday = Off Day | History tab loaded | 1. Scroll to any Sunday | Shows "Off Day" not "Absent" | | | CRITICAL | BLOCKER | | |
| TC-ATT-018 | Working Saturday Display | Switch to April 2026 | 1. Check April 11 and April 25 | Shows "Working Saturday" status | | | HIGH | MAJOR | | |
| TC-ATT-019 | Holiday Display | Switch to May 2026 | 1. Check May 1 | Shows "Maharashtra Day" Holiday status | | | HIGH | MAJOR | | |
| TC-ATT-020 | Present Day Row | Worked day exists | 1. View a day you were present | Shows "Present" with check-in/out times and worked hours | | | HIGH | MAJOR | | |
| TC-ATT-021 | Absent Day Row | Missed workday | 1. View a missed working day | Shows "Absent" | | | HIGH | MAJOR | | |
| TC-ATT-022 | Leave Day Row | Approved leave exists | 1. View an approved leave day | Shows "Leave (CL)" or relevant leave code | | | HIGH | MAJOR | | |
| TC-ATT-023 | Future Day Row | Any future date | 1. View any future date | Shows "Scheduled" not "Absent" | | | HIGH | MAJOR | | |
| TC-ATT-024 | Click Row for Timeline | Any present day | 1. Click a Present row | Workday Timeline panel opens showing that day's activity | | | MEDIUM | MINOR | | |
| TC-ATT-025 | Overtime Hours Display | Day with overtime | 1. View a row with OT | Overtime hours shown in distinct color/tag | | | MEDIUM | MINOR | | |
| TC-ATT-026 | Summary Counts Accuracy | History tab | 1. Check summary cards above table | Present, Absent, Off Days, Working Days counts are accurate | | | HIGH | MAJOR | | |
| TC-ATT-027 | Charts Render | History tab | 1. View attendance breakdown chart | Pie/bar chart renders with correct percentages | | | MEDIUM | MINOR | | |

### 3.4 Regularization Requests

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-ATT-028 | Submit Regularization | Absent day exists | 1. Click Regularize on absent day 2. Fill reason 3. Submit | Regularization request submitted with Pending status | | | HIGH | MAJOR | | |
| TC-ATT-029 | Approve Regularization | ADMIN/HR/Manager logged in | 1. Go to /attendance/requests 2. Click Approve | Attendance updated to Present for that date | | | HIGH | MAJOR | | |
| TC-ATT-030 | Reject Regularization | ADMIN/HR/Manager logged in | 1. Go to /attendance/requests 2. Click Reject | Status set to Rejected | | | HIGH | MAJOR | | |
| TC-ATT-031 | Empty Reason Validation | Regularization modal open | 1. Click Submit without entering reason | Validation error: reason is required | | | HIGH | MAJOR | | |
| TC-ATT-032 | Regularize Future Date | Future date | 1. Try to regularize a future date | Should not be permitted | | | MEDIUM | MINOR | | |
| TC-ATT-033 | Duplicate Regularization | Pending request exists | 1. Try to submit another for same date | Error: request already pending for this date | | | MEDIUM | MINOR | | |

### 3.5 Overtime

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-ATT-034 | Submit OT Pre-Approval | Before 5 PM on a working day | 1. Click Request Paid Overtime 2. Enter reason 3. Submit | OT pre-approval request submitted; status Pending | | | HIGH | MAJOR | | |
| TC-ATT-035 | Approve OT | ADMIN/HR/Manager | 1. Find pending OT request 2. Click Approve | Status = APPROVED; employee can proceed with paid OT | | | HIGH | MAJOR | | |
| TC-ATT-036 | Paid OT Recording | OT approved; after shift hours | 1. Work beyond shift end time | OT recorded with isPaid = true | | | HIGH | MAJOR | | |
| TC-ATT-037 | Unpaid OT Without Approval | No pre-approval | 1. Work beyond shift end time | OT recorded with isPaid = false | | | HIGH | MAJOR | | |
| TC-ATT-038 | OT Request After 5 PM | After 5 PM cutoff | 1. Submit OT pre-approval request | Error: past daily cutoff time | | | MEDIUM | MINOR | | |

---

## MODULE 4 — Leaves

### 4.1 Apply for Leave

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-LV-001 | Apply Casual Leave | Logged in; CL balance available | 1. Go to /leaves 2. Click Apply Leave 3. Select CL 4. Pick dates 5. Enter reason 6. Submit | Leave request created with PENDING status | | | CRITICAL | BLOCKER | | |
| TC-LV-002 | Apply Sick Leave | SL balance available | 1. Apply SL for 1-2 days with reason | Request submitted successfully | | | HIGH | MAJOR | | |
| TC-LV-003 | Apply Leave No Balance | Zero CL balance | 1. Try to apply CL with 0 balance | Error: insufficient leave balance | | | HIGH | MAJOR | | |
| TC-LV-004 | Weekend Exclusion | Date range spans weekend | 1. Apply leave Monday to Friday | Sat/Sun excluded from leave count | | | HIGH | MAJOR | | |
| TC-LV-005 | Holiday Exclusion | Date range includes holiday | 1. Apply leave spanning a public holiday | Holiday day excluded from leave deduction | | | HIGH | MAJOR | | |
| TC-LV-006 | Overlapping Leave | Existing approved leave | 1. Apply leave on already-approved dates | Error: overlapping with existing leave | | | HIGH | MAJOR | | |
| TC-LV-007 | Empty Reason | Leave form open | 1. Submit without entering reason | Validation error: reason is required | | | HIGH | MAJOR | | |
| TC-LV-008 | End Date Before Start Date | Leave form open | 1. Set end date earlier than start date | Validation error: invalid date range | | | HIGH | MAJOR | | |
| TC-LV-009 | Past Date Leave | Date in the past | 1. Try to apply leave for yesterday | Validation warning or block shown | | | MEDIUM | MINOR | | |
| TC-LV-010 | Half-Day Leave | Leave form available | 1. Select half-day option 2. Choose AM or PM 3. Submit | Counted as 0.5 days against balance | | | HIGH | MAJOR | | |
| TC-LV-011 | Medical Attachment Prompt | Applying SL for 3+ days | 1. Apply SL for 3 days | Prompt/requirement to upload medical proof document | | | HIGH | MAJOR | | |

### 4.2 Leave Approvals

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-LV-012 | Approve Leave | ADMIN/HR/Manager; pending leave exists | 1. View pending leave in Approvals tab 2. Click Approve | Status = APPROVED; balance deducted from employee | | | CRITICAL | BLOCKER | | |
| TC-LV-013 | Reject Leave | ADMIN/HR/Manager; pending leave exists | 1. Click Reject on a pending leave | Status = REJECTED; balance NOT deducted | | | CRITICAL | BLOCKER | | |
| TC-LV-014 | Reject with Reason | Rejection flow | 1. Enter rejection note 2. Confirm reject | Rejection reason saved and visible to employee | | | HIGH | MAJOR | | |
| TC-LV-015 | Employee Cannot Approve | EMPLOYEE logged in | 1. Navigate to leaves page | Approve button not visible; employee is read-only | | | CRITICAL | BLOCKER | | |
| TC-LV-016 | Cancel Pending Leave | Employee; pending request | 1. Cancel a pending leave request | Request removed; balance unaffected | | | HIGH | MAJOR | | |
| TC-LV-017 | Cancel Approved Leave | Employee; approved leave | 1. Try to cancel approved leave | Either allowed with balance restored or blocked by policy | | | HIGH | MAJOR | | |

### 4.3 Leave Balances

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-LV-018 | View Balances | Logged in | 1. Go to Leaves page 2. Check Balances section | CL, SL, EL balances shown correctly | | | HIGH | MAJOR | | |
| TC-LV-019 | Balance Deduction on Approval | Leave approved | 1. Note balance before approval 2. Approve 3. Check balance | Balance reduced by correct number of working days | | | CRITICAL | BLOCKER | | |
| TC-LV-020 | Balance Unchanged on Rejection | Leave rejected | 1. Note balance before rejection 2. Reject 3. Check balance | Balance unchanged | | | CRITICAL | BLOCKER | | |
| TC-LV-021 | Leave History Filter | Leaves page | 1. Filter by status: Pending / Approved / Rejected | Table filters correctly to selected status | | | MEDIUM | MINOR | | |
| TC-LV-022 | Leave History Sort | Leaves page | 1. Sort by date column | Records reorder by date correctly | | | MEDIUM | MINOR | | |

---

## MODULE 5 — Employee Directory

### 5.1 Employee List

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-EMP-001 | View Employee Directory | ADMIN/HR/MANAGER | 1. Go to /employees | Table shows all active employees with code, name, dept, status | | | CRITICAL | BLOCKER | | |
| TC-EMP-002 | Search by Name | Directory open | 1. Type employee name in search box | Table filters to matching employees in real-time | | | HIGH | MAJOR | | |
| TC-EMP-003 | Search by Employee Code | Directory open | 1. Type employee code | Matching employee row shown | | | HIGH | MAJOR | | |
| TC-EMP-004 | Filter by Department | Directory open | 1. Select department from dropdown | Only employees from that department shown | | | HIGH | MAJOR | | |
| TC-EMP-005 | Filter by Status | Directory open | 1. Filter by Active / Inactive | Only employees with selected status shown | | | HIGH | MAJOR | | |
| TC-EMP-006 | EMPLOYEE Cannot Access Directory | EMPLOYEE logged in | 1. Navigate to /employees | Directory link not in sidebar OR access denied | | | CRITICAL | BLOCKER | | |

### 5.2 Employee Profile

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-EMP-007 | View Own Profile | EMPLOYEE logged in | 1. Click profile link | Profile page opens: Overview, Attendance, Leaves tabs | | | CRITICAL | BLOCKER | | |
| TC-EMP-008 | View Other Profile | ADMIN/HR/Manager | 1. Click any employee in directory | Full profile opens with all tabs including Payroll | | | CRITICAL | BLOCKER | | |
| TC-EMP-009 | Overview Tab | Profile page open | 1. Click Overview tab | Shows personal info, department, shift, joining date | | | HIGH | MAJOR | | |
| TC-EMP-010 | Attendance Tab | Profile page open | 1. Click Attendance tab | Shows attendance history for current month | | | HIGH | MAJOR | | |
| TC-EMP-011 | Attendance Month Switch | Attendance tab open | 1. Switch month to April 2026 | Exceptions re-fetched; Working Saturdays shown correctly | | | HIGH | MAJOR | | |
| TC-EMP-012 | Leaves Tab | Profile page open | 1. Click Leaves tab | Shows leave balances and history | | | HIGH | MAJOR | | |
| TC-EMP-013 | Payroll Tab (Admin) | ADMIN on profile page | 1. Click Payroll tab | Payroll records for that employee shown | | | HIGH | MAJOR | | |
| TC-EMP-014 | Documents Tab | Profile page open | 1. Click Documents tab | Uploaded documents listed or empty state shown | | | MEDIUM | MINOR | | |
| TC-EMP-015 | Edit Employee | ADMIN/HR | 1. Click Edit 2. Change a field 3. Save | Changes saved and immediately reflected | | | HIGH | MAJOR | | |
| TC-EMP-016 | Edit Required Field Blank | Edit modal open | 1. Clear First Name 2. Click Save | Validation error; not saved | | | HIGH | MAJOR | | |
| TC-EMP-017 | Avatar Upload (Valid) | Profile page | 1. Click avatar 2. Upload valid JPG/PNG | Avatar updated; cropping UI shown | | | MEDIUM | MINOR | | |
| TC-EMP-018 | Avatar Upload (Invalid Type) | Avatar modal open | 1. Try uploading a PDF or .exe | Error: invalid file type | | | MEDIUM | MINOR | | |
| TC-EMP-019 | Avatar Upload (File Too Large) | Avatar modal open | 1. Upload file exceeding size limit | Error: file too large | | | MEDIUM | MINOR | | |
| TC-EMP-020 | Deactivate Employee | ADMIN logged in | 1. Click Deactivate 2. Confirm | Employee marked Inactive; cannot login | | | HIGH | MAJOR | | |
| TC-EMP-021 | Re-activate Employee | ADMIN; inactive employee | 1. Click Activate 2. Confirm | Employee reactivated; login restored | | | HIGH | MAJOR | | |

### 5.3 Create New Employee

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-EMP-022 | Create Employee | ADMIN/HR logged in | 1. Click Add Employee 2. Fill all required fields 3. Submit | New employee created; appears in directory | | | CRITICAL | BLOCKER | | |
| TC-EMP-023 | Duplicate Email | Add employee form | 1. Enter existing email 2. Submit | Error: email already in use | | | CRITICAL | BLOCKER | | |
| TC-EMP-024 | Duplicate Employee Code | Add employee form | 1. Enter existing employee code 2. Submit | Error: employee code already taken | | | HIGH | MAJOR | | |
| TC-EMP-025 | Missing Required Fields | Add employee form | 1. Leave First Name blank 2. Submit | Validation error shown on required fields | | | HIGH | MAJOR | | |
| TC-EMP-026 | Invalid Email Format | Add employee form | 1. Enter "notanemail" 2. Submit | Validation error: invalid email format | | | HIGH | MAJOR | | |

---

## MODULE 6 — Payroll

### 6.1 Payroll Management

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-PAY-001 | View Payroll Page | ADMIN/HR logged in | 1. Go to /payroll | Payroll records table loads with month/year selector | | | CRITICAL | BLOCKER | | |
| TC-PAY-002 | Generate Payroll | ADMIN/HR; end of month | 1. Select month/year 2. Click Generate Payroll | Draft payroll records created for all employees | | | CRITICAL | BLOCKER | | |
| TC-PAY-003 | View Payroll Draft Details | Draft payroll exists | 1. Click on a draft record | Opens detailed breakdown: basic, HRA, deductions, net pay | | | HIGH | MAJOR | | |
| TC-PAY-004 | Publish Payroll | Draft payroll exists | 1. Click Publish/Lock on draft | Payroll locked; employees can view their payslip | | | HIGH | MAJOR | | |
| TC-PAY-005 | Employee Views Own Payslip | Payroll published | 1. Login as employee 2. Go to own profile Payroll tab | Published payslip visible with salary breakdowns | | | HIGH | MAJOR | | |
| TC-PAY-006 | Employee Cannot See Draft | Draft payroll exists | 1. Login as employee 2. Check payroll tab | Draft records NOT visible to employees | | | CRITICAL | BLOCKER | | |
| TC-PAY-007 | Download Payslip | Published payslip | 1. Click Download on payslip | PDF downloads with correct salary data | | | HIGH | MAJOR | | |
| TC-PAY-008 | OT Included in Payroll | Employee has paid OT | 1. Generate payroll 2. Check OT line | Paid overtime amount included correctly | | | HIGH | MAJOR | | |
| TC-PAY-009 | LOP Deduction | Employee has unpaid absences | 1. Generate payroll for employee with LOP | Loss of Pay deducted correctly from net salary | | | HIGH | MAJOR | | |
| TC-PAY-010 | Filter Payroll by Status | Payroll page | 1. Filter by Draft or Published | Table filters to selected status | | | MEDIUM | MINOR | | |

### 6.2 Incentives

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-PAY-011 | View Incentives Page | ADMIN/HR logged in | 1. Go to /incentives | Incentives list and add form visible | | | HIGH | MAJOR | | |
| TC-PAY-012 | Add Incentive | Admin logged in | 1. Select employee 2. Enter amount and reason 3. Submit | Incentive added; visible in list | | | HIGH | MAJOR | | |
| TC-PAY-013 | Incentive in Payroll | Incentive added this month | 1. Generate payroll | Incentive amount included in that employee's payslip | | | HIGH | MAJOR | | |
| TC-PAY-014 | Delete Incentive | Admin; incentive exists | 1. Click delete on incentive | Incentive removed (only before payroll is published) | | | MEDIUM | MINOR | | |

---

## MODULE 7 — Shifts

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-SH-001 | View Shifts Page | ADMIN logged in | 1. Go to /shifts | Shift profiles listed with timing and break details | | | CRITICAL | BLOCKER | | |
| TC-SH-002 | EMPLOYEE Cannot Access | EMPLOYEE logged in | 1. Navigate to /shifts | Access denied or not present in sidebar | | | CRITICAL | BLOCKER | | |
| TC-SH-003 | Create New Shift | Admin on shifts page | 1. Click Add Shift 2. Enter name, start/end times 3. Submit | New shift created and visible on page | | | HIGH | MAJOR | | |
| TC-SH-004 | Edit Shift | Admin; existing shift | 1. Click Edit 2. Modify times 3. Save | Shift updated; linked employees get updated rules | | | HIGH | MAJOR | | |
| TC-SH-005 | Delete Shift | Admin; shift not linked to employees | 1. Click Delete 2. Confirm | Shift deleted successfully | | | HIGH | MAJOR | | |
| TC-SH-006 | Missing Shift Name | Add shift form | 1. Leave name empty 2. Submit | Validation error on name field | | | HIGH | MAJOR | | |
| TC-SH-007 | Invalid Time Range | Add shift form | 1. Set end time before start time 2. Submit | Validation error: invalid time range | | | HIGH | MAJOR | | |
| TC-SH-008 | Disable All Breaks | Edit shift modal | 1. Toggle hasBreaks OFF | Break options hidden; break start blocked for employees | | | HIGH | MAJOR | | |
| TC-SH-009 | Custom Break Timing | Shift with breaks enabled | 1. Enable Morning Tea 2. Set start 10:30 end 11:15 | Custom timing saved; displayed on shift card | | | HIGH | MAJOR | | |
| TC-SH-010 | Lunch Only for Morning Shift | Morning shift | 1. Enable Lunch; verify Dinner not available | Dinner checkbox absent/disabled | | | HIGH | MAJOR | | |
| TC-SH-011 | Dinner Only for Night Shift | Night shift | 1. Enable Dinner; verify Lunch not available | Lunch checkbox absent/disabled | | | HIGH | MAJOR | | |
| TC-SH-012 | Invalid Break Time Format | Break time input | 1. Enter 25:99 as break time 2. Save | Validation error: invalid HH:MM format | | | HIGH | MAJOR | | |
| TC-SH-013 | Assign Shift to Employee | Admin; employee exists | 1. Use Shift Switcher 2. Select employee 3. Assign shift | Employee shift updated; check-in rules recalculate | | | HIGH | MAJOR | | |

---

## MODULE 8 — Calendar

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-CAL-001 | View Calendar | Any role | 1. Go to /calendar | Monthly calendar renders for current month | | | HIGH | MAJOR | | |
| TC-CAL-002 | Holidays Shown | Calendar page; May 2026 | 1. View May 2026 | May 1 shown as Maharashtra Day holiday | | | HIGH | MAJOR | | |
| TC-CAL-003 | Working Saturdays Shown | Calendar page; April 2026 | 1. View April 2026 | April 11 and 25 shown as Working Saturday | | | HIGH | MAJOR | | |
| TC-CAL-004 | Add Working Saturday | ADMIN logged in | 1. Click any Saturday 2. Mark as Working Saturday | Saturday highlighted as working day | | | HIGH | MAJOR | | |
| TC-CAL-005 | Add Holiday | ADMIN logged in | 1. Click any weekday 2. Add holiday with name | Day marked as holiday on calendar | | | HIGH | MAJOR | | |
| TC-CAL-006 | Delete Calendar Exception | ADMIN; exception exists | 1. Click on existing exception 2. Delete | Exception removed; day returns to default | | | HIGH | MAJOR | | |
| TC-CAL-007 | Employee Cannot Edit Calendar | EMPLOYEE logged in | 1. Click on a calendar day | No edit option shown; read-only view | | | CRITICAL | BLOCKER | | |
| TC-CAL-008 | Navigate Months | Calendar page | 1. Click Next/Previous arrows | Calendar navigates correctly; exceptions load for that month | | | HIGH | MAJOR | | |

---

## MODULE 9 — Team & Tasks

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TEAM-001 | View Team Page | Logged in | 1. Go to /team | Team page loads with workspace sections | | | HIGH | MAJOR | | |
| TC-TEAM-002 | Ongoing Projects | Team page | 1. Click Ongoing Projects tab | TSP projects list shown | | | MEDIUM | MINOR | | |
| TC-TEAM-003 | Add Project (Admin) | ADMIN logged in | 1. Click Add Project 2. Enter details 3. Submit | New project added | | | MEDIUM | MINOR | | |
| TC-TEAM-004 | Leaderboard Page | Logged in | 1. Go to /team/leaderboard | Employee ranking based on performance shown | | | MEDIUM | MINOR | | |
| TC-TEAM-005 | Manager Task Console | MANAGER/ADMIN | 1. Go to /tasks/manage | Dual view: tasks assigned by me + assigned to me | | | HIGH | MAJOR | | |
| TC-TEAM-006 | Assign Task to Employee | Manager role | 1. Select employee 2. Enter task 3. Assign | Task appears in employee todo list | | | HIGH | MAJOR | | |
| TC-TEAM-007 | Complete Assigned Task | Employee; assigned task | 1. Go to employee todos 2. Mark complete | Task marked done; manager notified | | | HIGH | MAJOR | | |
| TC-TEAM-008 | Task History | Any role | 1. Go to /tasks/history | Completed tasks listed with timestamps | | | MEDIUM | MINOR | | |
| TC-TEAM-009 | Todo History | Any role | 1. Go to /todos/history | Personal todos completed previously shown | | | MEDIUM | MINOR | | |

---

## MODULE 10 — Notifications

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-NOT-001 | Notification Bell Badge | Logged in; unread notifications | 1. Check top navbar bell icon | Badge shows unread count | | | HIGH | MAJOR | | |
| TC-NOT-002 | View All Notifications | Logged in | 1. Go to /notifications | All notifications listed with timestamps | | | HIGH | MAJOR | | |
| TC-NOT-003 | Mark Single as Read | Notifications page | 1. Click a notification | Notification marked read; badge decrements | | | MEDIUM | MINOR | | |
| TC-NOT-004 | Mark All as Read | Notifications page | 1. Click Mark All as Read | All marked read; badge clears | | | MEDIUM | MINOR | | |
| TC-NOT-005 | Leave Approval Notification | Leave approved by manager | 1. Login as employee | Notification: "Your leave was approved" visible | | | HIGH | MAJOR | | |
| TC-NOT-006 | Task Assignment Notification | Task assigned to employee | 1. Login as employee | Notification: "New task assigned" visible | | | HIGH | MAJOR | | |

---

## MODULE 11 — Departments

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-DEPT-001 | View Departments | ADMIN/HR | 1. Go to /departments | List shows names, codes, employee counts | | | HIGH | MAJOR | | |
| TC-DEPT-002 | Add Department | ADMIN | 1. Click Add 2. Enter name and code 3. Submit | Department created | | | HIGH | MAJOR | | |
| TC-DEPT-003 | Duplicate Code | Add dept form | 1. Enter existing code 2. Submit | Error: department code must be unique | | | HIGH | MAJOR | | |
| TC-DEPT-004 | Edit Department Name | ADMIN; dept exists | 1. Click Edit 2. Change name 3. Save | Name updated successfully | | | MEDIUM | MINOR | | |
| TC-DEPT-005 | Delete Empty Department | ADMIN; no employees | 1. Delete dept with no employees | Deleted successfully | | | MEDIUM | MINOR | | |
| TC-DEPT-006 | Delete Department with Employees | ADMIN | 1. Try to delete dept with active employees | Error: cannot delete department with employees | | | HIGH | MAJOR | | |
| TC-DEPT-007 | EMPLOYEE Cannot Access | EMPLOYEE logged in | 1. Navigate to /departments | Access denied or link not in sidebar | | | HIGH | MAJOR | | |

---

## MODULE 12 — Email Templates & Broadcaster

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TMPL-001 | View Templates Page | ADMIN/HR | 1. Go to /templates | Template list displayed | | | MEDIUM | MINOR | | |
| TC-TMPL-002 | Create Email Template | Admin | 1. Click New 2. Enter subject and body 3. Save | Template saved; available for broadcaster | | | MEDIUM | MINOR | | |
| TC-TMPL-003 | Edit Template | Existing template | 1. Click Edit 2. Modify body 3. Save | Updated correctly | | | MEDIUM | MINOR | | |
| TC-TMPL-004 | Delete Template | Existing template | 1. Click Delete 2. Confirm | Removed from list | | | MEDIUM | MINOR | | |
| TC-TMPL-005 | Email Broadcaster Send | ADMIN/HR | 1. Go to /email-broadcaster 2. Select recipients 3. Choose template 4. Send | Emails dispatched to all recipients | | | HIGH | MAJOR | | |
| TC-TMPL-006 | Broadcast No Recipients | Broadcaster page | 1. Click Send without selecting recipients | Validation error: select at least one recipient | | | HIGH | MAJOR | | |

---

## MODULE 13 — Role-Based Access Control (RBAC)

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-RBAC-001 | EMPLOYEE No Shifts Access | EMPLOYEE logged in | 1. Navigate to /shifts | Access denied; not in sidebar | | | CRITICAL | BLOCKER | | |
| TC-RBAC-002 | EMPLOYEE No Payroll Management | EMPLOYEE logged in | 1. Navigate to /payroll | Only own published payslips shown; no generate/publish button | | | CRITICAL | BLOCKER | | |
| TC-RBAC-003 | EMPLOYEE No Departments Access | EMPLOYEE logged in | 1. Navigate to /departments | Redirect or 403 | | | HIGH | MAJOR | | |
| TC-RBAC-004 | HR Can Approve Leaves | HR logged in | 1. Go to Leaves Approvals | Approve button visible and functional | | | CRITICAL | BLOCKER | | |
| TC-RBAC-005 | ADMIN Full Access | ADMIN logged in | 1. Navigate all routes | All routes accessible without restriction | | | CRITICAL | BLOCKER | | |
| TC-RBAC-006 | EMPLOYEE Cannot Edit Other Profile | EMPLOYEE logged in | 1. View another employee profile | Edit button not visible | | | CRITICAL | BLOCKER | | |
| TC-RBAC-007 | API Without Token | No Authorization header | 1. Call GET /api/employees without token | 401 Unauthorized response | | | CRITICAL | BLOCKER | | |
| TC-RBAC-008 | EMPLOYEE Token on Admin API | EMPLOYEE JWT | 1. Call DELETE /api/employees/1 with employee token | 403 Forbidden response | | | CRITICAL | BLOCKER | | |

---

## MODULE 14 — UI/UX & General

### 14.1 Visual & Usability

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-UI-001 | Theme Consistency | Any page | 1. Review color theme across all pages | Consistent dark/blue theme throughout | | | MEDIUM | MINOR | | |
| TC-UI-002 | Loading States | Slow network | 1. Throttle to Slow 3G 2. Navigate pages | Skeleton loaders or spinners shown during load | | | MEDIUM | MINOR | | |
| TC-UI-003 | Error States | Backend unavailable | 1. Turn off backend 2. Load dashboard | User-friendly error message shown; not raw error/JSON | | | HIGH | MAJOR | | |
| TC-UI-004 | Toast Notifications | Any save/delete action | 1. Perform save action | Toast appears and auto-dismisses after ~3 seconds | | | MEDIUM | MINOR | | |
| TC-UI-005 | Modal Close via Escape | Any modal open | 1. Open modal 2. Press Escape key | Modal closes | | | MEDIUM | MINOR | | |
| TC-UI-006 | Modal Close via Outside Click | Any modal open | 1. Click outside modal area | Modal closes | | | MEDIUM | MINOR | | |
| TC-UI-007 | Confirmation Dialog on Delete | Any delete action | 1. Click delete on any item | Confirmation dialog appears before execution | | | HIGH | MAJOR | | |
| TC-UI-008 | Empty State Messages | List with no data | 1. View a section with no records | Empty state message shown; not blank screen | | | MEDIUM | MINOR | | |
| TC-UI-009 | Table Column Sort | Any sortable table | 1. Click column header | Records sort ascending; click again = descending | | | MEDIUM | MINOR | | |
| TC-UI-010 | Search Clear | Search input used | 1. Enter search text 2. Clear the field | All records return when cleared | | | MEDIUM | MINOR | | |
| TC-UI-011 | Form Reset on Cancel | Edit modal | 1. Open edit 2. Change fields 3. Click Cancel | Original values restored; no dirty state | | | HIGH | MAJOR | | |
| TC-UI-012 | Responsive Tablet | Browser devtools | 1. Resize to 768px width | Layout adapts; no horizontal overflow | | | MEDIUM | MINOR | | |
| TC-UI-013 | Responsive Mobile | Browser devtools | 1. Resize to 375px width | Core layout still usable without overlap | | | LOW | TRIVIAL | | |

### 14.2 Browser Compatibility

| TC-ID | Browser | Test Steps | Expected Result | Actual Result | Status | Remarks |
|---|---|---|---|---|---|---|
| TC-BROWSER-001 | Chrome (latest) | 1. Run full core user flow | All features work correctly | | | |
| TC-BROWSER-002 | Firefox (latest) | 1. Run full core user flow | All features work correctly | | | |
| TC-BROWSER-003 | Microsoft Edge (latest) | 1. Run full core user flow | All features work correctly | | | |
| TC-BROWSER-004 | Safari (if available) | 1. Run core flows | All features work correctly | | | |

### 14.3 Performance Observations

| TC-ID | Scenario | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| TC-PERF-001 | Initial Page Load | 1. Hard refresh dashboard | Page fully interactive in under 3 seconds | | |
| TC-PERF-002 | Large Employee List | 1. Load directory with 50+ employees | Renders within 2 seconds | | |
| TC-PERF-003 | Full Year Attendance History | 1. Load an employee's full-year attendance | No freezing; smooth scroll | | |
| TC-PERF-004 | Payroll Generation | 1. Generate payroll for all employees | Completes within 10 seconds | | |
| TC-PERF-005 | Rapid Search Typing | 1. Type quickly in any search box | No UI stutter or lag | | |

---

## MODULE 15 — Data Integrity & Security

| TC-ID | Feature | Preconditions | Test Steps | Expected Result | Actual Result | Status | Priority | Severity | Bug ID | Remarks |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-DATA-001 | IST Timezone Accuracy | Any attendance record | 1. Check attendance date/time values | Dates and times reflect IST correctly; not UTC | | | CRITICAL | BLOCKER | | |
| TC-DATA-002 | Balance Restored on Cancel | Approved leave cancelled | 1. Cancel approved leave 2. Check balance | Balance restored correctly | | | HIGH | MAJOR | | |
| TC-DATA-003 | Payroll Reflects Regularization | Regularization approved | 1. Approve regularization 2. Regenerate payroll | Payroll reflects corrected attendance data | | | HIGH | MAJOR | | |
| TC-DATA-004 | Concurrent Check-In | Same account; two tabs | 1. Try to check in from two browser tabs at once | Only one check-in succeeds | | | HIGH | MAJOR | | |
| TC-DATA-005 | XSS Prevention | Any text input field | 1. Enter script tag: alert('xss') in any field | Input escaped; no script executed | | | CRITICAL | BLOCKER | | |
| TC-DATA-006 | SQL Injection Prevention | Any search or form input | 1. Enter ' OR 1=1 -- in search | Input sanitized; no DB error or data leak | | | CRITICAL | BLOCKER | | |
| TC-DATA-007 | Long Text Input | Any reason/description field | 1. Paste 1000+ characters | Either truncated or max-length validation shown | | | MEDIUM | MINOR | | |
| TC-DATA-008 | Special Characters in Name | Employee name field | 1. Enter name with / & and quotes | Saved and displayed correctly without layout break | | | MEDIUM | MINOR | | |

---

## Regression Checklist

Run this checklist after every deployment or bug fix:

- [ ] Login works for all four roles (ADMIN, HR, MANAGER, EMPLOYEE)
- [ ] Dashboard loads correctly with role-specific data
- [ ] Check-In and Check-Out work end-to-end
- [ ] Breaks start and end correctly; AWAY status reflects
- [ ] Leave application and approval/rejection workflow complete
- [ ] Leave balances deduct on approval and restore on cancellation
- [ ] Payroll generation and publishing work correctly
- [ ] Employee sees only published payslips; draft hidden
- [ ] Attendance history shows correct Off Days on weekends
- [ ] Calendar exceptions load dynamically when month changes
- [ ] Create/Edit/Deactivate employee works without error
- [ ] Shift creation and assignment updates clocking rules
- [ ] Notifications appear for key events (leave approval, task assignment)
- [ ] RBAC blocks unauthorized access at UI and API level
- [ ] No console errors during normal navigation
- [ ] TypeScript build passes with 0 errors (npm run lint in backend)

---

## Test Summary

| Metric | Count |
|---|---|
| Total Test Cases | 173 |
| Executed | |
| Passed | |
| Failed | |
| Skipped/Blocked | |
| Pass Rate | |
| Critical Blockers Found | |
| Major Issues Found | |

---

## Test Credentials

| Role | Email | Password |
|---|---|---|
| EMPLOYEE (Test) | testuser@intellisys.com | Test@1234 |
| ADMIN | (use existing admin) | (existing password) |
| HR | (use existing HR) | (existing password) |
| MANAGER | (use existing manager) | (existing password) |

*HRMS Manual Testing Plan v1.0 — Pre-Production QA Checklist*

