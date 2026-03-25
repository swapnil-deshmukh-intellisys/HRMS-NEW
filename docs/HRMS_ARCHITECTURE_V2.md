# HRMS Architecture Design Document v2

## 1. Overview

This document defines the target architecture for the Human Resource Management System (HRMS) portal. It is designed for an MVP that is clean to build, secure by default, and flexible enough to scale into a production-grade internal business platform.

The system centralizes core HR operations:

- Authentication and role-based access control
- Employee lifecycle management
- Attendance tracking
- Leave application and approval
- Team visibility for managers
- Basic payroll processing and payslip access
- Dashboards and reports

The architecture is optimized for:

- Clear module boundaries
- Relational data integrity
- Fast iteration with Prisma and PostgreSQL
- Secure API access patterns
- Maintainable backend and frontend structure

## 2. Product Scope

### 2.1 In Scope for MVP

- User authentication
- Role and permission management
- Employee management
- Department and reporting hierarchy
- Attendance check-in and check-out
- Leave request and approval workflow
- Manager team views
- Basic payroll records and payslips
- Dashboards for employee, manager, HR, and admin
- Reports for employees, attendance, leaves, and payroll
- Audit logging for sensitive actions

### 2.2 Out of Scope for MVP

- Recruitment and ATS
- Performance management
- Learning and development
- Biometric device integrations
- Advanced payroll with tax engines and statutory calculations
- Mobile application
- Multi-tenant white-label architecture

## 3. User Roles

The system follows RBAC with optional fine-grained permissions.

### 3.1 Admin

Purpose: platform-level control

Responsibilities:

- Manage company settings
- Create users and assign roles
- Configure permissions
- Manage departments, designations, shifts, and policies
- View all reports and audit logs
- Trigger security actions

### 3.2 HR

Purpose: operational HR control

Responsibilities:

- Manage employee records
- View attendance and leave data
- Process leave requests where allowed
- Manage payroll records and payslips
- Generate HR reports

### 3.3 Manager

Purpose: team supervision

Responsibilities:

- View direct and indirect reports based on policy
- Approve or reject leave
- Review team attendance
- Monitor team dashboard metrics

### 3.4 Employee

Purpose: self-service usage

Responsibilities:

- Log in and manage profile
- Mark attendance
- Apply for leave
- View leave balance
- Access payslips and salary history allowed by policy

## 4. Functional Requirements

### 4.1 Auth and Access Control

- Login and logout
- Password hashing with bcrypt
- JWT access tokens
- Refresh token support
- Role-based and permission-based authorization
- Account status checks
- Password reset flow

### 4.2 Employee Management

- Create and update employee records
- Assign department, designation, manager, shift, and employment status
- Track joining date and employment metadata
- Upload and manage documents

### 4.3 Attendance Management

- Daily check-in and check-out
- Attendance status generation
- Attendance history
- Attendance corrections or regularization request support
- Team attendance view for managers and HR

### 4.4 Leave Management

- Leave application
- Approval and rejection workflow
- Leave balance tracking
- Leave type configuration
- Leave history and status timeline

### 4.5 Payroll

- Monthly payroll generation
- Store salary breakdown
- Publish payslips
- Payroll history by employee

### 4.6 Dashboards and Reports

- Employee dashboard
- Manager team dashboard
- HR operations dashboard
- Admin system dashboard
- Exportable reports where needed

### 4.7 Audit and Monitoring

- Track sensitive events
- Log role changes, leave approvals, payroll publication, and account updates

## 5. Non-Functional Requirements

### 5.1 Scalability

- Support up to 10,000 users
- Support concurrent login and transactional activity during office hours

### 5.2 Performance

- Standard CRUD APIs target less than 200 ms under normal load
- Dashboard and reporting APIs target less than 500 ms where caching is applied
- Bulk exports may be asynchronous if needed

### 5.3 Availability

- Target 99.0% uptime for MVP

### 5.4 Security

- JWT authentication with expiry
- Refresh token rotation
- Password hashing
- RBAC and permission guards
- Input validation
- Audit logs
- Secure secrets management
- Rate limiting for auth endpoints

