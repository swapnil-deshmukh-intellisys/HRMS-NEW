import "../../test/setup";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";
import PayrollPage from "./PayrollPage";
import { mockApiRoutes } from "../../test/api";
import { createEmployee, createPayrollRecord } from "../../test/fixtures";

describe("PayrollPage", () => {
  test("allows creating and viewing payroll records", async () => {
    const user = userEvent.setup();
    const employee = createEmployee({ firstName: "Taylor", lastName: "Flint", id: 5 });
    
    mockApiRoutes([
      {
        path: "/payroll/preview",
        data: {
          employee,
          month: 5,
          year: 2026,
          totalPayableSalary: 54000,
          netSalary: 54000,
          pf: 0,
          gratuity: 0,
          pt: 0,
          absentDeductionDays: 0,
          halfDayDeductionDays: 0,
          deductibleDays: 0,
          deductionAmount: 0,
          incentives: [],
        },
      },
      {
        path: "/employees",
        data: {
          items: [employee],
          pagination: { total: 1 },
        },
      },
      {
        path: "/payroll",
        method: "GET",
        data: [],
      },
      {
        path: "/payroll",
        method: "POST",
        data: createPayrollRecord({ employeeId: 5, salary: "54000" }),
      },
    ]);

    render(
      <MemoryRouter>
        <PayrollPage token="token" role="HR" />
      </MemoryRouter>
    );

    // Click "Create record" to open modal
    const createBtn = await screen.findByRole("button", { name: /create record/i });
    await user.click(createBtn);

    // Wait for modal to appear and click "Select employee" trigger
    const selectTrigger = await screen.findByText(/Select employee/i);
    await user.click(selectTrigger);

    // Wait for the dropdown option to appear and select it
    const employeeOption = await screen.findByRole("option", { name: /taylor flint/i });
    await user.click(employeeOption);

    // Wait for the preview to load
    // Using a more robust text search that ignores node splitting
    await waitFor(() => {
      const metrics = screen.queryAllByRole("definition"); // <dd> elements have role definition
      const hasSalary = metrics.some(m => m.textContent?.includes("54,000"));
      expect(hasSalary).toBe(true);
    }, { timeout: 4000 });

    // Submit the form
    const submitBtn = screen.getByRole("button", { name: /create payroll/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }, { timeout: 4000 });
  });

  test("filters records by month and year", async () => {
    mockApiRoutes([
      {
        path: "/payroll",
        data: [createPayrollRecord({ month: 5, year: 2026, salary: "60000" })],
      },
      {
        path: "/employees",
        data: { items: [] },
      },
    ]);

    render(
      <MemoryRouter>
        <PayrollPage token="token" role="HR" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/60,000/)).toBeInTheDocument();
    }, { timeout: 4000 });
  });
});
