import "../../test/setup";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";
import DashboardPage from "./DashboardPage";
import { mockApiRoutes } from "../../test/api";
import { createAttendance, createEmployee } from "../../test/fixtures";

describe("DashboardPage", () => {
  test("renders the employee dashboard summary and timezone widgets", async () => {
    mockApiRoutes([
      {
        path: "/dashboard/employee-summary",
        data: {
          attendanceToday: createAttendance(),
          pendingLeaves: 1,
          payrollCount: 2,
          isTeamLead: false,
          scopedTeamCount: 0,
          pendingTeamLeaves: 0,
          currentEmployee: createEmployee(),
          leaveBalances: [],
          leaveRequests: [],
        },
      },
    ]);

    render(
      <MemoryRouter>
        <DashboardPage token="token" role="EMPLOYEE" currentEmployeeId={1} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Attendance today")).toBeInTheDocument();
    expect(screen.getByText("Good morning")).toBeInTheDocument();
    expect(screen.getByText("Kolkata, Asia")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open attendance/i })).toBeInTheDocument();
  });

  test("renders the summary dashboard for admin users", async () => {
    mockApiRoutes([
      {
        path: "/dashboard/hr",
        data: {
          employees: 42,
          departments: 6,
          pendingLeaves: 3,
        },
      },
    ]);

    render(
      <MemoryRouter>
        <DashboardPage token="token" role="ADMIN" currentEmployeeId={1} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Operations command center")).toBeInTheDocument();
    expect(screen.getByText("Open detailed analytics")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});
