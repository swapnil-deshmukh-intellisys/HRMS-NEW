import type { EmployeeFormValues } from "./EmployeeForm";

export const createInitialEmployeeForm = (): EmployeeFormValues => ({
  email: "",
  password: "Password@123",
  role: "EMPLOYEE",
  employeeCode: "",
  firstName: "",
  lastName: "",
  phone: "",
  departmentId: "",
  managerId: "",
  joiningDate: new Date().toISOString().slice(0, 16),
  employmentStatus: "ACTIVE",
});
