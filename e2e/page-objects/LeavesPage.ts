/**
 * page-objects/LeavesPage.ts
 */

import { type Page, type Locator, expect } from "@playwright/test";

export class LeavesPage {
  readonly page: Page;
  readonly applyButton: Locator;
  readonly leaveTypeSelect: Locator;
  readonly startDateInput: Locator;
  readonly endDateInput: Locator;
  readonly reasonInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.applyButton = page.getByRole("button", { name: /apply leave/i });
    this.leaveTypeSelect = page.getByLabel(/leave type/i);
    this.startDateInput = page.getByLabel(/start date/i);
    this.endDateInput = page.getByLabel(/end date/i);
    this.reasonInput = page.getByLabel(/reason/i);
    this.submitButton = page.getByRole("button", { name: /submit/i });
  }

  async goto() {
    await this.page.goto("/leaves");
  }

  async applyLeave(type: string, start: string, end: string, reason: string) {
    await this.applyButton.click();
    // Assuming a dialog/modal opens
    await this.leaveTypeSelect.selectOption({ label: type });
    await this.startDateInput.fill(start);
    await this.endDateInput.fill(end);
    await this.reasonInput.fill(reason);
    await this.submitButton.click();
  }
}
