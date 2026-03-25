# HRMS Lean V1

Lean, production-ready HRMS MVP built with:

- React
- Express
- Prisma
- PostgreSQL
- JWT authentication

## Project Structure

- `backend/` Express API, Prisma schema, seed script
- `frontend/` React app for HRMS workflows
- `docs/` architecture and planning documents

## Setup

1. Install dependencies:

```powershell
npm install
```

2. Create backend env file from the example:

```powershell
Copy-Item backend\.env.example backend\.env
```

3. Create frontend env file from the example:

```powershell
Copy-Item frontend\.env.example frontend\.env
```

4. Update `backend/.env` with your PostgreSQL connection string and JWT secret.

5. Run Prisma migration and seed:

```powershell
npm --workspace backend run prisma:migrate
npm --workspace backend run prisma:seed
```

6. Start the backend:

```powershell
npm --workspace backend run dev
```

7. Start the frontend:

```powershell
npm --workspace frontend run dev
```

## Default Seed Login

- Email: `admin@hrms.local`
- Password: `Admin@123`

## Implemented Lean V1 Modules

- Auth: login, logout, current user
- Departments
- Employees
- Attendance
- Leave types, balances, requests, approval
- Payroll
- Role-based dashboards

## Notes

- Leave balances must exist for employees before leave approval can succeed.
- V1 uses role-based access in code and does not include refresh tokens, audit logs, or permissions.
- Payroll is intentionally simple in V1: one monthly record per employee.
