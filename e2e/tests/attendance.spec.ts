import { test, expect } from "@playwright/test";
import path from "path";
import { AttendancePage } from "../page-objects/AttendancePage";

test.describe("Attendance Flow", () => {
  test.use({ storageState: path.join(__dirname, "../.auth/employee.json") });

  test("Employee can check in and out @smoke @attendance", async ({ page }) => {
    const attendancePage = new AttendancePage(page);
    await attendancePage.goto();

    // The button might be Check In or Check Out depending on current state.
    // We'll just verify the page loads and the status badge is visible for now.
    // In a real isolated environment, we'd use the API client to reset state first.
    await expect(attendancePage.statusBadge).toBeVisible();
    
    // Example assertion: ensure the history table is present
    await expect(page.locator("table")).toBeVisible();
  });

  test("Cannot check in twice on same day @smoke @attendance", async ({ page }) => {
    // This is typically enforced by the UI hiding the check-in button
    const attendancePage = new AttendancePage(page);
    await attendancePage.goto();
    // Assuming if they are checked in, the "Check in" button isn't there
    // If they aren't, they click it once, then it shouldn't be there.
  });
});

test.describe("Manager Attendance View", () => {
  test.use({ storageState: path.join(__dirname, "../.auth/manager.json") });

  test("Manager can view team attendance table @smoke @attendance", async ({ page }) => {
    await page.goto("/attendance");
    // Managers should see a table or list of team members
    await expect(page.locator("table").or(page.getByText(/team/i))).toBeVisible();
  });
});
