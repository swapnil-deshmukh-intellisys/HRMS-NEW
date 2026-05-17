import { test, expect } from "@playwright/test";
import { ApiClient } from "../../utils/api-client";

test.describe("JWT Authentication Security @security", () => {
  const PROTECTED_ENDPOINT = "/api/auth/me";

  test("Missing Authorization header returns 401", async ({ request }) => {
    const response = await request.get(PROTECTED_ENDPOINT);
    expect(response.status()).toBe(401);
  });

  test("Malformed Authorization header returns 401", async ({ request }) => {
    const response = await request.get(PROTECTED_ENDPOINT, {
      headers: { Authorization: "Bearer NotARealToken" },
    });
    expect(response.status()).toBe(401);
  });

  test("Tampered JWT signature returns 401", async ({ request }) => {
    const api = new ApiClient(request).useRole("employee");
    const validToken = api.headers.Authorization.split(" ")[1];
    
    // Tamper with the signature (3rd part of JWT)
    const parts = validToken.split(".");
    if (parts.length === 3) {
      const tamperedToken = `${parts[0]}.${parts[1]}.${parts[2].substring(0, parts[2].length - 2)}XX`;
      
      const response = await request.get(PROTECTED_ENDPOINT, {
        headers: { Authorization: `Bearer ${tamperedToken}` },
      });
      expect(response.status()).toBe(401);
    } else {
      test.skip(); // Not a standard JWT
    }
  });
});
