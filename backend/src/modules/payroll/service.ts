import { PayrollStatus } from "@prisma/client";
import { AppError } from "../../utils/api.js";

export function assertPayrollEditable(status: PayrollStatus) {
  if (status === PayrollStatus.FINALIZED) {
    throw new AppError("Finalized payroll records cannot be updated", 400);
  }
}
