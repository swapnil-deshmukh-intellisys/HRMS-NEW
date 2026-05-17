import { test, expect } from "@playwright/test";
import { ApiClient } from "../../utils/api-client";

test.describe("Auth API", () => {
  test("POST /api/auth/login with valid credentials returns token @api", async ({ request }) => {
    const api = new ApiClient(request);
    const result = await api.login(
      process.env.E2E_ADMIN_EMAIL ?? "admin@intellisys.com",
      process.env.E2E_ADMIN_PASS ?? "admin123"
    );
    expect(result.token).toBeDefined();
    expect(result.user).toBeDefined();
    expect(result.user.role).toBe("ADMIN");
  });

  test("POST /api/auth/login with wrong password returns 401 @api", async ({ request }) => {
    const response = await request.post("/auth/login", {
      data: { email: "admin@intellisys.com", password: "wrongpassword" }
    });
    expect(response.status()).toBe(401);
  });
});
