import { test, expect } from "@playwright/test";
import { ApiClient } from "../../utils/api-client";

test.describe("Payroll API", () => {
  test("MANAGER role returns 403 for payroll generation @api", async ({ request }) => {
    const api = new ApiClient(request).useRole("manager");
    const { status } = await api.getPayroll();
    expect(status).toBe(403);
  });

  test("HR can access payroll @api", async ({ request }) => {
    const api = new ApiClient(request).useRole("hr");
    const { status } = await api.getPayroll();
    expect([200, 201]).toContain(status);
  });
});
