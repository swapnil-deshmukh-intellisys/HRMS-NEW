# HRMS v2 Implementation Plan

## Summary

Build the HRMS MVP from the v2 architecture using a backend-first approach. The implementation should establish the database schema, auth/RBAC, and workflow APIs first, then add the React application against stable contracts. The deliverable is a working single-repo project with `frontend/` and `backend/`, Prisma-managed PostgreSQL, JWT auth with refresh tokens, and complete MVP flows for employees, attendance, leave, payroll, dashboards, and reports.

## Key Changes

### Foundation and project setup
- Create `backend/` and `frontend/` workspaces matching the v2 structure.
- Backend stack: `Node.js + Express + Prisma + PostgreSQL + Zod`.
- Frontend stack: `React + React Router`; use a lightweight centralized state approach for auth/session and server-state fetching.
- Standardize API envelope to the v2 `success/message/data/errors` format.
- Add shared environment handling for local, staging, and production.

### Database and Prisma
- Implement Prisma models for `Users`, `Roles`, `Permissions`, `RolePermissions`, `Departments`, `Designations`, `Employees`, `Shifts`, `AttendanceRecords`, `LeaveTypes`, `LeaveBalances`, `LeaveRequests`, `PayrollRecords`, `Payslips`, `Documents`, `AuditLogs`, and `RefreshTokens`.
- Enforce unique constraints from v2:
  - `users.email`
  - `employees.user_id`
  - `employees.employee_code`
  - `attendance_records(employee_id, attendance_date)`
  - `leave_balances(employee_id, leave_type_id, year)`
  - `payroll_records(employee_id, month, year)`
- Add indexes from the v2 document for employee, attendance, leave, payroll, and audit lookups.
- Seed baseline roles, permissions, admin user, default leave types, and at least one department/designation/shift for development.

### Auth and RBAC
- Implement `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/refresh`, `GET /api/auth/me`, plus password reset endpoints.
- Use bcrypt for password hashing, short-lived JWT access tokens, and hashed refresh tokens stored in `RefreshTokens`.
- Add middleware for:
  - authentication
  - role guard
  - permission guard
  - request validation
  - centralized error handling
- `GET /api/auth/me` should return authenticated user profile, linked employee record, role, and resolved permissions.
- Enforce inactive-user blocking and secure logout via token revocation.

### Core business modules
- Roles and permissions:
  - implement role CRUD, permission listing, and role-permission assignment
  - do not allow duplicate permission mappings
- Employees:
  - implement employee CRUD, status updates, profile retrieval, and document metadata endpoints
  - include department, designation, manager, shift, and employment status fields
  - use soft-delete semantics for employee lifecycle changes instead of destructive delete
- Departments:
  - implement department CRUD with optional department head linkage
- Attendance:
  - implement check-in, check-out, list, detail, employee history, and regularization request creation
  - enforce one attendance record per employee per date
  - reject checkout before check-in
  - compute worked minutes and attendance status server-side
- Leave:
  - implement leave types, self leave balances, leave request CRUD-read, cancel, approve, and reject actions
  - validate date overlap, leave balance, and authorization chain
  - prevent self-approval
  - update leave balance only on approved requests
- Team:
  - implement manager-scoped team members, team attendance, and team leaves using reporting hierarchy from `Employees.manager_id`
- Payroll:
  - implement payroll list/detail, monthly generation, publish action, employee payroll history, and payslip retrieval
  - treat payroll as monthly immutable records once published except for privileged correction flow
  - store salary breakdown fields from v2 and allow employee-only access to own published records
- Dashboard and reports:
  - implement role-specific dashboard endpoints for employee, manager, HR, and admin
  - implement employee, attendance, leave, and payroll reports with filters for date range, employee, department, and status where relevant
  - keep report endpoints synchronous for MVP unless queries become too heavy

