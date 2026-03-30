import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const LoginPage = lazy(() => import("../features/auth/LoginPage"));
const AttendancePage = lazy(() => import("../features/attendance/AttendancePage"));
const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage"));
const CalendarPage = lazy(() => import("../features/calendar/CalendarPage"));
const DepartmentsPage = lazy(() => import("../features/departments/DepartmentsPage"));
const EmployeeProfilePage = lazy(() => import("../features/employees/EmployeeProfilePage"));
const EmployeesPage = lazy(() => import("../features/employees/EmployeesPage"));
const LeavesPage = lazy(() => import("../features/leaves/LeavesPage"));
const PayrollPage = lazy(() => import("../features/payroll/PayrollPage"));
const AppLayout = lazy(() => import("../layout/AppLayout"));

function RouteLoadingFallback() {
  return <div className="center-message">Loading HRMS workspace...</div>;
}

function AppRoutes() {
  const { token, sessionUser, loadingSession, login, logout } = useAuth();

  if (loadingSession) {
    return <div className="center-message">Loading HRMS workspace...</div>;
  }

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/login" element={sessionUser ? <Navigate to="/" replace /> : <LoginPage onLogin={login} />} />
        <Route
          element={sessionUser ? <AppLayout token={token} sessionUser={sessionUser} onLogout={logout} /> : <Navigate to="/login" replace />}
        >
          <Route
            index
            element={<DashboardPage token={token} role={sessionUser?.role ?? "EMPLOYEE"} currentEmployeeId={sessionUser?.employee?.id ?? null} />}
          />
          <Route path="/departments" element={<DepartmentsPage token={token} role={sessionUser?.role ?? "EMPLOYEE"} />} />
          <Route path="/employees" element={<EmployeesPage token={token} role={sessionUser?.role ?? "EMPLOYEE"} />} />
          <Route
            path="/employees/:id"
            element={
              <EmployeeProfilePage
                token={token}
                role={sessionUser?.role ?? "EMPLOYEE"}
                currentEmployeeId={sessionUser?.employee?.id ?? null}
              />
            }
          />
          <Route path="/calendar" element={<CalendarPage token={token} role={sessionUser?.role ?? "EMPLOYEE"} />} />
          <Route
            path="/attendance"
            element={
              <AttendancePage
                token={token}
                role={sessionUser?.role ?? "EMPLOYEE"}
                currentEmployeeId={sessionUser?.employee?.id ?? null}
                currentEmployee={sessionUser?.employee ?? null}
              />
            }
          />
          <Route
            path="/leaves"
            element={
              <LeavesPage
                token={token}
                role={sessionUser?.role ?? "EMPLOYEE"}
                currentEmployeeId={sessionUser?.employee?.id ?? null}
                currentEmployee={sessionUser?.employee ?? null}
              />
            }
          />
          <Route path="/payroll" element={<PayrollPage token={token} role={sessionUser?.role ?? "EMPLOYEE"} />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
