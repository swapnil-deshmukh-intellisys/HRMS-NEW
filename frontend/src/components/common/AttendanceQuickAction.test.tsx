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
    checkInTime: "2026-05-12T09:00:00.000Z",
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
              checkOutTime: "2026-05-12T18:00:00.000Z",
              workedMinutes: 540,
            }),
          ),
        );
      }

      if (url.includes("/employees/1") && method === "GET") {
        return Promise.resolve(createApiResponse(createEmployee()));
      }

      throw new Error(`Unhandled API request: ${method} ${url}`);
    });

    render(<AttendanceQuickAction token="token" currentEmployeeId={1} />);

    act(() => {
      dispatchAttendanceUpdated(createAttendance());
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /finish today's attendance/i }));
    
    // Type manual update text to pass validation
    const textarea = screen.getByLabelText(/Manual Update/i);
    await user.type(textarea, "Did some work today.");
    
    await user.click(screen.getByRole("button", { name: /finalize & out/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /attendance completed for today/i })).toBeDisabled());

    await act(async () => {
      pendingTodayRequests[0]?.(createApiResponse({ attendanceToday: createAttendance() }));
      pendingTodayRequests[1]?.(
        createApiResponse({
          attendanceToday: createAttendance({
            checkOutTime: "2026-05-12T18:00:00.000Z",
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
          createApiResponse(null, 400, "Attendance marking is available only on desktop or laptop devices."),
        );
      }

      if (url.includes("/employees/1") && method === "GET") {
        return Promise.resolve(createApiResponse(createEmployee()));
      }

      throw new Error(`Unhandled API request: ${method} ${url}`);
    });

    render(<AttendanceQuickAction token="token" currentEmployeeId={1} />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /finish today's attendance/i }));
    
    // Type manual update text to pass validation
    const textarea = screen.getByLabelText(/Manual Update/i);
    await user.type(textarea, "Did some work today.");
    
    await user.click(screen.getByRole("button", { name: /finalize & out/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Attendance marking is available only on desktop or laptop devices.");
    expect(screen.getByRole("button", { name: /finish today's attendance/i })).toBeEnabled();
    expect(todayRequestCount).toBe(2);
  });
});
import type { Attendance, Employee } from "../../types";

function createEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 1,
    firstName: "Taylor",
    lastName: "Flint",
    email: "taylor@example.com",
    role: "EMPLOYEE",
    joiningDate: "2024-01-01",
    isActive: true,
    outlookEmails: [],
    ...overrides,
  } as any;
}
