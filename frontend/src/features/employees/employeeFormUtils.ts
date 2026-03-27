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

export function formatStoredDateForInput(value: string) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateCompensationPreview(annualPackageLpa: string, month = new Date().getMonth() + 1) {
  const parsedLpa = Number(annualPackageLpa);

  if (!Number.isFinite(parsedLpa) || parsedLpa <= 0) {
    return null;
  }

  const grossMonthlySalary = roundCurrency(parsedLpa / 12);
  const basicMonthlySalary = roundCurrency(grossMonthlySalary / 2);
  const pf = roundCurrency(0.12 * basicMonthlySalary);
  const gratuity = roundCurrency(0.0481 * basicMonthlySalary);
  const pt = month === 3 ? 300 : 200;
  const netSalary = roundCurrency(grossMonthlySalary - pf - gratuity - pt);
  const perDaySalary = roundCurrency(netSalary / 30);
  const perHourSalary = roundCurrency(perDaySalary / 9);

  return {
    grossMonthlySalary,
    basicMonthlySalary,
    pf,
    gratuity,
    pt,
    netSalary,
    perDaySalary,
    perHourSalary,
  };
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
  annualPackageLpa: "",
  isOnProbation: false,
  probationEndDate: "",
  departmentId: "",
  managerId: "",
  joiningDate: createDefaultJoiningDateInput(),
  employmentStatus: "ACTIVE",
  isTeamLead: false,
  teamLeadScopeIds: [],
});
