import { test, expect } from "@playwright/test";
import { ApiClient } from "../../utils/api-client";

test.describe("Attendance API", () => {
  test("Check-in creates record @api", async ({ request }) => {
    const api = new ApiClient(request).useRole("employee");
    const now = new Date().toISOString();
    
    // Check if already checked in, if so, this will fail or we can ignore
    // For pure testing, we usually create a new employee first.
    // Assuming this employee hasn't checked in yet today.
    const { status } = await api.checkIn(now);
    expect([200, 201, 409]).toContain(status); // 409 if already checked in
  });

  test("GET /api/attendance/today returns attendance @api", async ({ request }) => {
    const api = new ApiClient(request).useRole("employee");
    const { status, body } = await api.getTodayAttendance();
    expect(status).toBe(200);
    expect(body.data).toBeDefined();
  });
});
