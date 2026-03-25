import "./DashboardPage.css";
import { useCallback, useEffect, useState } from "react";
import AttendanceQuickAction from "../../components/common/AttendanceQuickAction";
import { ATTENDANCE_EVENT } from "../../components/common/attendanceQuickActionUtils";
import MessageCard from "../../components/common/MessageCard";
import { apiRequest } from "../../services/api";
import type { Attendance, Role } from "../../types";
import { formatMetricKey, formatTime } from "../../utils/format";

type DashboardData = Record<string, number | string | null | undefined | object>;
type MetricVariant = "numeric" | "status";

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
      description: "Stay on top of attendance, leave balance, and payroll updates from your employee workspace.",
      metaLabel: "Employee workspace",
    };
  }

  if (role === "MANAGER") {
    return {
      eyebrow: "Team operations",
      title: "Team overview",
      description: "Monitor team attendance, review pending leave requests, and keep daily approvals moving on time.",
      metaLabel: "Manager console",
    };
  }

  if (role === "HR") {
    return {
      eyebrow: "HR operations",
      title: "Workforce in motion",
      description: "Track attendance, leave activity, payroll actions, and employee operations from one HR workspace.",
      metaLabel: "HR console",
    };
  }

  return {
    eyebrow: "Executive overview",
    title: "Operations command center",
    description: "Monitor workforce operations, policy execution, and payroll activity across the organization.",
    metaLabel: "Admin console",
  };
}

export default function DashboardPage({ token, role, currentEmployeeId }: DashboardPageProps) {
  const [data, setData] = useState<DashboardData>({});
  const [selfAttendance, setSelfAttendance] = useState<Attendance | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const bannerContent = getDashboardContent(role);

  useEffect(() => {
    const endpoint = role === "EMPLOYEE" ? "/dashboard/employee" : role === "MANAGER" ? "/dashboard/manager" : "/dashboard/hr";

    setLoading(true);
    apiRequest<DashboardData>(endpoint, { token })
      .then((response) => setData(response.data))
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [role, token]);

  const loadSelfAttendance = useCallback(async () => {
    if (!currentEmployeeId) {
      setSelfAttendance(null);
      return;
    }

    if (role === "EMPLOYEE" && typeof data.attendanceToday === "object" && data.attendanceToday) {
      setSelfAttendance(data.attendanceToday as Attendance);
      return;
    }

    try {
      const response = await apiRequest<{ attendanceToday?: Attendance | null }>("/dashboard/employee", { token });
      setSelfAttendance(response.data.attendanceToday ?? null);
    } catch {
      setSelfAttendance(null);
    }
  }, [currentEmployeeId, data.attendanceToday, role, token]);

  useEffect(() => {
    void loadSelfAttendance();
  }, [loadSelfAttendance]);

  useEffect(() => {
    const handleAttendanceUpdated = () => {
      void loadSelfAttendance();
    };

    window.addEventListener(ATTENDANCE_EVENT, handleAttendanceUpdated);
    return () => window.removeEventListener(ATTENDANCE_EVENT, handleAttendanceUpdated);
  }, [loadSelfAttendance]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const handleQuickActionStateChange = useCallback((attendance: Attendance | null) => {
    setSelfAttendance(attendance);
  }, []);

  function getMetricVariant(key: string): MetricVariant {
    return key === "attendanceToday" ? "status" : "numeric";
  }

  function getMetricHint(key: string, value: DashboardData[string]) {
    if (key === "attendanceToday" && typeof value === "object" && value) {
      const attendance = value as {
        status?: string;
        checkInTime?: string | null;
        checkOutTime?: string | null;
        workedMinutes?: number;
      };

      if (attendance.checkOutTime) {
        return "Attendance completed";
      }

      if (attendance.checkInTime) {
        return "Checked in today";
      }

      return attendance.status ?? "Attendance recorded";
    }

    if (key === "pendingLeaves") {
      return "Awaiting action";
    }

    if (key === "payrollCount") {
      return role === "EMPLOYEE" ? "Available records" : "Total records";
    }

    if (key === "employees") {
      return "Active workforce";
    }

    if (key === "departments") {
      return "Configured teams";
    }

    if (key === "teamCount") {
      return "Direct reports";
    }

    if (key === "pendingApprovals") {
      return "Needs review";
    }

    return "Live metric";
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

  function formatMetricValue(value: DashboardData[string]) {
    if (typeof value === "object") {
      return "Available";
    }

    return String(value ?? "-");
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

  const metricEntries = Object.entries(data).filter(([key]) => key !== "attendanceToday");

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
      <div className="grid cols-3 dashboard-grid">
        {currentEmployeeId ? (
          <article className="card metric-card metric-card--attendance-widget">
            <div className="metric-card-header">
              <div>
                <p className="eyebrow">Attendance today</p>
                <strong>{getAttendanceWidgetTitle(selfAttendance)}</strong>
              </div>
              <AttendanceQuickAction
                token={token}
                currentEmployeeId={currentEmployeeId}
                onStateChange={handleQuickActionStateChange}
              />
            </div>
            <div className="attendance-widget-meta">
              <div className="table-cell-stack">
                <span className="table-cell-secondary">Check in</span>
                <span className="table-cell-primary">{formatTime(selfAttendance?.checkInTime)}</span>
              </div>
              <div className="table-cell-stack">
                <span className="table-cell-secondary">Check out</span>
                <span className="table-cell-primary">{formatTime(selfAttendance?.checkOutTime)}</span>
              </div>
              <div className="table-cell-stack">
                <span className="table-cell-secondary">Worked</span>
                <span className="table-cell-primary">
                  {selfAttendance?.status === "LEAVE" ? "-" : selfAttendance?.checkOutTime ? formatWorkedDuration(selfAttendance.workedMinutes) : "-"}
                </span>
              </div>
            </div>
          </article>
        ) : null}
        {metricEntries.map(([key, value]) => (
          <article key={key} className={`card metric-card metric-card--${getMetricVariant(key)}`}>
            <p className="eyebrow">{formatMetricKey(key)}</p>
            <strong>{formatMetricValue(value)}</strong>
            <p className="muted">{getMetricHint(key, value)}</p>
          </article>
        ))}
      </div>
        </>
      ) : null}
    </section>
  );
}
