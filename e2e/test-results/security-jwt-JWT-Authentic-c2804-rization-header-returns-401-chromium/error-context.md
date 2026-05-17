# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: security\jwt.spec.ts >> JWT Authentication Security @security >> Missing Authorization header returns 401
- Location: tests\security\jwt.spec.ts:7:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 401
Received: 200
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { ApiClient } from "../../utils/api-client";
  3  | 
  4  | test.describe("JWT Authentication Security @security", () => {
  5  |   const PROTECTED_ENDPOINT = "/api/auth/me";
  6  | 
  7  |   test("Missing Authorization header returns 401", async ({ request }) => {
  8  |     const response = await request.get(PROTECTED_ENDPOINT);
> 9  |     expect(response.status()).toBe(401);
     |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  10 |   });
  11 | 
  12 |   test("Malformed Authorization header returns 401", async ({ request }) => {
  13 |     const response = await request.get(PROTECTED_ENDPOINT, {
  14 |       headers: { Authorization: "Bearer NotARealToken" },
  15 |     });
  16 |     expect(response.status()).toBe(401);
  17 |   });
  18 | 
  19 |   test("Tampered JWT signature returns 401", async ({ request }) => {
  20 |     const api = new ApiClient(request).useRole("employee");
  21 |     const validToken = api.headers.Authorization.split(" ")[1];
  22 |     
  23 |     // Tamper with the signature (3rd part of JWT)
  24 |     const parts = validToken.split(".");
  25 |     if (parts.length === 3) {
  26 |       const tamperedToken = `${parts[0]}.${parts[1]}.${parts[2].substring(0, parts[2].length - 2)}XX`;
  27 |       
  28 |       const response = await request.get(PROTECTED_ENDPOINT, {
  29 |         headers: { Authorization: `Bearer ${tamperedToken}` },
  30 |       });
  31 |       expect(response.status()).toBe(401);
  32 |     } else {
  33 |       test.skip(); // Not a standard JWT
  34 |     }
  35 |   });
  36 | });
  37 | 
```