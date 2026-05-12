/**
 * page-objects/DashboardPage.ts
 */

import { type Page, type Locator, expect } from "@playwright/test";

export class DashboardPage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly userRoleBadge: Locator;
  readonly navLinks: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar      = page.locator("nav, aside, .sidebar").first();
    this.userRoleBadge = page.locator(".role-badge, [data-testid='user-role']").first();
    this.navLinks     = page.locator("nav a, aside a");
  }

  async goto() {
    await this.page.goto("/dashboard");
  }

  async expectVisible() {
    await expect(this.page).toHaveURL(/dashboard/, { timeout: 10_000 });
    await expect(this.sidebar).toBeVisible();
  }

  async hasNavLink(name: string | RegExp) {
    return this.navLinks.filter({ hasText: name }).first().isVisible();
  }

  async navigateTo(name: string | RegExp) {
    await this.navLinks.filter({ hasText: name }).first().click();
  }
}
