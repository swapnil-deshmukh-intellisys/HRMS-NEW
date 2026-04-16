import "./DashboardPage.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ATTENDANCE_EVENT, getAttendanceUpdatedDetail } from "../../components/common/attendanceQuickActionUtils";
import MessageCard from "../../components/common/MessageCard";
import { apiRequest } from "../../services/api";
import type { EmployeeDashboardSummaryData, Role } from "../../types";
import { formatAttendanceTime } from "../../utils/format";
import TimeCard from "../../components/common/TimeCard";
import { formatWorkedDuration, getAttendanceWidgetTitle } from "./dashboardUtils";

type DashboardData = Record<string, number | string | boolean | null | undefined | object>;

type DashboardPageProps = {
  token: string | null;
  role: Role;
  currentEmployeeId: number | null;
};

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

function getDashboardContent(role: Role) {
  if (role === "EMPLOYEE") {
    return {
      eyebrow: "",
      title: getIndiaTimeGreeting(),
      description: "Use this dashboard for quick actions and essential workday updates.",
    };
  }

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

function getAttendanceStatusNote(attendance: EmployeeDashboardSummaryData["attendanceToday"]) {
  if (!attendance) {
    return "You have not marked attendance yet.";
  }

  if (attendance.status === "LEAVE") {
    return attendance.leaveTypeName ? `${attendance.leaveTypeName} leave is active for today.` : "You are marked on leave for today.";
  }

  if (attendance.checkOutTime) {
    return "Your workday has been completed and checked out.";
  }

  if (attendance.checkInTime) {
    return "You are checked in. Check out when your workday ends.";
  }

  if (attendance.status === "HALF_DAY") {
    return "Half day is marked for today.";
  }

  if (attendance.status === "ABSENT") {
    return "You are marked absent for today.";
  }

  return "Attendance status is available for today.";
}

export default function DashboardPage({ token, role }: DashboardPageProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData>({});
  const [employeeDashboard, setEmployeeDashboard] = useState<EmployeeDashboardSummaryData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const bannerContent = getDashboardContent(role);

  useEffect(() => {
    const endpoint = role === "EMPLOYEE" ? "/dashboard/employee-summary" : role === "MANAGER" ? "/dashboard/manager" : "/dashboard/hr";

    setLoading(true);
    const request =
      role === "EMPLOYEE"
        ? apiRequest<EmployeeDashboardSummaryData>(endpoint, { token })
        : apiRequest<DashboardData>(endpoint, { token });

    request
      .then((response) => {
        if (role === "EMPLOYEE") {
          const payload = response as Awaited<ReturnType<typeof apiRequest<EmployeeDashboardSummaryData>>>;
          setEmployeeDashboard(payload.data);
          setData({
            attendanceToday: payload.data.attendanceToday,
            pendingLeaves: payload.data.pendingLeaves,
            payrollCount: payload.data.payrollCount,
            isTeamLead: payload.data.isTeamLead,
            scopedTeamCount: payload.data.scopedTeamCount,
            pendingTeamLeaves: payload.data.pendingTeamLeaves,
          });
          return;
        }

        setData((response as Awaited<ReturnType<typeof apiRequest<DashboardData>>>).data);
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [role, token]);

  useEffect(() => {
    if (role !== "EMPLOYEE") {
      return;
    }

    const handleAttendanceUpdated = (event: Event) => {
      const detail = getAttendanceUpdatedDetail(event);

      if (!detail) {
        return;
      }

      setEmployeeDashboard((current) => (current ? { ...current, attendanceToday: detail.attendanceToday } : current));
      setData((current) => ({ ...current, attendanceToday: detail.attendanceToday }));
    };

    window.addEventListener(ATTENDANCE_EVENT, handleAttendanceUpdated);
    return () => window.removeEventListener(ATTENDANCE_EVENT, handleAttendanceUpdated);
  }, [role]);

  const attendanceToday = employeeDashboard?.attendanceToday ?? null;
  const todayLabel = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long" });
  const currentEmployee = employeeDashboard?.currentEmployee ?? null;
  const attendanceStatusNote = getAttendanceStatusNote(attendanceToday);

  return (
    <section className="stack">
      {error ? <MessageCard title="Dashboard issue" tone="error" message={error} /> : null}
      {loading ? (
        <div className="page-loading">
          <article className="card skeleton-card skeleton-card--hero">
            <span className="skeleton-line skeleton-line--short" />
            <span className="skeleton-line skeleton-line--title" />
            <span className="skeleton-line skeleton-line--long" />
          </article>
          <div className="grid cols-3 skeleton-grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <article key={index} className="card skeleton-card">
                <span className="skeleton-line skeleton-line--short" />
                <span className="skeleton-line skeleton-line--metric" />
              </article>
            ))}
          </div>
        </div>
      ) : null}
      {!loading ? (
        <>
          <article className="card dashboard-hero">
            <div className="dashboard-hero-copy">
              {bannerContent.eyebrow ? <p className="eyebrow">{bannerContent.eyebrow}</p> : null}
              <h3>{bannerContent.title}</h3>
              <p className="muted">{bannerContent.description}</p>
              <div className="dashboard-hero-timezone-group">
                <TimeCard timezone="Asia/Kolkata" />
                <TimeCard timezone="Europe/London" />
                <TimeCard timezone="America/New_York" />
              </div>
            </div>
          </article>

          {role === "EMPLOYEE" ? (
            <>
              <div className="grid dashboard-grid">
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
              </div>

              <div className="grid dashboard-support-grid">
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
                      <span className="table-cell-primary">{String(data.scopedTeamCount ?? 0)}</span>
                    </div>
                    <div className="table-cell-stack">
                      <span className="table-cell-secondary">Pending team leaves</span>
                      <span className="table-cell-primary">{String(data.pendingTeamLeaves ?? 0)}</span>
                    </div>
                  </div>
                  <div className="dashboard-quick-actions dashboard-quick-actions--compact">
                    <button className="secondary" onClick={() => navigate("/attendance")}>
                      Review team attendance
                    </button>
                    <button className="secondary" onClick={() => navigate("/analytics")}>
                      Open analytics
                    </button>
                  </div>
                </article>
              </div>
            </>
          ) : (
            <>
              <div className="grid cols-2 dashboard-grid">
                {Object.entries(data).map(([key, value]) => (
                  <article key={key} className={`card metric-card metric-card--${typeof value === "object" ? "status" : "numeric"}`}>
                    <p className="eyebrow">
                      {key === "teamCount" ? "Team members" : key === "pendingApprovals" ? "Pending approvals" : key === "pendingLeaves" ? "Pending leaves" : key === "employees" ? "Employees" : key === "departments" ? "Departments" : key === "payrollCount" ? "Payroll records" : key}
                    </p>
                    <strong>{String(value ?? "-")}</strong>
                    <p className="muted">
                      {key === "pendingApprovals" ? "Action needed soon" : key === "pendingLeaves" ? "Currently awaiting action" : "Live summary"}
                    </p>
                  </article>
                ))}
              </div>

                            </>
          )}
        </>
      ) : null}
    </section>
  );
}
