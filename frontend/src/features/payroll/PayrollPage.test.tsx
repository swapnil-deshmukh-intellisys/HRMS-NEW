import "../../test/setup";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import PayrollPage from "./PayrollPage";
import { mockApiRoutes } from "../../test/api";
import { createEmployee, createPayrollRecord } from "../../test/fixtures";

describe("PayrollPage", () => {
  test("shows the HR payroll creation surface and preview details", async () => {
    const user = userEvent.setup();
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    mockApiRoutes([
      {
        path: `/payroll/preview?employeeId=1&month=${month}&year=${year}`,
        data: {
          employee: createEmployee(),
          month,
          year,
          pf: 1200,
          gratuity: 500,
          pt: 200,
          netSalary: 54000,
          perDaySalary: 1800,
          perHourSalary: 225,
          absentDeductionDays: 0,
          halfDayDeductionDays: 0,
          deductibleDays: 0,
          deductionAmount: 0,
          finalSalaryBeforeProbation: 54000,
          probationMultiplier: 1,
          probationAdjustedSalary: 54000,
          finalSalary: 54000,
        },
      },
      { path: "/payroll", data: [] },
      { path: "/employees?limit=100", data: { items: [createEmployee()] } },
    ]);

    render(<PayrollPage token="token" role="HR" />);

    expect(await screen.findByText("Create payroll record")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /select employee/i }));
    await user.click(screen.getByRole("button", { name: /taylor flint/i }));

    await waitFor(() => {
      expect(screen.getByText("Final salary")).toBeInTheDocument();
    });
  });

  test("hides payroll editing controls for employees", async () => {
    mockApiRoutes([
      { path: "/payroll", data: [createPayrollRecord()] },
    ]);

    render(<PayrollPage token="token" role="EMPLOYEE" />);

    expect(await screen.findByText("Payroll records")).toBeInTheDocument();
    expect(screen.queryByText("Create payroll record")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
  });
});
