import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { formatAttendanceTime } from "../../utils/format";
import DashboardHeroClocks from "./DashboardHeroClocks";
import ThoughtOfTheDay from "./ThoughtOfTheDay";
import AnnouncementList from "./AnnouncementList";
import WorkdayTimeline from "./WorkdayTimeline";
import { formatWorkedDuration, getAttendanceWidgetTitle } from "./dashboardUtils";
import type { Attendance } from "../../types";

function getIndiaTimeGreeting() {
  const formatter = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
  const hourPart = formatter.formatToParts(new Date()).find((part) => part.type === "hour");
  const hour = Number(hourPart?.value ?? "12");

  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

function getAttendanceStatusNote(attendance: Attendance | null) {
  if (!attendance) return "You have not marked attendance yet.";
  if (attendance.status === "LEAVE") {
    return attendance.leaveTypeName ? `${attendance.leaveTypeName} leave is active for today.` : "You are marked on leave for today.";
  }
  if (attendance.checkOutTime) return "Your workday has been completed and checked out.";
  if (attendance.checkInTime) return "You are checked in. Check out when your workday ends.";
  if (attendance.status === "HALF_DAY") return "Half day is marked for today.";
  if (attendance.status === "ABSENT") return "You are marked absent for today.";
  return "Attendance status is available for today.";
}

export default function EmployeeDashboard({ token }: { token: string | null }) {
  const navigate = useNavigate();
  const { summary } = useApp();
  
  const attendanceToday = summary?.attendanceToday ?? null;
  const currentEmployee = summary?.currentEmployee ?? null;
  const todayLabel = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long" });
  const attendanceStatusNote = getAttendanceStatusNote(attendanceToday);

  return (
    <>
      <article className="card dashboard-hero">
        <div className="dashboard-hero-copy">
          <div className="dashboard-hero-top-row">
            <ThoughtOfTheDay />
            <div className="dashboard-hero-header">
              <h3>
                {getIndiaTimeGreeting()}
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
      <WorkdayTimeline />

      <div className="grid cols-2 dashboard-grid">
        <article className="card metric-card metric-card--status">
          <p className="eyebrow">Attendance today</p>
          <strong>{getAttendanceWidgetTitle(attendanceToday)}</strong>
          <p className="muted">{todayLabel}</p>
          <p className="dashboard-attendance-note">{attendanceStatusNote}</p>
          <div className="attendance-widget-meta">
            <div className="table-cell-stack">
              <span className="table-cell-secondary">Check in</span>
              <span className="table-cell-primary">{formatAttendanceTime(attendanceToday?.checkInTime)}</span>
            </div>
            <div className="table-cell-stack">
              <span className="table-cell-secondary">Check out</span>
              <span className="table-cell-primary">{formatAttendanceTime(attendanceToday?.checkOutTime)}</span>
            </div>
            <div className="table-cell-stack">
              <span className="table-cell-secondary">Worked</span>
              <span className="table-cell-primary">
                {attendanceToday?.status === "LEAVE" ? "-" : formatWorkedDuration(attendanceToday?.workedMinutes)}
              </span>
            </div>
          </div>
          <div className="dashboard-inline-row">
            <span>Next step</span>
            <button className="secondary" onClick={() => navigate(attendanceToday?.status === "LEAVE" ? "/leaves" : "/attendance")}>
              {attendanceToday?.status === "LEAVE" ? "Open leaves" : "Open attendance"}
            </button>
          </div>
        </article>

        <article className="card metric-card metric-card--project">
          <div className="metric-card-header">
            <div>
              <p className="eyebrow">Workspace</p>
              <strong>{currentEmployee?.department ? `${currentEmployee.department.name} team` : "Department not linked"}</strong>
            </div>
          </div>
          <p className="muted">
            {currentEmployee?.manager
              ? `Reporting to ${currentEmployee.manager.firstName} ${currentEmployee.manager.lastName}`
              : "Manager not assigned yet"}
          </p>
          <div className="dashboard-project-meta">
            <div className="table-cell-stack">
              <span className="table-cell-secondary">Scoped team members</span>
              <span className="table-cell-primary">{String(summary?.scopedTeamCount ?? 0)}</span>
            </div>
            <div className="table-cell-stack">
              <span className="table-cell-secondary">Pending team leaves</span>
              <span className="table-cell-primary">{String(summary?.pendingTeamLeaves ?? 0)}</span>
            </div>
          </div>
          <div className="dashboard-inline-row" style={{ justifyContent: "flex-end" }}>
            <div className="dashboard-card-actions">
              <button className="secondary" onClick={() => navigate("/attendance")}>
                Review team attendance
              </button>
              <button className="secondary" onClick={() => navigate("/analytics")}>
                Open analytics
              </button>
            </div>
          </div>
        </article>
      </div>
    </>
  );
}
