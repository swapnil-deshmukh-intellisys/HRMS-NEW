import { test, expect } from "@playwright/test";
import { ApiClient } from "../../utils/api-client";
import { buildLeavePayload } from "../../data-factories/employee.factory";

test.describe("Leaves API", () => {
  test("Employee creates leave request @api", async ({ request }) => {
    const api = new ApiClient(request).useRole("employee");
    const payload = buildLeavePayload();
    const { status, body } = await api.applyLeave(payload);
    expect([200, 201]).toContain(status);
    if (status === 201 || status === 200) {
      expect(body.data.status).toBe("PENDING");
    }
  });

  test("EMPLOYEE cannot approve leaves @api", async ({ request }) => {
    const api = new ApiClient(request).useRole("employee");
    const { status } = await api.hrApproveLeave(9999, true);
    expect(status).toBe(403);
  });
});
