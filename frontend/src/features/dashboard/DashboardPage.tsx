import "./DashboardPage.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ATTENDANCE_EVENT, getAttendanceUpdatedDetail } from "../../components/common/attendanceQuickActionUtils";
import MessageCard from "../../components/common/MessageCard";
import { apiRequest } from "../../services/api";
import type { Attendance, EmployeeDashboardSummaryData, Role } from "../../types";
import { formatAttendanceTime, formatLeaveDays } from "../../utils/format";

type DashboardData = Record<string, number | string | boolean | null | undefined | object>;

type DashboardPageProps = {
  token: string | null;
  role: Role;
  currentEmployeeId: number | null;
};

function getDashboardContent(role: Role) {
  if (role === "EMPLOYEE") {
    return {
      eyebrow: "Today at a glance",
      title: "Good morning",
      description: "Use this dashboard for quick actions and essential workday updates.",
      metaLabel: "Employee workspace",
    };
  }

  if (role === "MANAGER") {
    return {
      eyebrow: "Team operations",
      title: "Team overview",
      description: "Stay on top of the main team counters and move into analytics when you need trends.",
      metaLabel: "Manager console",
    };
  }

  if (role === "HR") {
    return {
      eyebrow: "HR operations",
      title: "Workforce in motion",
      description: "Keep the dashboard focused on essential operations and use analytics for deeper visual review.",
      metaLabel: "HR console",
    };
  }

  return {
    eyebrow: "Executive overview",
    title: "Operations command center",
    description: "Track the key workforce numbers here and open analytics for detailed patterns and trends.",
    metaLabel: "Admin console",
  };
}

function getAttendanceWidgetTitle(attendance: Attendance | null) {
  if (!attendance) {
    return "Not marked";
  }

  if (attendance.status === "LEAVE") {
    return "On leave";
  }

  if (attendance.checkOutTime) {
    return "Completed";
  }

  if (attendance.checkInTime) {
    return "Checked in";
  }

  if (attendance.status === "HALF_DAY") {
    return "Half day";
  }

  if (attendance.status === "ABSENT") {
    return "Absent";
  }

  return attendance.status;
}

function formatWorkedDuration(workedMinutes?: number) {
  if (!workedMinutes || workedMinutes <= 0) {
    return "0m";
  }

  const hours = Math.floor(workedMinutes / 60);
  const minutes = workedMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

export default function DashboardPage({ token, role }: DashboardPageProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData>({});
  const [employeeDashboard, setEmployeeDashboard] = useState<EmployeeDashboardSummaryData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
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
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

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
  const leaveBalances = employeeDashboard?.leaveBalances ?? [];
  const totalRemainingLeave = leaveBalances.reduce((sum, balance) => sum + balance.remainingDays, 0);
  const totalAllocatedLeave = leaveBalances.reduce((sum, balance) => sum + balance.allocatedDays, 0);
  const totalUsedLeave = leaveBalances.reduce((sum, balance) => sum + balance.usedDays, 0);
  const nextApprovedLeave = (employeeDashboard?.leaveRequests ?? [])
    .filter((leave) => leave.status === "APPROVED" && new Date(leave.endDate) >= new Date())
    .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime())[0];
  const isTeamLead = Boolean(employeeDashboard?.isTeamLead);
  const currentEmployee = employeeDashboard?.currentEmployee ?? null;

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
            <img
              className="dashboard-hero-image"
              src="/assets/images/bgmain-optimized.jpg"
              alt=""
              fetchPriority="high"
              loading="eager"
              decoding="async"
              aria-hidden="true"
            />
            <div className="dashboard-hero-copy">
              <p className="eyebrow">{bannerContent.eyebrow}</p>
              <h3>{bannerContent.title}</h3>
              <p className="muted">{bannerContent.description}</p>
            </div>
            <div className="dashboard-hero-meta">
              <span>{bannerContent.metaLabel}</span>
              <p className="dashboard-hero-time">
                {now.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
              <strong>
                {now.toLocaleDateString(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </strong>
            </div>
          </article>

          {role === "EMPLOYEE" ? (
            <>
              <div className="grid cols-3 dashboard-grid">
                <article className="card metric-card metric-card--status">
                  <p className="eyebrow">Attendance today</p>
                  <strong>{getAttendanceWidgetTitle(attendanceToday)}</strong>
                  <p className="muted">{now.toLocaleDateString(undefined, { day: "numeric", month: "long" })}</p>
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
                </article>

                <article className="card metric-card">
                  <p className="eyebrow">Leave balance</p>
                  <strong>{formatLeaveDays(totalRemainingLeave)}</strong>
                  <p className="muted">
                    {totalAllocatedLeave
                      ? `${Math.round((totalRemainingLeave / totalAllocatedLeave) * 100)}% of allocated leave remaining`
                      : "No leave balances assigned yet"}
                  </p>
                  <div className="dashboard-inline-row">
                    <span>Used</span>
                    <strong>{formatLeaveDays(totalUsedLeave)}</strong>
                  </div>
                </article>

                <article className="card metric-card">
                  <p className="eyebrow">Payroll records</p>
                  <strong>{String(data.payrollCount ?? 0)}</strong>
                  <p className="muted">Available payroll entries</p>
                  <div className="dashboard-inline-row">
                    <span>Analytics</span>
                    <button className="secondary" onClick={() => navigate("/analytics")}>
                      Open charts
                    </button>
                  </div>
                </article>
              </div>

              <div className="grid cols-2 dashboard-support-grid">
                <article className="card metric-card">
                  <p className="eyebrow">Leave activity</p>
                  <strong>{String(data.pendingLeaves ?? 0)}</strong>
                  <p className="muted">
                    {nextApprovedLeave
                      ? `Next approved leave starts ${new Date(nextApprovedLeave.startDate).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}`
                      : "No upcoming approved leave"}
                  </p>
                  <div className="dashboard-inline-row">
                    <span>Next stop</span>
                    <button className="secondary" onClick={() => navigate("/leaves")}>
                      Open leaves
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
                  <div className="dashboard-inline-row">
                    <span>Analytics</span>
                    <button className="secondary" onClick={() => navigate("/analytics")}>
                      View insights
                    </button>
                  </div>
                </article>
              </div>

              {isTeamLead ? (
                <article className="card dashboard-team-lead-card">
                  <div className="dashboard-actions-header">
                    <div>
                      <p className="eyebrow">Team leader desk</p>
                      <h3>Keep your team flow moving</h3>
                    </div>
                    <span className="dashboard-project-badge">TL</span>
                  </div>
                  <p className="muted">Use analytics for charts and keep this space focused on quick team counters.</p>
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
              ) : null}
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

                <article className="card metric-card">
                  <div className="metric-card-header">
                    <div>
                      <p className="eyebrow">Analytics workspace</p>
                      <strong>Open detailed analytics</strong>
                    </div>
                  </div>
                  <p className="muted">
                    Open the new Analytics section to review attendance distributions, leave activity, and other chart-based insights.
                  </p>
                <div className="dashboard-quick-actions dashboard-quick-actions--compact">
                  <button className="secondary" onClick={() => navigate("/analytics")}>
                    Open analytics
                  </button>
                  <button className="secondary" onClick={() => navigate("/leaves")}>
                    Review leaves
                  </button>
                </div>
              </article>
            </>
          )}
        </>
      ) : null}
    </section>
  );
}
