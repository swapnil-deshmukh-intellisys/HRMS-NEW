import "../../test/setup";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import AttendanceQuickAction from "./AttendanceQuickAction";
import { dispatchAttendanceUpdated } from "./attendanceQuickActionUtils";

function createAttendance(overrides: Partial<Attendance> = {}): Attendance {
  return {
    id: 1,
    employeeId: 1,
    attendanceDate: "2026-04-10T00:00:00.000Z",
    checkInTime: "2026-04-10T09:00:00.000Z",
    checkOutTime: null,
    workedMinutes: 0,
    status: "PRESENT",
    ...overrides,
  };
}

function createApiResponse(data: unknown, status = 200, message = "OK") {
  return new Response(
    JSON.stringify({
      success: status >= 200 && status < 300,
      message,
      data,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

describe("AttendanceQuickAction", () => {
  test("ignores stale attendance loads after checkout completes", async () => {
    const pendingTodayRequests: Array<(value: Response) => void> = [];

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

      if (url.includes("/attendance/today") && method === "GET") {
        return new Promise<Response>((resolve) => {
          pendingTodayRequests.push(resolve);
        });
      }

      if (url.includes("/attendance/check-out") && method === "POST") {
        return Promise.resolve(
          createApiResponse(
            createAttendance({
              checkOutTime: "2026-04-10T18:00:00.000Z",
              workedMinutes: 540,
            }),
          ),
        );
      }

      throw new Error(`Unhandled API request: ${method} ${url}`);
    });

    render(<AttendanceQuickAction token="token" currentEmployeeId={1} />);

    act(() => {
      dispatchAttendanceUpdated(createAttendance());
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /finish today's attendance/i }));
    await user.click(screen.getByRole("button", { name: /confirm check out/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /attendance completed for today/i })).toBeDisabled());

    await act(async () => {
      pendingTodayRequests[0]?.(createApiResponse({ attendanceToday: createAttendance() }));
      pendingTodayRequests[1]?.(
        createApiResponse({
          attendanceToday: createAttendance({
            checkOutTime: "2026-04-10T18:00:00.000Z",
            workedMinutes: 540,
          }),
        }),
      );
    });

    expect(screen.getByRole("button", { name: /attendance completed for today/i })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /finish today's attendance/i })).not.toBeInTheDocument();
  });

  test("shows checkout errors and reloads attendance state", async () => {
    let todayRequestCount = 0;

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

      if (url.includes("/attendance/today") && method === "GET") {
        todayRequestCount += 1;
        return Promise.resolve(createApiResponse({ attendanceToday: createAttendance() }));
      }

      if (url.includes("/attendance/check-out") && method === "POST") {
        return Promise.resolve(
          createApiResponse(null, 403, "Attendance marking is available only on desktop or laptop devices."),
        );
      }

      throw new Error(`Unhandled API request: ${method} ${url}`);
    });

    render(<AttendanceQuickAction token="token" currentEmployeeId={1} />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /finish today's attendance/i }));
    await user.click(screen.getByRole("button", { name: /confirm check out/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Attendance marking is available only on desktop or laptop devices.");
    expect(screen.getByRole("button", { name: /finish today's attendance/i })).toBeEnabled();
    expect(todayRequestCount).toBe(2);
  });
});
import type { Attendance } from "../../types";
