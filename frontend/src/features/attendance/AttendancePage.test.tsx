import "../../test/setup";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";
import AttendancePage from "./AttendancePage";
import { mockApiRoutes } from "../../test/api";
import { createAttendance, createEmployee } from "../../test/fixtures";

describe("AttendancePage", () => {
  test("renders attendance history and correction sections for employees", async () => {
    mockApiRoutes([
      {
        path: "/attendance/regularizations",
        data: [],
      },
      {
        path: /\/attendance(\?date=.*)?$/,
        data: [createAttendance()],
      },
    ]);

    render(
      <MemoryRouter>
        <AttendancePage token="token" role="EMPLOYEE" currentEmployeeId={1} currentEmployee={createEmployee()} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Attendance history")).toBeInTheDocument();
    expect(screen.getByText("Correction requests")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request correction/i })).toBeInTheDocument();
  });

  test("shows correction review actions for HR", async () => {
    mockApiRoutes([
      {
        path: "/attendance/regularizations",
        data: [
          {
            id: 9,
            employeeId: 1,
            attendanceDate: "2026-04-09T00:00:00.000Z",
            proposedCheckInTime: "2026-04-09T09:10:00.000Z",
            proposedCheckOutTime: "2026-04-09T18:05:00.000Z",
            reason: "Missed swipe",
            status: "PENDING",
            reviewedAt: null,
            rejectionReason: null,
            createdAt: "2026-04-09T10:00:00.000Z",
            employee: createEmployee(),
            reviewedBy: null,
          },
        ],
      },
      {
        path: /\/attendance(\?date=.*)?$/,
        data: [createAttendance()],
      },
      {
        path: "/employees?limit=1000",
        data: {
          items: [createEmployee()],
          pagination: { total: 1 },
        },
      },
    ]);

    render(
      <MemoryRouter>
        <AttendancePage token="token" role="HR" currentEmployeeId={2} currentEmployee={createEmployee({ id: 2 })} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  test("shows Daily View and Monthly Summary tabs for team leads", async () => {
    const selfEmployee = createEmployee({
      id: 5,
      capabilities: [{ capability: "TEAM_LEAD" }],
      scopedTeamMembers: [{ employee: createEmployee({ id: 9, firstName: "Jordan", lastName: "Mills", employeeCode: "EMP-009" }) }],
    });

    mockApiRoutes([
      {
        path: "/attendance/regularizations",
        data: [],
      },
      {
        path: /\/attendance(\?date=.*)?$/,
        data: [createAttendance({ employeeId: 5, employee: selfEmployee })],
      },
    ]);

    render(
      <MemoryRouter>
        <AttendancePage token="token" role="EMPLOYEE" currentEmployeeId={5} currentEmployee={selfEmployee} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("tab", { name: "Daily View" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Monthly Summary" })).toBeInTheDocument();
  });
});
