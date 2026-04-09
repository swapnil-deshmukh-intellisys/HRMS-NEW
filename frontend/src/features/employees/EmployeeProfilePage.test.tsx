import "../../test/setup";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import EmployeeProfilePage from "./EmployeeProfilePage";
import { mockApiRoutes } from "../../test/api";
import { createAttendance, createEmployee, createLeaveBalance, createLeaveRequest } from "../../test/fixtures";
import { renderWithRoute } from "../../test/utils";

describe("EmployeeProfilePage", () => {
  test("hides the payroll tab when the viewer should not access payroll", async () => {
    const employee = createEmployee({ id: 5, firstName: "Ava", lastName: "Stone" });

    mockApiRoutes([
      { path: "/employees/5", data: employee },
      { path: "/attendance?employeeId=5", data: [createAttendance({ employeeId: 5, employee })] },
      { path: "/leave-balances/me?employeeId=5", data: [createLeaveBalance()] },
      { path: "/leaves?employeeId=5", data: [createLeaveRequest({ employee })] },
    ]);

    renderWithRoute(
      <EmployeeProfilePage token="token" role="EMPLOYEE" currentEmployeeId={99} />,
      { route: "/employees/5", path: "/employees/:id" },
    );

    expect(await screen.findByText("Ava Stone")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /payroll/i })).not.toBeInTheDocument();
    expect(screen.getByText("Leave allocation")).toBeInTheDocument();
  });
});
