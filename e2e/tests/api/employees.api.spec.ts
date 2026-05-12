import { test, expect } from "@playwright/test";
import { ApiClient } from "../../utils/api-client";
import { buildEmployee } from "../../data-factories/employee.factory";

test.describe("Employees API", () => {
  test("HR gets full list of employees @api", async ({ request }) => {
    const api = new ApiClient(request).useRole("hr");
    const { status, body } = await api.getEmployees();
    expect(status).toBe(200);
    expect(Array.isArray(body.data.items)).toBe(true);
  });

  test("EMPLOYEE role returns 403 when trying to get full list @api", async ({ request }) => {
    const api = new ApiClient(request).useRole("employee");
    const { status } = await api.getEmployees();
    expect(status).toBe(403);
  });

  test("ADMIN creates employee and verifies response shape @api", async ({ request }) => {
    const api = new ApiClient(request).useRole("admin");
    const newEmployee = buildEmployee();
    const { status, body } = await api.createEmployee(newEmployee);
    expect(status).toBe(201);
    expect(body.data.email).toBe(newEmployee.email);
  });
});
