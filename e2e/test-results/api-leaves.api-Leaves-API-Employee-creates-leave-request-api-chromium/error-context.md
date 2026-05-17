# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api\leaves.api.spec.ts >> Leaves API >> Employee creates leave request @api
- Location: tests\api\leaves.api.spec.ts:6:7

# Error details

```
Error: [ApiClient] Auth file not found for role "employee". Did global setup run?
```

# Test source

```ts
  1   | /**
  2   |  * utils/api-client.ts
  3   |  *
  4   |  * A typed API wrapper around Playwright's APIRequestContext.
  5   |  * Used in both API tests (headless) and E2E tests (for setup/teardown).
  6   |  */
  7   | 
  8   | import { APIRequestContext } from "@playwright/test";
  9   | import path from "path";
  10  | import fs from "fs";
  11  | 
  12  | const API_URL = process.env.E2E_API_URL ?? "http://localhost:4000/api";
  13  | const AUTH_DIR = path.join(__dirname, "../.auth");
  14  | 
  15  | // ─── Types ────────────────────────────────────────────────────────────────────
  16  | 
  17  | export type Role = "admin" | "hr" | "manager" | "employee";
  18  | 
  19  | export type ApiUser = {
  20  |   id: number;
  21  |   email: string;
  22  |   role: string;
  23  | };
  24  | 
  25  | export type ApiEmployee = {
  26  |   id: number;
  27  |   employeeCode: string;
  28  |   firstName: string;
  29  |   lastName: string;
  30  |   departmentId: number;
  31  |   jobTitle?: string;
  32  | };
  33  | 
  34  | export type LoginResult = {
  35  |   token: string;
  36  |   user: ApiUser;
  37  | };
  38  | 
  39  | export type ApiResponse<T> = {
  40  |   success: boolean;
  41  |   message: string;
  42  |   data: T;
  43  | };
  44  | 
  45  | // ─── Helpers ──────────────────────────────────────────────────────────────────
  46  | 
  47  | function getTokenForRole(role: Role): string {
  48  |   const authFile = path.join(AUTH_DIR, `${role}.json`);
  49  |   if (!fs.existsSync(authFile)) {
> 50  |     throw new Error(
      |           ^ Error: [ApiClient] Auth file not found for role "employee". Did global setup run?
  51  |       `[ApiClient] Auth file not found for role "${role}". Did global setup run?`
  52  |     );
  53  |   }
  54  |   const { token } = JSON.parse(fs.readFileSync(authFile, "utf-8"));
  55  |   return token as string;
  56  | }
  57  | 
  58  | function authHeaders(token: string) {
  59  |   return { Authorization: `Bearer ${token}` };
  60  | }
  61  | 
  62  | // ─── ApiClient class ──────────────────────────────────────────────────────────
  63  | 
  64  | export class ApiClient {
  65  |   private request: APIRequestContext;
  66  |   private token: string | null = null;
  67  | 
  68  |   constructor(request: APIRequestContext) {
  69  |     this.request = request;
  70  |   }
  71  | 
  72  |   // ── Auth ──────────────────────────────────────────────────────────────────
  73  | 
  74  |   /** Log in and store token on this client instance */
  75  |   async login(email: string, password: string): Promise<LoginResult> {
  76  |     const response = await this.request.post(`${API_URL}/auth/login`, {
  77  |       data: { email, password },
  78  |     });
  79  |     const body: ApiResponse<LoginResult> = await response.json();
  80  |     this.token = body.data.token;
  81  |     return body.data;
  82  |   }
  83  | 
  84  |   /** Load a pre-saved role token (from global setup) */
  85  |   useRole(role: Role): this {
  86  |     this.token = getTokenForRole(role);
  87  |     return this;
  88  |   }
  89  | 
  90  |   get headers() {
  91  |     if (!this.token) throw new Error("[ApiClient] No token set. Call login() or useRole() first.");
  92  |     return authHeaders(this.token);
  93  |   }
  94  | 
  95  |   // ── Employees ─────────────────────────────────────────────────────────────
  96  | 
  97  |   async getEmployees() {
  98  |     const res = await this.request.get(`${API_URL}/employees`, {
  99  |       headers: this.headers,
  100 |     });
  101 |     return { status: res.status(), body: (await res.json()) as ApiResponse<{ items: ApiEmployee[] }> };
  102 |   }
  103 | 
  104 |   async createEmployee(data: {
  105 |     firstName: string;
  106 |     lastName: string;
  107 |     email: string;
  108 |     password: string;
  109 |     employeeCode: string;
  110 |     departmentId: number;
  111 |     role: string;
  112 |     joiningDate: string;
  113 |     employmentStatus: string;
  114 |   }) {
  115 |     const res = await this.request.post(`${API_URL}/employees`, {
  116 |       headers: this.headers,
  117 |       data,
  118 |     });
  119 |     return { status: res.status(), body: (await res.json()) as ApiResponse<ApiEmployee> };
  120 |   }
  121 | 
  122 |   async deleteEmployee(id: number) {
  123 |     const res = await this.request.patch(`${API_URL}/employees/${id}/status`, {
  124 |       headers: this.headers,
  125 |       data: { isActive: false, employmentStatus: "TERMINATED" },
  126 |     });
  127 |     return { status: res.status() };
  128 |   }
  129 | 
  130 |   async getEmployee(id: number) {
  131 |     const res = await this.request.get(`${API_URL}/employees/${id}`, {
  132 |       headers: this.headers,
  133 |     });
  134 |     return { status: res.status(), body: (await res.json()) as ApiResponse<ApiEmployee> };
  135 |   }
  136 | 
  137 |   // ── Attendance ────────────────────────────────────────────────────────────
  138 | 
  139 |   async checkIn(localDateTime: string) {
  140 |     const res = await this.request.post(`${API_URL}/attendance/check-in`, {
  141 |       headers: this.headers,
  142 |       data: { localDateTime },
  143 |     });
  144 |     return { status: res.status(), body: await res.json() };
  145 |   }
  146 | 
  147 |   async checkOut(localDateTime: string) {
  148 |     const res = await this.request.post(`${API_URL}/attendance/check-out`, {
  149 |       headers: this.headers,
  150 |       data: { localDateTime },
```