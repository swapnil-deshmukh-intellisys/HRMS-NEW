import { test, expect } from "@playwright/test";
import path from "path";

test.describe("RBAC Access Control", () => {
  test.describe("EMPLOYEE role", () => {
    test.use({ storageState: path.join(__dirname, "../.auth/employee.json") });

    test("cannot access employees list @smoke @rbac @security", async ({ page }) => {
      await page.goto("/employees");
      await expect(page.getByText(/unauthorized|access denied|403/i).or(page.locator("text=Dashboard"))).toBeVisible();
    });

    test("cannot access departments @smoke @rbac @security", async ({ page }) => {
      await page.goto("/departments");
      await expect(page.getByText(/unauthorized|access denied|403/i).or(page.locator("text=Dashboard"))).toBeVisible();
    });
  });

  test.describe("MANAGER role", () => {
    test.use({ storageState: path.join(__dirname, "../.auth/manager.json") });

    test("cannot access payroll @smoke @rbac @security", async ({ page }) => {
      await page.goto("/payroll");
      await expect(page.getByText(/unauthorized|access denied|403/i).or(page.locator("text=Dashboard"))).toBeVisible();
    });
  });

  test.describe("ADMIN role", () => {
    test.use({ storageState: path.join(__dirname, "../.auth/admin.json") });

    test("can access all routes @smoke @rbac @security", async ({ page }) => {
      const routes = ["/employees", "/departments", "/payroll", "/leaves", "/attendance"];
      for (const route of routes) {
        await page.goto(route);
        // Should not see unauthorized messages
        await expect(page.getByText(/unauthorized|access denied|403/i)).toBeHidden();
      }
    });
  });
});