### 5.5 Maintainability

- Modular code organization
- Service layer separation
- Shared validation and error handling
- Database migration discipline with Prisma

### 5.6 Reliability

- Transactional consistency for approvals and payroll publication
- Soft deletion for sensitive records where applicable

## 6. High-Level Architecture

### 6.1 Architecture Flow

User
-> React Frontend
-> Express API
-> Service Layer
-> Prisma ORM
-> PostgreSQL

### 6.2 Technology Stack

Frontend:

- React
- React Router
- State management with Context API, Redux Toolkit, or Zustand
- UI library optional based on design direction

Backend:

- Node.js
- Express.js
- Prisma ORM
- Zod or Joi for validation

Database:

- PostgreSQL

Infrastructure:

- Vercel for frontend
- Render for backend
- Neon PostgreSQL for database

## 7. Suggested Project Structure

### 7.1 Backend

```text
backend/
  src/
    config/
    controllers/
    routes/
    services/
    repositories/
    middleware/
    validators/
    utils/
    modules/
      auth/
      users/
      roles/
      employees/
      departments/
      attendance/
      leaves/
      payroll/
      dashboard/
      reports/
      audit/
    app.ts
    server.ts
  prisma/
    schema.prisma
    migrations/
```

### 7.2 Frontend

```text
frontend/
  src/
    app/
    components/
    features/
      auth/
      employees/
      attendance/
      leaves/
      payroll/
      dashboard/
      reports/
    pages/
    layouts/
    services/
    hooks/
    utils/
    types/
```

## 8. Core Modules

### 8.1 Auth Module

- Login
- Logout
- Refresh token
- Password reset
- Session validation

### 8.2 Role and Permission Module

- Manage roles
- Manage permissions
- Attach permissions to roles
- Attach role to user

### 8.3 Employee Module

- Employee profile
- Employment details
- Reporting hierarchy
- Documents

### 8.4 Attendance Module

- Check-in
- Check-out
- Daily status
- Attendance history
- Manual correction requests

### 8.5 Leave Module

- Leave types
- Leave balances
- Apply leave
- Approve or reject leave
- Track leave history

### 8.6 Payroll Module

- Salary templates
- Monthly payroll entries
- Payslip records

### 8.7 Dashboard Module

- Aggregated metrics by role

### 8.8 Reports Module

- Employee reports
- Attendance reports
- Leave reports
- Payroll reports

### 8.9 Audit Module

- Track sensitive actions and actor identity

## 9. Database Design

The original model is expanded here to better support workflow and reporting.

### 9.1 Main Tables

#### Users

- id (PK)
- email (unique)
- password_hash
- role_id (FK)
- employee_id (FK, nullable until employee record linked)
- is_active
- last_login_at
- created_at
- updated_at

#### Roles

- id (PK)
- name (unique)
- description
- created_at

#### Permissions

- id (PK)
- code (unique)
- name
- description

#### RolePermissions

- id (PK)
- role_id (FK)
- permission_id (FK)

#### Departments

- id (PK)
- name
- code
- head_employee_id (FK, nullable)
- created_at
- updated_at

#### Designations

- id (PK)
- name
- created_at

#### Employees

- id (PK)
- user_id (FK, unique)
- employee_code (unique)
- first_name
- last_name
- phone
- gender
- date_of_birth
- joining_date
- employment_status
- department_id (FK)
- designation_id (FK)
- manager_id (FK, self-reference, nullable)
- shift_id (FK, nullable)
- address
- emergency_contact_name
- emergency_contact_phone
- created_at
- updated_at
- deleted_at (nullable)

#### Shifts

- id (PK)
- name
- start_time
- end_time
- grace_minutes
- created_at

#### AttendanceRecords

- id (PK)
- employee_id (FK)
- attendance_date
- check_in_time
- check_out_time
- status
- worked_minutes
- late_minutes
- early_exit_minutes
- source
- remarks
- created_at
- updated_at

Constraint:

- unique(employee_id, attendance_date)

#### LeaveTypes

