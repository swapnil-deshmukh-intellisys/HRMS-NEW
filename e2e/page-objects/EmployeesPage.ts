/**
 * page-objects/EmployeesPage.ts
 */

import { type Page, type Locator, expect } from "@playwright/test";

export class EmployeesPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder(/search/i);
    this.createButton = page.getByRole("button", { name: /add employee|create employee/i });
  }

  async goto() {
    await this.page.goto("/employees");
  }

  async expectCreateButtonVisible() {
    await expect(this.createButton).toBeVisible();
  }

  async expectCreateButtonHidden() {
    await expect(this.createButton).toBeHidden();
  }
}
