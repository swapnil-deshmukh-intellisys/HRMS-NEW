export type Role = "ADMIN" | "HR" | "MANAGER" | "EMPLOYEE";

export type SessionUser = {
  id: number;
  email: string;
  role: Role;
  employee?: Employee | null;
};

export type AuthLoginResponse = {
  token: string;
  user: SessionUser;
};

export type Department = {
  id: number;
  name: string;
  code: string;
};

export type CalendarException = {
  id: number;
  date: string;
  type: "HOLIDAY" | "WORKING_SATURDAY";
  name?: string | null;
  description?: string | null;
  createdById: number;
  createdAt: string;
  updatedAt: string;
};

export type CalendarDay = {
  date: string;
  dayNumber: number;
  weekday: number;
  status: "WORKING" | "OFF" | "HOLIDAY" | "WORKING_SATURDAY";
  isWorkingDay: boolean;
  isPaidDay: boolean;
  exception: CalendarException | null;
};

export type Employee = {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
  phone?: string | null;
  annualPackageLpa?: number | null;
  grossMonthlySalary?: number | null;
  basicMonthlySalary?: number | null;
  isOnProbation?: boolean;
  probationEndDate?: string | null;
  departmentId: number;
  managerId?: number | null;
  joiningDate: string;
  employmentStatus: "ACTIVE" | "INACTIVE" | "TERMINATED";
  isActive: boolean;
  department?: Department;
  manager?: Employee | null;
  user?: {
    email: string;
    role: {
      name: Role;
    };
  };
  capabilities?: Array<{
    capability: "TEAM_LEAD";
  }>;
  scopedTeamMembers?: Array<{
    employee: Employee;
  }>;
};

export type LeaveType = {
  id: number;
  name: string;
  code: string;
  defaultDaysPerYear: number;
  allocationMode?: "YEARLY" | "QUARTERLY";
  quarterlyAllocationDays?: number | null;
  carryForwardAllowed?: boolean;
  carryForwardCap?: number | null;
  requiresAttachmentAfterDays?: number | null;
  deductFullQuotaOnApproval?: boolean;
  maxUsagesPerYear?: number | null;
  policyEffectiveFromYear?: number | null;
};

export type LeaveBalance = {
  id: number;
  year: number;
  allocatedDays: number;
  usedDays: number;
  remainingDays: number;
  visibleDays: number;
  carryForwardDays: number;
  lastQuarterProcessed?: number | null;
  leaveType: LeaveType;
};

export type LeaveRequest = {
  id: number;
  startDate: string;
  endDate: string;
  startDayDuration: "FULL_DAY" | "HALF_DAY";
  endDayDuration: "FULL_DAY" | "HALF_DAY";
  totalDays: number;
  paidDays: number;
  unpaidDays: number;
  isUnpaid: boolean;
  deductedDays?: number | null;
  fullQuotaDeducted?: boolean;
  attachmentName?: string | null;
  attachmentPath?: string | null;
  attachmentMime?: string | null;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  managerApprovalStatus: "PENDING" | "APPROVED" | "REJECTED";
  managerApprovedAt?: string | null;
  managerRejectionReason?: string | null;
  hrApprovalStatus: "PENDING" | "APPROVED" | "REJECTED";
  hrApprovedAt?: string | null;
  hrRejectionReason?: string | null;
  employee: Employee;
  leaveType: LeaveType;
  managerApprovedBy?: Employee | null;
  hrApprovedBy?: Employee | null;
};

export type Attendance = {
  id: number;
  employeeId: number;
  attendanceDate: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  workedMinutes: number;
  status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE";
  leaveTypeCode?: string | null;
  leaveTypeName?: string | null;
  employee?: Employee;
};

export type AttendanceRegularizationRequest = {
  id: number;
  employeeId: number;
  attendanceDate: string;
  proposedCheckInTime?: string | null;
  proposedCheckOutTime?: string | null;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  employee: Employee;
  reviewedBy?: Employee | null;
};

export type EmployeeDashboardData = {
  attendanceToday: Attendance | null;
  pendingLeaves: number;
  payrollCount: number;
  isTeamLead: boolean;
  scopedTeamCount: number;
  pendingTeamLeaves: number;
  attendanceRecords: Attendance[];
  calendarDays: CalendarDay[];
  currentEmployee: Employee | null;
  leaveBalances: LeaveBalance[];
  leaveRequests: LeaveRequest[];
};

export type EmployeeDashboardSummaryData = {
  attendanceToday: Attendance | null;
  pendingLeaves: number;
  payrollCount: number;
  isTeamLead: boolean;
  scopedTeamCount: number;
  pendingTeamLeaves: number;
  currentEmployee: Employee | null;
  leaveBalances: LeaveBalance[];
  leaveRequests: LeaveRequest[];
};

export type PayrollRecord = {
  id: number;
  employeeId: number;
  month: number;
  year: number;
  salary: string;
  status: "DRAFT" | "FINALIZED";
  employee?: Employee;
};
