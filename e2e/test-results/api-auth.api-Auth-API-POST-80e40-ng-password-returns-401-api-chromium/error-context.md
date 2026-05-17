# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api\auth.api.spec.ts >> Auth API >> POST /api/auth/login with wrong password returns 401 @api
- Location: tests\api\auth.api.spec.ts:16:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 401
Received: 404
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { ApiClient } from "../../utils/api-client";
  3  | 
  4  | test.describe("Auth API", () => {
  5  |   test("POST /api/auth/login with valid credentials returns token @api", async ({ request }) => {
  6  |     const api = new ApiClient(request);
  7  |     const result = await api.login(
  8  |       process.env.E2E_ADMIN_EMAIL ?? "admin@intellisys.com",
  9  |       process.env.E2E_ADMIN_PASS ?? "admin123"
  10 |     );
  11 |     expect(result.token).toBeDefined();
  12 |     expect(result.user).toBeDefined();
  13 |     expect(result.user.role).toBe("ADMIN");
  14 |   });
  15 | 
  16 |   test("POST /api/auth/login with wrong password returns 401 @api", async ({ request }) => {
  17 |     const response = await request.post("/auth/login", {
  18 |       data: { email: "admin@intellisys.com", password: "wrongpassword" }
  19 |     });
> 20 |     expect(response.status()).toBe(401);
     |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  21 |   });
  22 | });
  23 | 
```