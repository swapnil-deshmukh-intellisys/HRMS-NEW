export type Role = "ADMIN" | "HR" | "MANAGER" | "EMPLOYEE";

export type SessionUser = {
  id: number;
  email: string;
  role: Role;
  employee?: Employee | null;
};

export type Department = {
  id: number;
  name: string;
  code: string;
};

export type Employee = {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
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
};

export type LeaveType = {
  id: number;
  name: string;
  code: string;
  defaultDaysPerYear: number;
};

export type LeaveBalance = {
  id: number;
  year: number;
  allocatedDays: number;
  usedDays: number;
  remainingDays: number;
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
  attachmentName?: string | null;
  attachmentPath?: string | null;
  attachmentMime?: string | null;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  approvedAt?: string | null;
  rejectionReason?: string | null;
  employee: Employee;
  leaveType: LeaveType;
  approvedBy?: Employee | null;
};

export type Attendance = {
  id: number;
  employeeId: number;
  attendanceDate: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  workedMinutes: number;
  status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE";
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

export type PayrollRecord = {
  id: number;
  employeeId: number;
  month: number;
  year: number;
  salary: string;
  status: "DRAFT" | "FINALIZED";
  employee?: Employee;
};
