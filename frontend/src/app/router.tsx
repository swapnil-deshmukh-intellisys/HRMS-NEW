import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "../features/auth/LoginPage";
import AttendancePage from "../features/attendance/AttendancePage";
import DashboardPage from "../features/dashboard/DashboardPage";
import DepartmentsPage from "../features/departments/DepartmentsPage";
import EmployeeProfilePage from "../features/employees/EmployeeProfilePage";
import EmployeesPage from "../features/employees/EmployeesPage";
import LeavesPage from "../features/leaves/LeavesPage";
import PayrollPage from "../features/payroll/PayrollPage";
import { useAuth } from "../hooks/useAuth";
import AppLayout from "../layout/AppLayout";

function AppRoutes() {
  const { token, sessionUser, loadingSession, login, logout } = useAuth();

  if (loadingSession) {
    return <div className="center-message">Loading HRMS workspace...</div>;
  }

  return (
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
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
