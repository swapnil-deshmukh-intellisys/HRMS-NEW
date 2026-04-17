import "./DashboardPage.css";
import { lazy, Suspense } from "react";
import type { Role } from "../../types";
import { useApp } from "../../context/AppContext";
import MessageCard from "../../components/common/MessageCard";

const EmployeeDashboard = lazy(() => import("./EmployeeDashboard"));
const ManagementDashboard = lazy(() => import("./ManagementDashboard"));

type DashboardPageProps = {
  token: string | null;
  role: Role;
};

export default function DashboardPage({ token, role }: DashboardPageProps) {
  const { error: summaryError } = useApp();

  return (
    <section className="stack">
      {summaryError ? <MessageCard title="Dashboard issue" tone="error" message={summaryError} /> : null}
      
      <Suspense fallback={<div className="page-loading">Loading dashboard...</div>}>
        {role === "EMPLOYEE" ? (
          <EmployeeDashboard />
        ) : (
          <ManagementDashboard token={token} role={role} />
        )}
      </Suspense>
    </section>
  );
}
