/**
 * page-objects/AttendancePage.ts
 */

import { type Page, type Locator, expect } from "@playwright/test";

export class AttendancePage {
  readonly page: Page;
  readonly checkInButton: Locator;
  readonly checkOutButton: Locator;
  readonly statusBadge: Locator;

  constructor(page: Page) {
    this.page = page;
    this.checkInButton = page.getByRole("button", { name: /check in/i });
    this.checkOutButton = page.getByRole("button", { name: /check out/i });
    this.statusBadge = page.locator(".status-badge, [data-testid='attendance-status']").first();
  }

  async goto() {
    await this.page.goto("/attendance");
  }

  async checkIn() {
    await this.checkInButton.click();
  }

  async checkOut() {
    await this.checkOutButton.click();
  }

  async expectStatus(status: string | RegExp) {
    await expect(this.statusBadge).toHaveText(status, { timeout: 10_000 });
  }
}
