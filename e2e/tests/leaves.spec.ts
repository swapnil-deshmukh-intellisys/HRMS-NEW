import { test, expect } from "@playwright/test";
import path from "path";
import { LeavesPage } from "../page-objects/LeavesPage";
import { futureDateString } from "../data-factories/employee.factory";

test.describe("Leave Application Flow", () => {
  test.use({ storageState: path.join(__dirname, "../.auth/employee.json") });

  test("Employee applies for leave @regression @leaves", async ({ page }) => {
    const leavesPage = new LeavesPage(page);
    await leavesPage.goto();

    const startDate = futureDateString(5);
    const endDate = futureDateString(6);

    await leavesPage.applyLeave("Casual Leave", startDate, endDate, "Family vacation");

    // Expect the leave to show up in the table with PENDING status
    await expect(page.locator("table")).toContainText("Family vacation");
    await expect(page.locator("table")).toContainText(/pending/i);
  });
});
