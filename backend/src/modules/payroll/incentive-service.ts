import { IncentiveStatus, IncentiveType } from "@prisma/client";

export function getIncentiveTypeDisplay(type: IncentiveType) {
  switch (type) {
    case IncentiveType.PERFORMANCE_BONUS:
      return "Performance Bonus";
    case IncentiveType.PROJECT_BONUS:
      return "Project Bonus";
    case IncentiveType.REFERRAL_BONUS:
      return "Referral Bonus";
    case IncentiveType.ATTENDANCE_BONUS:
      return "Attendance Bonus";
    case IncentiveType.SPECIAL_ACHIEVEMENT:
      return "Special Achievement";
    case IncentiveType.OTHER:
      return "Other";
    default:
      return "Unknown";
  }
}

export function getIncentiveStatusDisplay(status: IncentiveStatus) {
  switch (status) {
    case IncentiveStatus.PENDING:
      return "Pending";
    case IncentiveStatus.APPROVED:
      return "Approved";
    case IncentiveStatus.REJECTED:
      return "Rejected";
    case IncentiveStatus.PAID:
      return "Paid";
    default:
      return "Unknown";
  }
}

export function calculateMonthlyIncentives(
  incentives: Array<{ amount: number | { toNumber: () => number }; status: any }>
): number {
  const approvedIncentives = incentives.filter(
    incentive => incentive.status === "APPROVED" || incentive.status === "PAID"
  );
  
  const totalAmount = approvedIncentives.reduce((sum, incentive) => {
    const amount = typeof incentive.amount === 'number' ? incentive.amount : incentive.amount.toNumber();
    return sum + amount;
  }, 0);
  return Math.round((totalAmount + Number.EPSILON) * 100) / 100;
}

export function calculateTotalPayrollWithIncentives(
  baseSalary: number,
  incentives: Array<{ amount: number | { toNumber: () => number }; status: any }>
): {
  baseSalary: number;
  totalIncentives: number;
  grossSalary: number;
} {
  const totalIncentives = calculateMonthlyIncentives(incentives);
  const grossSalary = baseSalary + totalIncentives;
  
  return {
    baseSalary: Math.round((baseSalary + Number.EPSILON) * 100) / 100,
    totalIncentives,
    grossSalary: Math.round((grossSalary + Number.EPSILON) * 100) / 100,
  };
}
