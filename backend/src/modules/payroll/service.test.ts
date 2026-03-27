import assert from "node:assert/strict";
import test from "node:test";
import { PayrollStatus } from "@prisma/client";
import { AppError } from "../../utils/api.js";
import { assertPayrollEditable, calculateCompensationFromLpa, calculatePayrollBreakdown, calculatePayrollPreview } from "./service.js";

test("assertPayrollEditable allows draft payroll", () => {
  assert.doesNotThrow(() => assertPayrollEditable(PayrollStatus.DRAFT));
});

test("assertPayrollEditable rejects finalized payroll", () => {
  assert.throws(
    () => assertPayrollEditable(PayrollStatus.FINALIZED),
    (error: unknown) => error instanceof AppError && error.message === "Finalized payroll records cannot be updated",
  );
});

test("calculateCompensationFromLpa derives gross and basic salary", () => {
  assert.deepEqual(calculateCompensationFromLpa(12), {
    annualPackageLpa: 12,
    grossMonthlySalary: 1,
    basicMonthlySalary: 0.5,
  });
});

test("calculatePayrollBreakdown applies PF, gratuity, PT, and net salary formula", () => {
  assert.deepEqual(calculatePayrollBreakdown(1, 0.5, 3), {
    pf: 0.06,
    gratuity: 0.02,
    pt: 300,
    netSalary: -299.08,
    perDaySalary: -9.97,
    perHourSalary: -1.11,
  });
});

test("calculatePayrollPreview applies absent-day deduction on top of net salary", () => {
  assert.deepEqual(calculatePayrollPreview({
    grossMonthlySalary: 60000,
    basicMonthlySalary: 30000,
    month: 3,
    deductibleDays: 2,
  }), {
    pf: 3600,
    gratuity: 1443,
    pt: 300,
    netSalary: 54657,
    perDaySalary: 1821.9,
    perHourSalary: 202.43,
    deductibleDays: 2,
    deductionAmount: 3643.8,
    finalSalaryBeforeProbation: 51013.2,
    probationMultiplier: 1,
    probationAdjustedSalary: 51013.2,
    finalSalary: 51013.2,
  });
});

test("calculatePayrollPreview applies 50 percent probation adjustment at final salary stage", () => {
  assert.deepEqual(calculatePayrollPreview({
    grossMonthlySalary: 60000,
    basicMonthlySalary: 30000,
    month: 3,
    deductibleDays: 2,
    isOnProbation: true,
  }), {
    pf: 3600,
    gratuity: 1443,
    pt: 300,
    netSalary: 54657,
    perDaySalary: 1821.9,
    perHourSalary: 202.43,
    deductibleDays: 2,
    deductionAmount: 3643.8,
    finalSalaryBeforeProbation: 51013.2,
    probationMultiplier: 0.5,
    probationAdjustedSalary: 25506.6,
    finalSalary: 25506.6,
  });
});