### Audit, security, and operational controls
- Write audit log entries for login, logout, role assignment, employee status changes, leave approval or rejection, payroll generation or publish, and password reset actions.
- Add rate limiting on auth endpoints, secure headers, CORS configuration, and request-size protection.
- Ensure sensitive fields never leave the API: password hashes, token hashes, and internal security metadata.
- Add structured server logging with request correlation ids for troubleshooting.
- Keep migrations source-controlled and run them before application startup in deployment workflows.

### Frontend implementation
- Build authenticated app shell with role-aware navigation and protected routes.
- Implement pages and flows for:
  - login and session restore
  - employee list/detail/create-edit
  - department management
  - attendance check-in/check-out/history
  - leave apply/history/approval
  - team overview for managers
  - payroll history and payslip access
  - dashboards and reports
- Use frontend route guards based on resolved permissions from `/api/auth/me`.
- Keep feature folders aligned with backend modules to reduce contract drift.
- Start with simple, internal-tool-oriented UI rather than heavy design-system abstraction.

### Delivery sequence
1. Scaffold repo structure, backend app, frontend app, environment config, and CI basics.
2. Implement Prisma schema, migrations, and seed data.
3. Build auth, refresh-token flow, RBAC middleware, and `/api/auth/me`.
4. Implement roles, permissions, departments, and employee management.
5. Implement attendance workflows and manager team read APIs.
6. Implement leave types, balances, request workflow, and approval actions.
7. Implement payroll generation, publish flow, and payslip access.
8. Implement dashboards, reports, and audit log listing.
9. Build frontend flows against the now-stable APIs.
10. Add final validation, test coverage, deployment checks, and seed/setup documentation.

## Public Interfaces

### Backend API surface
- Keep the v2 endpoint list as the public contract.
- Add standard query parameters for list endpoints:
  - pagination: `page`, `limit`
  - sorting: `sortBy`, `sortOrder`
  - filtering per module such as `employeeId`, `departmentId`, `status`, `startDate`, `endDate`, `month`, `year`
- Return role and permission arrays from `/api/auth/me` so frontend navigation and guards are server-driven.

### Data model decisions
- `PayrollRecords` is explicitly `Employee 1:N PayrollRecords`.
- `Users.role_id` remains the primary role source; permissions are resolved through `RolePermissions`.
- `Employees.manager_id` is the reporting authority source for team and leave approval checks.
- `Documents` and `Payslips` store metadata and URL/path references, not file binaries in the database.

## Test Plan

- Auth:
  - valid login, invalid login, inactive user login blocked, refresh token rotation, logout revocation, password reset flow
- RBAC:
  - employee blocked from admin APIs, manager limited to team scope, HR allowed operational APIs, admin allowed configuration APIs
- Employees:
  - create employee with linked user, update hierarchy fields, prevent duplicate email or employee code, status update behavior
- Attendance:
  - one record per day enforced, checkout before check-in rejected, duplicate check-in rejected, manager can view only team attendance
- Leave:
  - insufficient balance rejected, overlapping leave rejected, self-approval rejected, manager approval updates balance, cancel behavior for pending requests
- Payroll:
  - one payroll record per employee per month/year, generation idempotency, publish changes visibility, employee can access only own published payroll
- Reports and dashboards:
  - role-specific metrics return expected data subsets, date filters work, unauthorized report access blocked
- Audit:
  - critical actions create audit rows with actor, entity, and timestamp
- Integration:
  - end-to-end flow for employee creation -> login -> attendance -> leave -> approval -> payroll publication

## Assumptions

- Single-company deployment for MVP; no multi-tenant isolation is required.
- Backend-first is the chosen delivery order.
- React app will consume the backend directly; no BFF layer is planned.
- File handling for documents and payslips is metadata-first, with storage integration added behind URLs/paths.
- Notifications are not a launch dependency; they can be added after core workflows are stable.
- Reporting remains live-query based for MVP unless performance proves otherwise.
