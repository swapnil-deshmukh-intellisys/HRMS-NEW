import { PayrollStatus } from "@prisma/client";
import { AppError } from "../../utils/api.js";

export function assertPayrollEditable(status: PayrollStatus) {
  if (status === PayrollStatus.FINALIZED) {
    throw new AppError("Finalized payroll records cannot be updated", 400);
  }
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateCompensationFromLpa(annualPackageLpa: number) {
  const grossMonthlySalary = roundCurrency(annualPackageLpa / 12);
  const basicMonthlySalary = roundCurrency(grossMonthlySalary / 2);

  return {
    annualPackageLpa: roundCurrency(annualPackageLpa),
    grossMonthlySalary,
    basicMonthlySalary,
  };
}

export function calculatePayrollBreakdown(grossMonthlySalary: number, basicMonthlySalary: number, month: number) {
  const pf = roundCurrency(0.12 * basicMonthlySalary);
  const gratuity = roundCurrency(0.0481 * basicMonthlySalary);
  const pt = month === 3 ? 300 : 200;
  const netSalary = roundCurrency(grossMonthlySalary - pf - gratuity - pt);
  const perDaySalary = roundCurrency(netSalary / 30);
  const perHourSalary = roundCurrency(perDaySalary / 9);

  return {
    pf,
    gratuity,
    pt,
    netSalary,
    perDaySalary,
    perHourSalary,
  };
}

export function calculatePayrollPreview(input: {
  grossMonthlySalary: number;
  basicMonthlySalary: number;
  month: number;
  absentDeductionDays?: number;
  halfDayDeductionDays?: number;
  deductibleDays: number;
  isOnProbation?: boolean;
}) {
  const breakdown = calculatePayrollBreakdown(input.grossMonthlySalary, input.basicMonthlySalary, input.month);
  const deductionAmount = roundCurrency(breakdown.perDaySalary * input.deductibleDays);
  const finalSalaryBeforeProbation = roundCurrency(breakdown.netSalary - deductionAmount);
  const probationMultiplier = input.isOnProbation ? 0.5 : 1;
  const probationAdjustedSalary = roundCurrency(finalSalaryBeforeProbation * probationMultiplier);
  const finalSalary = probationAdjustedSalary;

  return {
    ...breakdown,
    absentDeductionDays: input.absentDeductionDays ?? input.deductibleDays,
    halfDayDeductionDays: input.halfDayDeductionDays ?? 0,
    deductibleDays: input.deductibleDays,
    deductionAmount,
    finalSalaryBeforeProbation,
    probationMultiplier,
    probationAdjustedSalary,
    finalSalary,
  };
}
