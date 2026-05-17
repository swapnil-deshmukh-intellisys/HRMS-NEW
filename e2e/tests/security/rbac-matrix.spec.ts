import { test, expect } from "@playwright/test";
import { ApiClient } from "../../utils/api-client";

// Matrix of Role -> Allowed Endpoints
const RBAC_MATRIX = [
  {
    role: "employee" as const,
    allowed: ["/api/attendance/today", "/api/leaves"],
    forbidden: ["/api/payroll", "/api/employees", "/api/departments", "/api/leaves/1/approve"],
  },
  {
    role: "manager" as const,
    allowed: ["/api/attendance/today", "/api/leaves", "/api/employees", "/api/leaves/1/approve"],
    forbidden: ["/api/payroll", "/api/departments"], // Assuming managers can't see full payroll
  },
  {
    role: "hr" as const,
    allowed: ["/api/attendance/today", "/api/leaves", "/api/employees", "/api/departments", "/api/payroll", "/api/leaves/1/approve"],
    forbidden: [],
  },
];

test.describe("RBAC Security Matrix @security", () => {
  for (const { role, allowed, forbidden } of RBAC_MATRIX) {
    test.describe(`Role: ${role.toUpperCase()}`, () => {
      
      for (const endpoint of allowed) {
        test(`CAN access ${endpoint}`, async ({ request }) => {
          const api = new ApiClient(request).useRole(role);
          // Just verify we don't get a 401 or 403
          const response = await request.get(endpoint, { headers: api.headers });
          expect([401, 403]).not.toContain(response.status());
        });
      }

      for (const endpoint of forbidden) {
        test(`CANNOT access ${endpoint}`, async ({ request }) => {
          const api = new ApiClient(request).useRole(role);
          const response = await request.get(endpoint, { headers: api.headers });
          expect([401, 403]).toContain(response.status());
        });
      }
      
    });
  }
});
