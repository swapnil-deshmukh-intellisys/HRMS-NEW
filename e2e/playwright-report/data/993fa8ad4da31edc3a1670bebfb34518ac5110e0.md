# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication Flow >> Valid login as admin renders dashboard @smoke @auth
- Location: tests\auth.spec.ts:9:7

# Error details

```
Error: locator.fill: Error: strict mode violation: getByLabel(/password/i) resolved to 2 elements:
    1) <input value="" required="" type="password" placeholder="Enter your password"/> aka getByRole('textbox', { name: 'Password Show password' })
    2) <button type="button" aria-label="Show password" class="password-visibility-toggle">…</button> aka getByRole('button', { name: 'Show password' })

Call log:
  - waiting for getByLabel(/password/i)

```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e7]:
    - paragraph [ref=e8]: Intellisys HRMS
    - heading [level=1] [ref=e9]: HRMS workspace
  - generic [ref=e11]:
    - generic [ref=e12]:
      - paragraph [ref=e13]: HRMS Portal
      - heading "Welcome back" [level=2] [ref=e14]
      - paragraph [ref=e15]: Use your work credentials to continue.
    - generic [ref=e16]:
      - generic [ref=e17]:
        - text: Work email
        - textbox "Work email" [active] [ref=e18]:
          - /placeholder: name@company.com
          - text: admin@intellisys.com
      - generic [ref=e19]:
        - text: Password
        - textbox "Password Show password" [ref=e20]:
          - /placeholder: Enter your password
        - button "Show password" [ref=e21] [cursor=pointer]:
          - img [ref=e22]
      - button "Sign in" [ref=e25] [cursor=pointer]
    - generic [ref=e26]:
      - generic [ref=e27]:
        - generic [ref=e28]: Access
        - strong [ref=e29]: Role-based workspace
      - generic [ref=e30]:
        - generic [ref=e31]: Users
        - strong [ref=e32]: HR, managers, employees
```

# Test source

```ts
  1  | /**
  2  |  * page-objects/LoginPage.ts
  3  |  * Encapsulates all selectors and actions for the Login page.
  4  |  */
  5  | 
  6  | import { type Page, type Locator, expect } from "@playwright/test";
  7  | 
  8  | export class LoginPage {
  9  |   readonly page: Page;
  10 |   readonly emailInput: Locator;
  11 |   readonly passwordInput: Locator;
  12 |   readonly submitButton: Locator;
  13 |   readonly errorMessage: Locator;
  14 | 
  15 |   constructor(page: Page) {
  16 |     this.page = page;
  17 |     this.emailInput    = page.getByLabel(/email/i);
  18 |     this.passwordInput = page.getByLabel(/password/i);
  19 |     this.submitButton  = page.getByRole("button", { name: /sign in|log in|login/i });
  20 |     this.errorMessage  = page.getByRole("alert").or(page.locator(".error-message, .toast-error, [data-testid='error']")).first();
  21 |   }
  22 | 
  23 |   async goto() {
  24 |     await this.page.goto("/");
  25 |   }
  26 | 
  27 |   async login(email: string, password: string) {
  28 |     await this.emailInput.fill(email);
> 29 |     await this.passwordInput.fill(password);
     |                              ^ Error: locator.fill: Error: strict mode violation: getByLabel(/password/i) resolved to 2 elements:
  30 |     await this.submitButton.click();
  31 |   }
  32 | 
  33 |   async expectErrorVisible() {
  34 |     await expect(this.errorMessage).toBeVisible({ timeout: 5_000 });
  35 |   }
  36 | 
  37 |   async expectRedirectedToDashboard() {
  38 |     await expect(this.page).toHaveURL(/dashboard|home/, { timeout: 10_000 });
  39 |   }
  40 | }
  41 | 
```