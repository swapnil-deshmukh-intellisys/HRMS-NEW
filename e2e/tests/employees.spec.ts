import { test, expect } from "@playwright/test";
import path from "path";
import { EmployeesPage } from "../page-objects/EmployeesPage";

test.describe("Employee Management Flow", () => {
  test.use({ storageState: path.join(__dirname, "../.auth/hr.json") });

  test("HR creates new employee @regression @employees", async ({ page }) => {
    const employeesPage = new EmployeesPage(page);
    await employeesPage.goto();

    await employeesPage.expectCreateButtonVisible();
    await employeesPage.createButton.click();

    // Fill out form logic would go here
    // Verify employee appears in list
  });
});
