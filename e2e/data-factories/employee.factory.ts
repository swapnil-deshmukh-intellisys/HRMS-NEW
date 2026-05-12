/**
 * data-factories/employee.factory.ts
 *
 * Generates unique, realistic test employee data using @faker-js/faker.
 * Every call produces a unique email to prevent DB collisions between test runs.
 */

import { faker } from "@faker-js/faker";

export type EmployeeFactoryOverrides = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  employeeCode?: string;
  departmentId?: number;
  role?: "EMPLOYEE" | "MANAGER" | "HR" | "ADMIN";
  jobTitle?: string;
  joiningDate?: string;
  employmentStatus?: "ACTIVE" | "INACTIVE" | "TERMINATED";
  annualPackageLpa?: number;
};

export type EmployeePayload = Required<
  Pick<EmployeeFactoryOverrides, "firstName" | "lastName" | "email" | "password" | "employeeCode" | "departmentId" | "role" | "joiningDate" | "employmentStatus">
> & Omit<EmployeeFactoryOverrides, "firstName" | "lastName" | "email" | "password" | "employeeCode" | "departmentId" | "role" | "joiningDate" | "employmentStatus">;

/**
 * Build a new unique employee payload.
 * Pass overrides to fix specific fields (e.g., to test a specific role).
 *
 * @example
 * const emp = buildEmployee({ role: "MANAGER", departmentId: 2 });
 */
export function buildEmployee(overrides: EmployeeFactoryOverrides = {}): EmployeePayload {
  const firstName = overrides.firstName ?? faker.person.firstName();
  const lastName  = overrides.lastName  ?? faker.person.lastName();

  // Unique email: timestamp + random suffix prevents collisions in parallel runs
  const uniqueSuffix = `${Date.now()}-${faker.string.alphanumeric(4).toLowerCase()}`;
  const email = overrides.email ?? `test.${firstName.toLowerCase()}.${uniqueSuffix}@e2e.test`;

  const employeeCode = overrides.employeeCode ?? `TEST-${faker.string.alphanumeric(5).toUpperCase()}`;

  return {
    firstName,
    lastName,
    email,
    password:          overrides.password          ?? "Test@1234",
    employeeCode,
    departmentId:      overrides.departmentId      ?? 1,
    role:              overrides.role              ?? "EMPLOYEE",
    jobTitle:          overrides.jobTitle          ?? faker.person.jobTitle(),
    joiningDate:       overrides.joiningDate       ?? new Date().toISOString(),
    employmentStatus:  overrides.employmentStatus  ?? "ACTIVE",
    annualPackageLpa:  overrides.annualPackageLpa  ?? Number(faker.finance.amount({ min: 3, max: 15, dec: 2 })),
  };
}

/**
 * Build a batch of unique employees.
 *
 * @example
 * const employees = buildEmployees(5, { departmentId: 3 });
 */
export function buildEmployees(count: number, overrides: EmployeeFactoryOverrides = {}): EmployeePayload[] {
  return Array.from({ length: count }, () => buildEmployee(overrides));
}

/**
 * Build a future date string (YYYY-MM-DD) N days from today.
 * Useful for leave application tests.
 */
export function futureDateString(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split("T")[0];
}

/**
 * Build a past date string (YYYY-MM-DD) N days before today.
 */
export function pastDateString(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split("T")[0];
}

/**
 * Build a leave application payload.
 */
export function buildLeavePayload(overrides: {
  leaveTypeId?: number;
  startDate?: string;
  endDate?: string;
  reason?: string;
} = {}) {
  const startDate = overrides.startDate ?? futureDateString(3);
  const endDate   = overrides.endDate   ?? startDate;
  return {
    leaveTypeId:       overrides.leaveTypeId ?? 1,
    startDate,
    endDate,
    startDayDuration:  "FULL_DAY",
    endDayDuration:    "FULL_DAY",
    reason:            overrides.reason ?? faker.lorem.sentence(),
  };
}