- id (PK)
- name
- code
- default_days_per_year
- requires_approval
- is_paid
- created_at

#### LeaveBalances

- id (PK)
- employee_id (FK)
- leave_type_id (FK)
- year
- allocated_days
- used_days
- remaining_days
- updated_at

Constraint:

- unique(employee_id, leave_type_id, year)

#### LeaveRequests

- id (PK)
- employee_id (FK)
- leave_type_id (FK)
- start_date
- end_date
- total_days
- session_type
- reason
- status
- applied_at
- approved_by (FK to employees, nullable)
- approved_at (nullable)
- rejection_reason (nullable)
- created_at
- updated_at

#### PayrollRecords

- id (PK)
- employee_id (FK)
- month
- year
- basic_salary
- allowances
- deductions
- net_salary
- currency
- status
- generated_at
- published_at (nullable)
- created_at
- updated_at

Constraint:

- unique(employee_id, month, year)

#### Payslips

- id (PK)
- payroll_record_id (FK, unique)
- file_url
- created_at

#### Documents

- id (PK)
- employee_id (FK)
- document_type
- file_url
- uploaded_at

#### AuditLogs

- id (PK)
- actor_user_id (FK)
- action
- entity_type
- entity_id
- metadata_json
- created_at

#### RefreshTokens

- id (PK)
- user_id (FK)
- token_hash
- expires_at
- revoked_at (nullable)
- created_at

### 9.2 Key Relationships

- Role -> Users = 1:N
- Role -> Permissions = M:N through RolePermissions
- User -> Employee = 1:1
- Department -> Employees = 1:N
- Designation -> Employees = 1:N
- Employee -> Manager = self-reference 1:N
- Employee -> AttendanceRecords = 1:N
- Employee -> LeaveRequests = 1:N
- Employee -> LeaveBalances = 1:N
- Employee -> PayrollRecords = 1:N
- PayrollRecord -> Payslip = 1:1
- Employee -> Documents = 1:N

### 9.3 Indexing Strategy

Indexes should be added on:

- users.email
- users.role_id
- employees.employee_code
- employees.department_id
- employees.manager_id
- attendance_records.employee_id
- attendance_records.attendance_date
- leave_requests.employee_id
- leave_requests.status
- payroll_records.employee_id
- payroll_records.month, payroll_records.year
- audit_logs.actor_user_id
- audit_logs.created_at

## 10. API Design

APIs should be designed around resources plus workflow actions.

### 10.1 Auth

- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/refresh
- POST /api/auth/forgot-password
- POST /api/auth/reset-password
- GET /api/auth/me

### 10.2 Roles and Permissions

- GET /api/roles
- POST /api/roles
- PUT /api/roles/:id
- GET /api/permissions
- PUT /api/roles/:id/permissions

### 10.3 Employees

- GET /api/employees
- GET /api/employees/:id
- POST /api/employees
- PUT /api/employees/:id
- PATCH /api/employees/:id/status
- GET /api/employees/:id/documents
- POST /api/employees/:id/documents

### 10.4 Departments

- GET /api/departments
- POST /api/departments
- PUT /api/departments/:id

### 10.5 Attendance

- POST /api/attendance/check-in
- POST /api/attendance/check-out
- GET /api/attendance
- GET /api/attendance/:id
- GET /api/attendance/employee/:employeeId
- POST /api/attendance/regularization

### 10.6 Leaves

- GET /api/leave-types
- GET /api/leave-balances/me
- GET /api/leaves
- POST /api/leaves
- GET /api/leaves/:id
- PUT /api/leaves/:id/cancel
- PUT /api/leaves/:id/approve
- PUT /api/leaves/:id/reject

### 10.7 Team

- GET /api/team/members
- GET /api/team/attendance
- GET /api/team/leaves

### 10.8 Payroll

- GET /api/payroll
- GET /api/payroll/:id
- POST /api/payroll/generate
- PUT /api/payroll/:id/publish
- GET /api/payroll/employee/:employeeId
- GET /api/payslips/:payrollRecordId

### 10.9 Dashboard

