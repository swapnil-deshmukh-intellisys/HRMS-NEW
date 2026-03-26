import type { EmployeeFormValues } from "./EmployeeForm";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function createDefaultJoiningDateInput() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T10:00`;
}

export function serializeLocalDateTime(value: string) {
  const [datePart, timePart = "00:00"] = value.split("T");
  return `${datePart}T${timePart}:00.000Z`;
}

export function formatStoredDateTimeForInput(value: string) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export const createInitialEmployeeForm = (): EmployeeFormValues => ({
  email: "",
  password: "Password@123",
  role: "EMPLOYEE",
  employeeCode: "",
  firstName: "",
  lastName: "",
  jobTitle: "Software Developer",
  phone: "",
  departmentId: "",
  managerId: "",
  joiningDate: createDefaultJoiningDateInput(),
  employmentStatus: "ACTIVE",
  isTeamLead: false,
  teamLeadScopeIds: [],
});
