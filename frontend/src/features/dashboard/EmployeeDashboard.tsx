import { Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import DashboardHeroClocks from "./DashboardHeroClocks";
import ThoughtOfTheDay from "./ThoughtOfTheDay";
import AnnouncementList from "./AnnouncementList";
import WorkdayTimeline from "./WorkdayTimeline";
import { apiRequest } from "../../services/api";
import { useState } from "react";
import TodoWidget from "./TodoWidget";
import BirthdayCelebrations from "./BirthdayCelebrations";


export default function EmployeeDashboard({ token }: { token: string | null }) {
  const navigate = useNavigate();
  const { summary } = useApp();
  const [isStartingMeet, setIsStartingMeet] = useState(false);

  const attendanceToday = summary?.attendanceToday ?? null;
  const currentEmployee = summary?.currentEmployee ?? null;

  const handleStartMeet = async () => {
    if (!currentEmployee?.user?.isGoogleLinked) {
      alert("Please link your Google Workspace account in your profile first.");
      return;
    }

    try {
      setIsStartingMeet(true);
      const res = await apiRequest<{ meetLink: string }>("/google/instant-meet", {
        method: "POST",
        token,
        body: { summary: `Quick Sync: ${currentEmployee.firstName}'s Workspace` }
      });

      if (res.data?.meetLink) {
        window.open(res.data.meetLink, "_blank");
      }
    } catch (err: any) {
      alert(err.message || "Failed to start Google Meet");
    } finally {
      setIsStartingMeet(false);
    }
  };

  return (
    <section className="stack">
      <article className="card dashboard-hero">
        <div className="dashboard-hero-copy">
          <div className="dashboard-hero-top-row">
            <ThoughtOfTheDay />
            <div className="dashboard-hero-header">
              <h3>
                Hi
                {currentEmployee?.firstName ? (
                  <>
                    , <span className="greeting-name">{currentEmployee.firstName}</span>
                  </>
                ) : null}
              </h3>
            </div>
          </div>
          <AnnouncementList token={token} />
          <DashboardHeroClocks />
        </div>
      </article>

      {/* Workday Progress Section */}
      <WorkdayTimeline checkInTime={attendanceToday?.checkInTime ?? null} token={token} />

      {/* Primary Action Row: Workspace, Tasks, & Celebrations */}
      <div className="grid cols-3 dashboard-grid">
        {/* Workspace Widget */}
        <article className="card metric-card metric-card--project">
          <div className="metric-card-header">
            <div className="stack" style={{ gap: '4px' }}>
              <span className="eyebrow eyebrow--purple">My Workspace</span>
              <h3 style={{ margin: 0 }}>
                {currentEmployee?.department ? `${currentEmployee.department.name} Team` : "Global Hub"}
              </h3>
            </div>
          </div>
          <div className="stack gap-1">
            <p className="muted" style={{ margin: 0 }}>
              {currentEmployee?.manager
                ? `Reporting to ${currentEmployee.manager.firstName} ${currentEmployee.manager.lastName}`
                : "Manager not assigned yet"}
            </p>
          </div>
          <div className="attendance-widget-meta" style={{ marginTop: 'auto' }}>
            <div className="table-cell-stack">
              <span className="table-cell-secondary">Team Size</span>
              <span className="table-cell-primary">{summary?.scopedTeamCount || 0} Members</span>
            </div>
            <div className="table-cell-stack">
              <span className="table-cell-secondary">Pending Leaves</span>
              <span className="table-cell-primary">{summary?.pendingTeamLeaves || 0} Members</span>
            </div>
          </div>
          <div className="dashboard-card-actions">
            <button
              className="button button--secondary dashboard-card-link"
              onClick={handleStartMeet}
              disabled={isStartingMeet}
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <Video size={16} />
              {isStartingMeet ? "Connecting..." : "Instant Meet"}
            </button>

          </div>
        </article>

        {/* Todo List - Taking up space for visibility */}
        <TodoWidget token={token} />

        {/* Birthday Celebrations */}
        <BirthdayCelebrations token={token} />
      </div>
    </section>
  );
}
