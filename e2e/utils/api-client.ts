/**
 * utils/api-client.ts
 *
 * A typed API wrapper around Playwright's APIRequestContext.
 * Used in both API tests (headless) and E2E tests (for setup/teardown).
 */

import { APIRequestContext } from "@playwright/test";
import path from "path";
import fs from "fs";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:4000/api";
const AUTH_DIR = path.join(__dirname, "../.auth");

// ─── Types ────────────────────────────────────────────────────────────────────

export type Role = "admin" | "hr" | "manager" | "employee";

export type ApiUser = {
  id: number;
  email: string;
  role: string;
};

export type ApiEmployee = {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  departmentId: number;
  jobTitle?: string;
};

export type LoginResult = {
  token: string;
  user: ApiUser;
};

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTokenForRole(role: Role): string {
  const authFile = path.join(AUTH_DIR, `${role}.json`);
  if (!fs.existsSync(authFile)) {
    throw new Error(
      `[ApiClient] Auth file not found for role "${role}". Did global setup run?`
    );
  }
  const { token } = JSON.parse(fs.readFileSync(authFile, "utf-8"));
  return token as string;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ─── ApiClient class ──────────────────────────────────────────────────────────

export class ApiClient {
  private request: APIRequestContext;
  private token: string | null = null;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  /** Log in and store token on this client instance */
  async login(email: string, password: string): Promise<LoginResult> {
    const response = await this.request.post(`${API_URL}/auth/login`, {
      data: { email, password },
    });
    const body: ApiResponse<LoginResult> = await response.json();
    this.token = body.data.token;
    return body.data;
  }

  /** Load a pre-saved role token (from global setup) */
  useRole(role: Role): this {
    this.token = getTokenForRole(role);
    return this;
  }

  get headers() {
    if (!this.token) throw new Error("[ApiClient] No token set. Call login() or useRole() first.");
    return authHeaders(this.token);
  }

  // ── Employees ─────────────────────────────────────────────────────────────

  async getEmployees() {
    const res = await this.request.get(`${API_URL}/employees`, {
      headers: this.headers,
    });
    return { status: res.status(), body: (await res.json()) as ApiResponse<{ items: ApiEmployee[] }> };
  }

  async createEmployee(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    employeeCode: string;
    departmentId: number;
    role: string;
    joiningDate: string;
    employmentStatus: string;
  }) {
    const res = await this.request.post(`${API_URL}/employees`, {
      headers: this.headers,
      data,
    });
    return { status: res.status(), body: (await res.json()) as ApiResponse<ApiEmployee> };
  }

  async deleteEmployee(id: number) {
    const res = await this.request.patch(`${API_URL}/employees/${id}/status`, {
      headers: this.headers,
      data: { isActive: false, employmentStatus: "TERMINATED" },
    });
    return { status: res.status() };
  }

  async getEmployee(id: number) {
    const res = await this.request.get(`${API_URL}/employees/${id}`, {
      headers: this.headers,
    });
    return { status: res.status(), body: (await res.json()) as ApiResponse<ApiEmployee> };
  }

  // ── Attendance ────────────────────────────────────────────────────────────

  async checkIn(localDateTime: string) {
    const res = await this.request.post(`${API_URL}/attendance/check-in`, {
      headers: this.headers,
      data: { localDateTime },
    });
    return { status: res.status(), body: await res.json() };
  }

  async checkOut(localDateTime: string) {
    const res = await this.request.post(`${API_URL}/attendance/check-out`, {
      headers: this.headers,
      data: { localDateTime },
    });
    return { status: res.status(), body: await res.json() };
  }

  async getTodayAttendance() {
    const res = await this.request.get(`${API_URL}/attendance/today`, {
      headers: this.headers,
    });
    return { status: res.status(), body: await res.json() };
  }

  // ── Leaves ────────────────────────────────────────────────────────────────

  async applyLeave(data: {
    leaveTypeId: number;
    startDate: string;
    endDate: string;
    startDayDuration: string;
    endDayDuration: string;
    reason: string;
  }) {
    const res = await this.request.post(`${API_URL}/leaves`, {
      headers: this.headers,
      data,
    });
    return { status: res.status(), body: await res.json() };
  }

  async managerApproveLeave(leaveId: number, approved: boolean, reason?: string) {
    const res = await this.request.put(`${API_URL}/leaves/${leaveId}/manager-approve`, {
      headers: this.headers,
      data: { approved, rejectionReason: reason },
    });
    return { status: res.status(), body: await res.json() };
  }

  async hrApproveLeave(leaveId: number, approved: boolean, reason?: string) {
    const res = await this.request.put(`${API_URL}/leaves/${leaveId}/hr-approve`, {
      headers: this.headers,
      data: { approved, rejectionReason: reason },
    });
    return { status: res.status(), body: await res.json() };
  }

  async getLeaves(employeeId?: number) {
    const url = employeeId
      ? `${API_URL}/leaves?employeeId=${employeeId}`
      : `${API_URL}/leaves`;
    const res = await this.request.get(url, { headers: this.headers });
    return { status: res.status(), body: await res.json() };
  }

  // ── Payroll ───────────────────────────────────────────────────────────────

  async getPayroll(employeeId?: number) {
    const url = employeeId
      ? `${API_URL}/payroll?employeeId=${employeeId}`
      : `${API_URL}/payroll`;
    const res = await this.request.get(url, { headers: this.headers });
    return { status: res.status(), body: await res.json() };
  }

  // ── Departments ───────────────────────────────────────────────────────────

  async getDepartments() {
    const res = await this.request.get(`${API_URL}/departments`, {
      headers: this.headers,
    });
    return { status: res.status(), body: await res.json() };
  }
}
