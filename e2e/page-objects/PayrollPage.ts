/**
 * page-objects/PayrollPage.ts
 */

import { type Page, type Locator, expect } from "@playwright/test";

export class PayrollPage {
  readonly page: Page;
  readonly generateButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.generateButton = page.getByRole("button", { name: /generate payroll/i });
  }

  async goto() {
    await this.page.goto("/payroll");
  }

  async expectGenerateButtonVisible() {
    await expect(this.generateButton).toBeVisible();
  }

  async expectGenerateButtonHidden() {
    await expect(this.generateButton).toBeHidden();
  }
}
