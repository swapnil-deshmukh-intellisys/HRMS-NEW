import "./DashboardPage.css";
import "./BirthdayMode.css";
import { Suspense } from "react";
import type { Role } from "../../types";
import { useApp } from "../../context/AppContext";
import MessageCard from "../../components/common/MessageCard";

import EmployeeDashboard from "./EmployeeDashboard";
import ManagementDashboard from "./ManagementDashboard";

type DashboardPageProps = {
  token: string | null;
  role: Role;
};

export default function DashboardPage({ token, role }: DashboardPageProps) {
  const { summary, error: summaryError } = useApp();

  const isBirthdayToday = (() => {
    const dobStr = summary?.currentEmployee?.dateOfBirth;
    if (!dobStr) return false;
    
    const dob = new Date(dobStr);
    const today = new Date();
    return dob.getDate() === today.getDate() && dob.getMonth() === today.getMonth();
  })();

  return (
    <section className={`stack ${isBirthdayToday ? "birthday-mode-container" : ""}`}>
      {summaryError ? <MessageCard title="Dashboard issue" tone="error" message={summaryError} /> : null}
      
      {isBirthdayToday && (
        <div className="birthday-greeting-banner">
          <div className="birthday-greeting-content">
            <span className="birthday-emoji">🎂</span>
            <div className="birthday-text">
              <h1>Happy Birthday, {summary?.currentEmployee?.firstName}!</h1>
              <p>Wishing you a wonderful day filled with joy and celebration. ✨</p>
            </div>
            <span className="birthday-emoji">🎉</span>
          </div>
        </div>
      )}

      <Suspense fallback={<div className="page-loading">Loading dashboard...</div>}>
        {role === "EMPLOYEE" ? (
          <EmployeeDashboard token={token} />
        ) : (
          <ManagementDashboard token={token} role={role} />
        )}
      </Suspense>
    </section>
  );
}