- GET /api/dashboard/employee
- GET /api/dashboard/manager
- GET /api/dashboard/hr
- GET /api/dashboard/admin

### 10.10 Reports

- GET /api/reports/employees
- GET /api/reports/attendance
- GET /api/reports/leaves
- GET /api/reports/payroll

### 10.11 Audit

- GET /api/audit-logs

## 11. API Response Standards

### 11.1 Success Response

```json
{
  "success": true,
  "message": "Request successful",
  "data": {}
}
```

### 11.2 Error Response

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ]
}
```

## 12. Security Design

### 12.1 Authentication

- Access token using JWT
- Short-lived access token expiry
- Refresh token rotation
- Password hashing with bcrypt

### 12.2 Authorization

- Route-level auth middleware
- Role guards
- Permission guards
- Data-level restrictions by role and reporting hierarchy

### 12.3 API Protection

- Input validation for body, query, and params
- Rate limiting on auth and sensitive endpoints
- Centralized error handling
- Secure headers
- CORS policy

### 12.4 Sensitive Data Controls

- Avoid returning password hashes or refresh tokens
- Restrict payroll visibility to authorized users only
- Audit critical state changes

## 13. Business Rules

- One attendance record per employee per date
- Employee cannot check out before check in
- Employee cannot approve their own leave
- Manager can only approve authorized team leave
- HR and Admin may override based on policy
- Leave requests must be checked against leave balance
- One payroll record per employee per month and year
- Soft delete preferred over hard delete for employee records

## 14. Data Flow

### 14.1 Login

User
-> Auth API
-> Validate credentials
-> Generate access token and refresh token
-> Return authenticated profile with role and permissions

### 14.2 Attendance Check-In

Employee
-> Attendance API
-> Validate session and daily uniqueness
-> Save check-in record
-> Return attendance status

### 14.3 Leave Application

Employee
-> Leave API
-> Validate leave balance and date overlap
-> Create pending request
-> Notify manager or HR

### 14.4 Leave Approval

Manager or HR
-> Leave API approve or reject action
-> Validate authority
-> Update leave status
-> Update leave balance if approved
-> Write audit log

### 14.5 Payroll Publication

HR or Admin
-> Payroll API generate
-> Create monthly payroll record
-> Publish payroll
-> Employee accesses payslip

## 15. Deployment Architecture

### 15.1 Deployment Flow

User
-> Vercel Frontend
-> Render Backend API
-> Neon PostgreSQL

### 15.2 Environment Variables

Frontend:

- VITE_API_BASE_URL

Backend:

- DATABASE_URL
- JWT_SECRET
- JWT_REFRESH_SECRET
- BCRYPT_SALT_ROUNDS
- FRONTEND_URL
- NODE_ENV

### 15.3 CI/CD

- Push to GitHub
- Run lint and tests in CI
- Deploy frontend to Vercel
- Deploy backend to Render
- Run Prisma migrations during controlled deployment step

### 15.4 Migration Strategy

- Version database with Prisma migrations
- Never mutate production schema manually
- Run migrations before app traffic switch if possible
- Seed only non-sensitive reference data

## 16. Recommended Implementation Phases

### Phase 1

- Auth
- Roles
- Employees
- Departments

### Phase 2

- Attendance
- Leave types
- Leave balances
- Leave workflow

### Phase 3

- Payroll
- Payslips
- Dashboards
- Reports

### Phase 4

- Audit logs
- Notifications
- Performance tuning
- Export improvements

## 17. Final Assessment

The original architecture was a solid MVP baseline, but it needed stronger workflow modeling, permission design, and record history support. This v2 design keeps the same overall stack and product direction while making the system significantly more realistic to implement and maintain.

Key improvements in v2:

- Corrected payroll relationship from 1:1 to 1:N
- Added permission model for configurable RBAC
- Added leave balances and leave types
- Added audit logs and refresh tokens
- Expanded employee and attendance schema
- Reworked APIs to include workflow actions
- Added business rules and migration discipline

This design is now suitable as a stronger implementation blueprint for backend APIs, Prisma schema design, and frontend module planning.
