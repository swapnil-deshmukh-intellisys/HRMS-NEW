import "./DashboardPage.css";
import { lazy, Suspense } from "react";
import type { Role } from "../../types";

const EmployeeAnalytics = lazy(() => import("./EmployeeAnalytics"));
const ManagementAnalytics = lazy(() => import("./ManagementAnalytics"));

type DashboardPageProps = {
  token: string | null;
  role: Role;
  currentEmployeeId: number | null;
};

export default function AnalyticsPage({ token, role }: DashboardPageProps) {
  return (
    <section className="stack">
      <Suspense fallback={<div className="page-loading">Loading analytics...</div>}>
        {role === "EMPLOYEE" ? (
          <EmployeeAnalytics />
        ) : (
          <ManagementAnalytics token={token} role={role} />
        )}
      </Suspense>
    </section>
  );
}
