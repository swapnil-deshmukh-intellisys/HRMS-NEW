import "../../test/setup";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";
import AttendanceRequestsPage from "./AttendanceRequestsPage";
import { mockApiRoutes } from "../../test/api";
import { createEmployee } from "../../test/fixtures";

describe("AttendanceRequestsPage", () => {
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
      }
    ]);

    render(
      <MemoryRouter>
        <AttendanceRequestsPage token="token" role="HR" currentEmployeeId={2} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });
});
