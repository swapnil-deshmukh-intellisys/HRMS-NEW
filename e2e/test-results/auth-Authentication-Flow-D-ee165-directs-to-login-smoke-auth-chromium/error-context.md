# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication Flow >> Direct URL access without auth redirects to login @smoke @auth
- Location: tests\auth.spec.ts:34:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /.*login.*/
Received string:  "http://localhost:5173/dashboard"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    13 × unexpected value "http://localhost:5173/dashboard"

```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { LoginPage } from "../page-objects/LoginPage";
  3  | import { DashboardPage } from "../page-objects/DashboardPage";
  4  | 
  5  | test.describe("Authentication Flow", () => {
  6  |   // Test without saved state to verify the actual login UI
  7  |   test.use({ storageState: { cookies: [], origins: [] } });
  8  | 
  9  |   test("Valid login as admin renders dashboard @smoke @auth", async ({ page }) => {
  10 |     const loginPage = new LoginPage(page);
  11 |     const dashboardPage = new DashboardPage(page);
  12 | 
  13 |     await loginPage.goto();
  14 |     // Using the same credentials from global.setup.ts
  15 |     await loginPage.login(
  16 |       process.env.E2E_ADMIN_EMAIL ?? "admin@intellisys.com",
  17 |       process.env.E2E_ADMIN_PASS ?? "admin123"
  18 |     );
  19 | 
  20 |     await loginPage.expectRedirectedToDashboard();
  21 |     await dashboardPage.expectVisible();
  22 |   });
  23 | 
  24 |   test("Invalid credentials show error @smoke @auth", async ({ page }) => {
  25 |     const loginPage = new LoginPage(page);
  26 | 
  27 |     await loginPage.goto();
  28 |     await loginPage.login("wrong@example.com", "badpassword");
  29 | 
  30 |     await loginPage.expectErrorVisible();
  31 |     await expect(page).not.toHaveURL(/dashboard/);
  32 |   });
  33 | 
  34 |   test("Direct URL access without auth redirects to login @smoke @auth", async ({ page }) => {
  35 |     await page.goto("/dashboard");
> 36 |     await expect(page).toHaveURL(/.*login.*/);
     |                        ^ Error: expect(page).toHaveURL(expected) failed
  37 |   });
  38 | });
  39 | 
```