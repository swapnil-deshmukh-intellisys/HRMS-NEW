import assert from "node:assert/strict";
import test from "node:test";
import { PayrollStatus } from "@prisma/client";
import { AppError } from "../../utils/api.js";
import { assertPayrollEditable } from "./service.js";

test("assertPayrollEditable allows draft payroll", () => {
  assert.doesNotThrow(() => assertPayrollEditable(PayrollStatus.DRAFT));
});

test("assertPayrollEditable rejects finalized payroll", () => {
  assert.throws(
    () => assertPayrollEditable(PayrollStatus.FINALIZED),
    (error: unknown) => error instanceof AppError && error.message === "Finalized payroll records cannot be updated",
  );
});
