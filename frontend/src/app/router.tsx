import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ErrorBoundary } from "../components/ErrorBoundary";

const LoginPage = lazy(() => import("../features/auth/LoginPage"));
const AttendancePage = lazy(() => import("../features/attendance/AttendancePage"));
const AttendanceRequestsPage = lazy(() => import("../features/attendance/AttendanceRequestsPage"));
const AnalyticsPage = lazy(() => import("../features/dashboard/AnalyticsPage"));
const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage"));
const CalendarPage = lazy(() => import("../features/calendar/CalendarPage"));
const DepartmentsPage = lazy(() => import("../features/departments/DepartmentsPage"));
const EmployeeProfilePage = lazy(() => import("../features/employees/EmployeeProfilePage"));
const EmployeesPage = lazy(() => import("../features/employees/EmployeesPage"));
const LeavesPage = lazy(() => import("../features/leaves/LeavesPage"));
const TeamPage = lazy(() => import("../features/team/TeamPage"));
const PayrollPage = lazy(() => import("../features/payroll/PayrollPage"));
const PayrollHistoryPage = lazy(() => import("../features/payroll/PayrollHistoryPage"));
const IncentivesPage = lazy(() => import("../features/payroll/IncentivesPage"));
const GoogleCallbackPage = lazy(() => import("../features/google/GoogleCallbackPage"));
const TodoHistoryPage = lazy(() => import("../features/dashboard/TodoHistoryPage"));
const AssignedTasksHistoryPage = lazy(() => import("../features/dashboard/AssignedTasksHistoryPage"));
const ManageTasksPage = lazy(() => import("../features/tasks/ManageTasksPage"));
const EmployeeTodosPage = lazy(() => import("../features/tasks/EmployeeTodosPage"));
const NotificationsPage = lazy(() => import("../features/notifications/NotificationsPage"));
const AppLayout = lazy(() => import("../layout/AppLayout"));
import { AppProvider } from "../context/AppContext";

function RouteLoadingFallback() {
  return <div className="center-message">Loading HRMS workspace...</div>;
}

/**
 * Wraps a page element with a per-route Suspense + ErrorBoundary so that:
 * - Lazy-load failures show a loading indicator (Suspense)
 * - Runtime render errors show a recovery card (ErrorBoundary)
 *   instead of a blank screen.
 */
function Page({ children, context }: { children: React.ReactNode; context: string }) {
  return (
    <ErrorBoundary context={context}>
      <Suspense fallback={<RouteLoadingFallback />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

function AppRoutes() {
  const { token, sessionUser, loadingSession, login, logout, sessionWarning, refreshSession, updateLastActivity } = useAuth();

  if (loadingSession) {
    return <div className="center-message">Loading HRMS workspace...</div>;
  }

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/login" element={sessionUser ? <Navigate to="/" replace /> : (
          <Page context="Login">
            <LoginPage onLogin={login} />
          </Page>
        )} />
        <Route
          element={
            sessionUser ? (
              <ErrorBoundary context="App Shell">
                <AppProvider token={token} role={sessionUser.role}>
                  <AppLayout
                    token={token}
                    sessionUser={sessionUser}
                    onLogout={logout}
                    sessionWarning={sessionWarning}
                    onRefreshSession={refreshSession}
                    onUserActivity={updateLastActivity}
                  />
                </AppProvider>
              </ErrorBoundary>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route
            index
            element={
              <Page context="Dashboard">
                <DashboardPage token={token} role={sessionUser?.role ?? "EMPLOYEE"} />
              </Page>
            }
          />
          <Route
            path="/analytics"
            element={
              <Page context="Analytics">
                <AnalyticsPage token={token} role={sessionUser?.role ?? "EMPLOYEE"} currentEmployeeId={sessionUser?.employee?.id ?? null} />
              </Page>
            }
          />
          <Route path="/departments" element={
            <Page context="Departments">
              <DepartmentsPage token={token} role={sessionUser?.role ?? "EMPLOYEE"} />
            </Page>
          } />
          <Route path="/employees" element={
            <Page context="Employees">
              <EmployeesPage token={token} role={sessionUser?.role ?? "EMPLOYEE"} />
            </Page>
          } />
          <Route
            path="/employees/:id"
            element={
              <Page context="Employee Profile">
                <EmployeeProfilePage
                  token={token}
                  role={sessionUser?.role ?? "EMPLOYEE"}
                  currentEmployeeId={sessionUser?.employee?.id ?? null}
                />
              </Page>
            }
          />
          <Route path="/calendar" element={
            <Page context="Calendar">
              <CalendarPage token={token} role={sessionUser?.role ?? "EMPLOYEE"} />
            </Page>
          } />
          <Route
            path="/attendance"
            element={
              <Page context="Attendance">
                <AttendancePage
                  token={token}
                  role={sessionUser?.role ?? "EMPLOYEE"}
                  currentEmployeeId={sessionUser?.employee?.id ?? null}
                  currentEmployee={sessionUser?.employee ?? null}
                />
              </Page>
            }
          />
          <Route
            path="/attendance/requests"
            element={
              <Page context="Attendance Requests">
                <AttendanceRequestsPage
                  token={token}
                  role={sessionUser?.role ?? "EMPLOYEE"}
                  currentEmployeeId={sessionUser?.employee?.id ?? null}
                />
              </Page>
            }
          />
          <Route
            path="/leaves"
            element={
              <Page context="Leaves">
                <LeavesPage
                  token={token}
                  role={sessionUser?.role ?? "EMPLOYEE"}
                  currentEmployeeId={sessionUser?.employee?.id ?? null}
                />
              </Page>
            }
          />
          <Route
            path="/team"
            element={
              <Page context="Team">
                <TeamPage
                  token={token}
                  role={sessionUser?.role ?? "EMPLOYEE"}
                  currentEmployeeId={sessionUser?.employee?.id ?? null}
                  currentEmployee={sessionUser?.employee ?? null}
                />
              </Page>
            }
          />
          <Route path="/payroll" element={
            <Page context="Payroll">
              <PayrollPage token={token} role={sessionUser?.role ?? "EMPLOYEE"} />
            </Page>
          } />
          <Route path="/payroll/history/:id" element={
            <Page context="Payroll History">
              <PayrollHistoryPage token={token} />
            </Page>
          } />
          <Route path="/incentives" element={
            <Page context="Incentives">
              <IncentivesPage token={token} role={sessionUser?.role ?? "EMPLOYEE"} />
            </Page>
          } />
          <Route path="/announcements" element={
            <Page context="Announcements">
              <DashboardPage token={token} role={sessionUser?.role ?? "EMPLOYEE"} />
            </Page>
          } />
          <Route path="/google-callback" element={
            <Page context="Google Callback">
              <GoogleCallbackPage token={token} />
            </Page>
          } />
          <Route path="/todos/history" element={
            <Page context="Todo History">
              <TodoHistoryPage token={token} />
            </Page>
          } />
          <Route path="/tasks/history" element={
            <Page context="Tasks History">
              <AssignedTasksHistoryPage token={token} />
            </Page>
          } />
          <Route path="/tasks/manage" element={
            <Page context="Manage Tasks">
              <ManageTasksPage token={token} />
            </Page>
          } />
          <Route path="/tasks/employee-todos" element={
            <Page context="Employee Todos">
              <EmployeeTodosPage token={token} />
            </Page>
          } />
          <Route path="/notifications" element={
            <Page context="Notifications">
              <NotificationsPage />
            </Page>
          } />
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
