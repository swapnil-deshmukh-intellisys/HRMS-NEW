import type {
  Attendance,
  CalendarDay,
  Department,
  Employee,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  PayrollRecord,
  SessionUser,
} from "../types";

export function createDepartment(overrides: Partial<Department> = {}): Department {
  return {
    id: 1,
    name: "Software Development",
    code: "SD",
    ...overrides,
  };
}

export function createEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 1,
    employeeCode: "EMP-001",
    firstName: "Taylor",
    lastName: "Flint",
    departmentId: 1,
    joiningDate: "2026-01-10T09:00:00.000Z",
    employmentStatus: "ACTIVE",
    isActive: true,
    department: createDepartment(),
    user: {
      email: "taylor@example.com",
      role: { name: "EMPLOYEE" },
    },
    capabilities: [],
    scopedTeamMembers: [],
    ...overrides,
  };
}

export function createSessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 1,
    email: "taylor@example.com",
    role: "EMPLOYEE",
    employee: createEmployee(),
    ...overrides,
  };
}

export function createLeaveType(overrides: Partial<LeaveType> = {}): LeaveType {
  return {
    id: 1,
    name: "Casual Leave",
    code: "CL",
    defaultDaysPerYear: 12,
    allocationMode: "QUARTERLY",
    quarterlyAllocationDays: 3,
    carryForwardAllowed: false,
    carryForwardCap: null,
    requiresAttachmentAfterDays: null,
    deductFullQuotaOnApproval: false,
    maxUsagesPerYear: null,
    policyEffectiveFromYear: 2026,
    ...overrides,
  };
}

export function createLeaveBalance(overrides: Partial<LeaveBalance> = {}): LeaveBalance {
  return {
    id: 1,
    year: 2026,
    allocatedDays: 12,
    usedDays: 2,
    remainingDays: 10,
    visibleDays: 3,
    carryForwardDays: 0,
    lastQuarterProcessed: 2,
    leaveType: createLeaveType(),
    ...overrides,
  };
}

export function createLeaveRequest(overrides: Partial<LeaveRequest> = {}): LeaveRequest {
  return {
    id: 1,
    startDate: "2026-04-10T00:00:00.000Z",
    endDate: "2026-04-10T00:00:00.000Z",
    startDayDuration: "FULL_DAY",
    endDayDuration: "FULL_DAY",
    totalDays: 1,
    paidDays: 1,
    unpaidDays: 0,
    isUnpaid: false,
    deductedDays: 1,
    fullQuotaDeducted: false,
    attachmentName: null,
    attachmentPath: null,
    attachmentMime: null,
    reason: "Personal work",
    status: "PENDING",
    managerApprovalStatus: "PENDING",
    managerApprovedAt: null,
    managerRejectionReason: null,
    hrApprovalStatus: "PENDING",
    hrApprovedAt: null,
    hrRejectionReason: null,
    employee: createEmployee(),
    leaveType: createLeaveType(),
    managerApprovedBy: null,
    hrApprovedBy: null,
    ...overrides,
  };
}

export function createAttendance(overrides: Partial<Attendance> = {}): Attendance {
  return {
    id: 1,
    employeeId: 1,
    attendanceDate: "2026-04-09T00:00:00.000Z",
    checkInTime: "2026-04-09T09:03:00.000Z",
    checkOutTime: "2026-04-09T18:01:00.000Z",
    workedMinutes: 538,
    status: "PRESENT",
    leaveTypeCode: null,
    leaveTypeName: null,
    employee: createEmployee(),
    ...overrides,
  };
}

export function createCalendarDay(overrides: Partial<CalendarDay> = {}): CalendarDay {
  return {
    date: "2026-04-01T00:00:00.000Z",
    dayNumber: 1,
    weekday: 3,
    status: "WORKING",
    isWorkingDay: true,
    isPaidDay: true,
    exception: null,
    ...overrides,
  };
}

export function createPayrollRecord(overrides: Partial<PayrollRecord> = {}): PayrollRecord {
  return {
    id: 1,
    employeeId: 1,
    month: 4,
    year: 2026,
    salary: "54000",
    status: "DRAFT",
    employee: createEmployee(),
    ...overrides,
  };
}
