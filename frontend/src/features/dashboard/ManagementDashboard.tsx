import { useState } from "react";
import { useNavigate } from "react-router-dom";

import type { Role } from "../../types";
import DashboardHeroClocks from "./DashboardHeroClocks";
import ThoughtOfTheDay from "./ThoughtOfTheDay";
import AnnouncementForm from "./AnnouncementForm";
import AnnouncementList from "./AnnouncementList";
import WorkdayTimeline from "./WorkdayTimeline";
import Modal from "../../components/common/Modal";
import { useApp, type DashboardSummary } from "../../context/AppContext";
import TodoWidget from "./TodoWidget";
import BirthdayCelebrations from "./BirthdayCelebrations";
import TeamOnLeaveWidget from "./TeamOnLeaveWidget";
import { addMinutesToTime } from "../../utils/format";




function getDashboardContent(role: Role) {
  if (role === "MANAGER") {
    return {
      eyebrow: "Team operations",
      title: "Team overview",
      description: "Stay on top of the main team counters and move into analytics when you need trends.",
    };
  }

  if (role === "HR") {
    return {
      eyebrow: "HR operations",
      title: "Workforce in motion",
      description: "Keep the dashboard focused on essential operations and use analytics for deeper visual review.",
    };
  }

  return {
    eyebrow: "Executive overview",
    title: "Operations command center",
    description: "Track the key workforce numbers here and open analytics for detailed patterns and trends.",
  };
}

export default function ManagementDashboard({ token, role }: { token: string | null; role: Role }) {
  const navigate = useNavigate();
  const { summary, loading } = useApp();
  const [announcementKey, setAnnouncementKey] = useState(0);
  const [isAnnouncementModalOpen, setAnnouncementModalOpen] = useState(false);
  const bannerContent = getDashboardContent(role);

  const data = summary || ({} as DashboardSummary);

  if (loading) {
    return (
      <div className="page-loading">
        <article className="card skeleton-card skeleton-card--hero">
          <span className="skeleton-line skeleton-line--short" />
          <span className="skeleton-line skeleton-line--title" />
          <span className="skeleton-line skeleton-line--long" />
        </article>
      </div>
    );
  }

  return (
    <>
      <article className="card dashboard-hero">
        <div className="dashboard-hero-copy">
          <div className="dashboard-hero-top-row management-top-row">
            <div className="dashboard-hero-header dashboard-hero-header--left">
              <div className="dashboard-hero-greeting-container">
                <span className="greeting-text">Welcome,</span>
                <span className="greeting-name">
                  {data.currentEmployee?.firstName} {data.currentEmployee?.lastName}
                </span>
                {data.currentEmployee?.jobTitle && (
                  <span className="dashboard-hero-designation-badge">
                    {data.currentEmployee.jobTitle}
                  </span>
                )}
              </div>
              <div className="dashboard-hero-context-title">
                {bannerContent.eyebrow ? (
                  <span className="context-eyebrow">{bannerContent.eyebrow}</span>
                ) : null}
                {bannerContent.eyebrow && bannerContent.title ? (
                  <span className="context-divider">|</span>
                ) : null}
                {bannerContent.title ? (
                  <span className="context-title">{bannerContent.title}</span>
                ) : null}
              </div>
            </div>
            <ThoughtOfTheDay jobTitle={data.currentEmployee?.jobTitle} role={role} />
          </div>
          <AnnouncementList token={token} refreshSignal={announcementKey} onCreateClick={() => setAnnouncementModalOpen(true)} />
          <DashboardHeroClocks />
        </div>
      </article>

      <WorkdayTimeline 
        employeeId={data.currentEmployee?.id}
        startTime={data.currentEmployee?.shift?.startTime}
        endTime={data.currentEmployee?.shift?.endTime}
        lateThreshold={data.currentEmployee?.shift ? addMinutesToTime(data.currentEmployee.shift.startTime, data.currentEmployee.shift.gracePeriodMinutes) : undefined}
        checkInTime={data.attendanceToday?.checkInTime ?? null} 
        checkOutTime={data.attendanceToday?.checkOutTime ?? null}
        workedMinutes={data.attendanceToday?.workedMinutes ?? null}
        penaltyMinutes={data.attendanceToday?.penaltyMinutes ?? null}
        token={token} 
      />

      <Modal open={isAnnouncementModalOpen} onClose={() => setAnnouncementModalOpen(false)} className="broadcast-studio-modal">
        <AnnouncementForm token={token} onCreated={() => { setAnnouncementKey(k => k + 1); setAnnouncementModalOpen(false); }} />
      </Modal>

      <div className="grid cols-2 dashboard-grid">
        {Object.entries(data)
          .filter(([key]) => !["attendanceToday", "currentEmployee", "leaveRequests", "isTeamLead", "teamOnLeaveToday", "pendingCorrectionRequests", "pendingIncentiveApprovals"].includes(key))
          .map(([key, value]) => {
            const getNavigationPath = () => {
              switch (key) {
                case "teamCount": return "/team";
                case "pendingApprovals": return "/attendance/requests";
                case "employees": return "/employees";
                case "pendingLeaves": return "/leaves";
                case "teamPresentToday": return "/team";
                case "payrollCount": return "/payroll";
                case "departments": return "/departments";
                default: return null;
              }
            };

            const navigationPath = getNavigationPath();

            return (
              <article
                key={key}
                className={`card metric-card metric-card--${typeof value === "object" ? "status" : "numeric"}${navigationPath ? " metric-card--clickable" : ""}`}
                onClick={navigationPath ? () => navigate(navigationPath) : undefined}
                style={navigationPath ? { cursor: "pointer" } : undefined}
              >
                <p className="eyebrow">
                  {key === "teamCount" ? "Team members" :
                    key === "pendingApprovals" ? "Correction requests" :
                      key === "pendingLeaves" ? "Leave requests" :
                        key === "teamPresentToday" ? "Team presence today" :
                          key === "employees" ? "Employees" :
                            key === "departments" ? "Departments" :
                              key === "payrollCount" ? "Payroll records" : key}
                </p>
                <strong>{String(value ?? "-")}</strong>
                <p className="muted">
                  {key === "pendingApprovals" ? "Review required" :
                    key === "pendingLeaves" ? "Awaiting your decision" :
                      key === "teamPresentToday" ? "Checked-in members" :
                        "Live summary"}
                </p>
              </article>
            );
          })}
      </div>

      <div className="grid cols-3 dashboard-grid">
        <TeamOnLeaveWidget />
        <TodoWidget token={token} />
        <BirthdayCelebrations token={token} />
      </div>

    </>
  );
}
