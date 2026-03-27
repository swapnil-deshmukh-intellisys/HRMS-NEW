import "./DashboardPage.css";
import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useNavigate } from "react-router-dom";
import { ATTENDANCE_EVENT } from "../../components/common/attendanceQuickActionUtils";
import MessageCard from "../../components/common/MessageCard";
import { apiRequest } from "../../services/api";
import type { Attendance, CalendarDay, Employee, LeaveBalance, LeaveRequest, Role } from "../../types";
import { formatLeaveDays, formatMetricKey, formatTime } from "../../utils/format";

type DashboardData = Record<string, number | string | null | undefined | object>;
type MetricVariant = "numeric" | "status";
type AttendanceOverviewTab = "today" | "month";
type LeaveRequestsTab = "pending" | "month";
type CalendarResponse = {
  month: number;
  year: number;
  days: CalendarDay[];
};
const LEAVE_BALANCE_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#ef4444"];
const ATTENDANCE_PROGRESS_COLORS = {
  completed: "#16a34a",
  issue: "#ef4444",
  remaining: "#e5e7eb",
} as const;
const ADMIN_ATTENDANCE_COLORS = {
  present: "#16a34a",
  halfDay: "#2563eb",
  leave: "#f59e0b",
  unmarked: "#e5e7eb",
  absent: "#ef4444",
} as const;

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

type AttendanceOverviewTooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload: {
      label: string;
      value: number;
      color: string;
    };
  }>;
  denominator: number;
  contextLabel: string;
};

function AttendanceOverviewTooltip({ active, payload, denominator, contextLabel }: AttendanceOverviewTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0].payload;
  const percentage = denominator ? Math.round((item.value / denominator) * 100) : 0;

  return (
    <div className="dashboard-chart-tooltip">
      <div className="dashboard-chart-tooltip__header">
        <span className="dashboard-chart-tooltip__swatch" style={{ backgroundColor: item.color }} />
        <strong>{item.label}</strong>
      </div>
      <div className="dashboard-chart-tooltip__metric">
        <strong>{item.value}</strong>
        <span>{percentage}% of {contextLabel}</span>
      </div>
    </div>
  );
}

function formatChartValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function DashboardPage({ token, role, currentEmployeeId }: DashboardPageProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData>({});
  const [selfAttendance, setSelfAttendance] = useState<Attendance | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [attendanceOverviewTab, setAttendanceOverviewTab] = useState<AttendanceOverviewTab>("today");
  const [leaveRequestsTab, setLeaveRequestsTab] = useState<LeaveRequestsTab>("pending");
  const bannerContent = getDashboardContent(role);

  useEffect(() => {
    const endpoint = role === "EMPLOYEE" ? "/dashboard/employee" : role === "MANAGER" ? "/dashboard/manager" : "/dashboard/hr";
    const now = new Date();
    const calendarEndpoint = `/calendar?month=${now.getMonth() + 1}&year=${now.getFullYear()}`;

    setLoading(true);
    const requests =
      role === "EMPLOYEE"
        ? Promise.all([
            apiRequest<DashboardData>(endpoint, { token }),
            apiRequest<Attendance[]>("/attendance", { token }),
            apiRequest<CalendarResponse>(calendarEndpoint, { token }),
            ...(currentEmployeeId ? [apiRequest<Employee>(`/employees/${currentEmployeeId}`, { token })] : []),
            apiRequest<LeaveBalance[]>("/leave-balances/me", { token }),
            apiRequest<LeaveRequest[]>("/leaves", { token }),
          ])
        : Promise.all([
            apiRequest<DashboardData>(endpoint, { token }),
            apiRequest<Attendance[]>("/attendance", { token }),
            apiRequest<CalendarResponse>(calendarEndpoint, { token }),
            apiRequest<LeaveRequest[]>("/leaves", { token }),
          ]);

    requests
      .then((responses) => {
        const dashboardResponse = responses[0];
        setData(dashboardResponse.data);

        if (role === "EMPLOYEE") {
          let responseIndex = 1;
          setAttendanceRecords((responses[responseIndex++] as Awaited<ReturnType<typeof apiRequest<Attendance[]>>>).data);
          setCalendarDays((responses[responseIndex++] as Awaited<ReturnType<typeof apiRequest<CalendarResponse>>>).data.days);

          if (currentEmployeeId) {
            setCurrentEmployee((responses[responseIndex++] as Awaited<ReturnType<typeof apiRequest<Employee>>>).data);
          } else {
            setCurrentEmployee(null);
          }

          setLeaveBalances((responses[responseIndex++] as Awaited<ReturnType<typeof apiRequest<LeaveBalance[]>>>).data);
          setLeaveRequests((responses[responseIndex] as Awaited<ReturnType<typeof apiRequest<LeaveRequest[]>>>).data);
        } else {
          setAttendanceRecords((responses[1] as Awaited<ReturnType<typeof apiRequest<Attendance[]>>>).data);
          setCalendarDays((responses[2] as Awaited<ReturnType<typeof apiRequest<CalendarResponse>>>).data.days);
          setLeaveRequests((responses[3] as Awaited<ReturnType<typeof apiRequest<LeaveRequest[]>>>).data);
        }
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [currentEmployeeId, role, token]);

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

  const totalRemainingLeave = leaveBalances.reduce((sum, balance) => sum + balance.remainingDays, 0);
  const totalAllocatedLeave = leaveBalances.reduce((sum, balance) => sum + balance.allocatedDays, 0);
  const totalUsedLeave = leaveBalances.reduce((sum, balance) => sum + balance.usedDays, 0);
  const nowDate = new Date();
  const monthAttendanceRecords = attendanceRecords.filter((attendance) => {
    const attendanceDate = new Date(attendance.attendanceDate);
    return (
      attendanceDate.getFullYear() === nowDate.getFullYear() &&
      attendanceDate.getMonth() === nowDate.getMonth() &&
      attendanceDate <= nowDate
    );
  });
  const currentMonthLabel = nowDate.toLocaleDateString(undefined, { month: "long" });
  const elapsedMonthDays = nowDate.getDate();
  const elapsedWorkingDays = calendarDays.filter((day) => day.isWorkingDay && new Date(day.date) <= nowDate).length;
  const totalWorkingDaysInMonth = calendarDays.filter((day) => day.isWorkingDay).length;
  const presentDays = monthAttendanceRecords.filter((attendance) => attendance.status === "PRESENT").length;
  const halfDays = monthAttendanceRecords.filter((attendance) => attendance.status === "HALF_DAY").length;
  const leaveDaysInMonth = monthAttendanceRecords.filter((attendance) => attendance.status === "LEAVE").length;
  const absentDaysInMonth = monthAttendanceRecords.filter((attendance) => attendance.status === "ABSENT").length;
  const attendedEquivalentDays = presentDays + halfDays * 0.5;
  const issueDays = leaveDaysInMonth + absentDaysInMonth;
  const remainingDays = Math.max(elapsedMonthDays - attendedEquivalentDays - issueDays, 0);
  const attendancePerformance = elapsedWorkingDays ? Math.round((attendedEquivalentDays / elapsedWorkingDays) * 100) : 0;
  const attendanceProgressData = [
    { key: "completed", label: "Completed", value: attendedEquivalentDays, color: ATTENDANCE_PROGRESS_COLORS.completed },
    { key: "issue", label: "Leave / absent", value: issueDays, color: ATTENDANCE_PROGRESS_COLORS.issue },
    { key: "remaining", label: "Remaining", value: remainingDays, color: ATTENDANCE_PROGRESS_COLORS.remaining },
  ].filter((entry) => entry.value > 0);
  const leaveChartData = leaveBalances
    .filter((balance) => balance.remainingDays > 0)
    .map((balance, index) => ({
      id: balance.id,
      name: balance.leaveType.code,
      fullName: balance.leaveType.name,
      value: balance.remainingDays,
      allocated: balance.allocatedDays,
      color: LEAVE_BALANCE_COLORS[index % LEAVE_BALANCE_COLORS.length],
    }));
  const pendingLeaveRequests = leaveRequests.filter((leave) => leave.status === "PENDING");
  const approvedLeaveRequests = leaveRequests.filter((leave) => leave.status === "APPROVED");
  const isTeamLead = Boolean(data.isTeamLead) || Boolean(currentEmployee?.capabilities?.some((capability) => capability.capability === "TEAM_LEAD"));
  const scopedTeamCount = typeof data.scopedTeamCount === "number" ? data.scopedTeamCount : 0;
  const pendingTeamLeaves = typeof data.pendingTeamLeaves === "number" ? data.pendingTeamLeaves : 0;
  const nextApprovedLeave = approvedLeaveRequests
    .filter((leave) => new Date(leave.endDate) >= new Date())
    .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime())[0];
  const currentMonthLeaveTaken = approvedLeaveRequests.reduce((sum, leave) => {
    const startDate = new Date(leave.startDate);

    if (startDate.getFullYear() === nowDate.getFullYear() && startDate.getMonth() === nowDate.getMonth()) {
      return sum + leave.totalDays;
    }

    return sum;
  }, 0);
  const currentMonthUnpaidLeave = approvedLeaveRequests.reduce((sum, leave) => {
    const startDate = new Date(leave.startDate);

    if (startDate.getFullYear() === nowDate.getFullYear() && startDate.getMonth() === nowDate.getMonth()) {
      return sum + leave.unpaidDays;
    }

    return sum;
  }, 0);
  const pendingRequests = leaveRequests.filter((leave) => leave.status === "PENDING");
  const pendingPaidRequests = pendingRequests.filter((leave) => leave.paidDays > 0).length;
  const pendingUnpaidRequests = pendingRequests.filter((leave) => leave.unpaidDays > 0).length;
  const pendingHalfDayRequests = pendingRequests.filter(
    (leave) => leave.startDayDuration === "HALF_DAY" || leave.endDayDuration === "HALF_DAY",
  ).length;
  const earliestPendingLeave = pendingRequests
    .slice()
    .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime())[0];
  const currentMonthLeaveRequests = leaveRequests.filter((leave) => {
    const requestDate = new Date(leave.startDate);
    return requestDate.getFullYear() === nowDate.getFullYear() && requestDate.getMonth() === nowDate.getMonth();
  });
  const monthLeaveTypeData = Object.values(
    currentMonthLeaveRequests.reduce<Record<string, { code: string; value: number }>>((accumulator, leave) => {
      const key = leave.leaveType.code;
      accumulator[key] ??= { code: key, value: 0 };
      accumulator[key].value += 1;
      return accumulator;
    }, {}),
  );
  const approvedMonthRequests = currentMonthLeaveRequests.filter((leave) => leave.status === "APPROVED").length;
  const rejectedMonthRequests = currentMonthLeaveRequests.filter((leave) => leave.status === "REJECTED").length;
  const cancelledMonthRequests = currentMonthLeaveRequests.filter((leave) => leave.status === "CANCELLED").length;
  const approvedUnpaidMonthRequests = currentMonthLeaveRequests.filter(
    (leave) => leave.status === "APPROVED" && leave.unpaidDays > 0,
  ).length;
  const pendingLeaveChartData = [
    { key: "paid", label: "Paid", value: pendingPaidRequests, color: "#2563eb" },
    { key: "unpaid", label: "Unpaid", value: pendingUnpaidRequests, color: "#f59e0b" },
  ].filter((entry) => entry.value > 0);

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
  const workforceCount = role === "MANAGER" ? Number(data.teamCount ?? 0) : Number(data.employees ?? 0);
  const todayAttendanceRecords = attendanceRecords.filter((attendance) => {
    const attendanceDate = new Date(attendance.attendanceDate);
    return (
      attendanceDate.getFullYear() === nowDate.getFullYear() &&
      attendanceDate.getMonth() === nowDate.getMonth() &&
      attendanceDate.getDate() === nowDate.getDate()
    );
  });
  const todayPresentCount = todayAttendanceRecords.filter((attendance) => attendance.status === "PRESENT").length;
  const todayHalfDayCount = todayAttendanceRecords.filter((attendance) => attendance.status === "HALF_DAY").length;
  const todayLeaveCount = todayAttendanceRecords.filter((attendance) => attendance.status === "LEAVE").length;
  const todayUnmarkedCount = Math.max(workforceCount - todayPresentCount - todayHalfDayCount - todayLeaveCount, 0);
  const todayOverviewData = [
    { key: "present", label: "Present", value: todayPresentCount, color: ADMIN_ATTENDANCE_COLORS.present },
    { key: "half-day", label: "Half day", value: todayHalfDayCount, color: ADMIN_ATTENDANCE_COLORS.halfDay },
    { key: "leave", label: "Leave", value: todayLeaveCount, color: ADMIN_ATTENDANCE_COLORS.leave },
    { key: "unmarked", label: "Unmarked", value: todayUnmarkedCount, color: ADMIN_ATTENDANCE_COLORS.unmarked },
  ].filter((entry) => entry.value > 0);
  const presentAverageHeadcount = elapsedWorkingDays ? Number((presentDays / elapsedWorkingDays).toFixed(1)) : 0;
  const monthOverviewData = [
    { key: "present-average", label: "Present avg", value: presentAverageHeadcount, color: ADMIN_ATTENDANCE_COLORS.present },
    { key: "leave", label: "Leaves till date", value: leaveDaysInMonth, color: ADMIN_ATTENDANCE_COLORS.leave },
    { key: "absent", label: "Absents till date", value: absentDaysInMonth, color: ADMIN_ATTENDANCE_COLORS.absent },
    { key: "half-day", label: "Half days", value: halfDays, color: ADMIN_ATTENDANCE_COLORS.halfDay },
  ].filter((entry) => entry.value > 0);
  const activeOverviewData = attendanceOverviewTab === "today" ? todayOverviewData : monthOverviewData;
  const activeOverviewDenominator = attendanceOverviewTab === "today" ? workforceCount : elapsedWorkingDays;
  const activeOverviewLabel = attendanceOverviewTab === "today" ? "active workforce" : "working days elapsed";
  const activeOverviewCenterTitle =
    attendanceOverviewTab === "today" ? `${todayPresentCount}/${workforceCount}` : "";
  const activeOverviewCenterSubtext = attendanceOverviewTab === "today" ? "Present" : "";
  const activeOverviewSummary =
    attendanceOverviewTab === "today"
      ? nowDate.toLocaleDateString(undefined, { day: "numeric", month: "long" })
      : `${elapsedWorkingDays}/${totalWorkingDaysInMonth} working days`;
  const activeOverviewSummaryLabel = attendanceOverviewTab === "today" ? "Today" : "Month progress";
  const nonEmployeeMetricEntries = metricEntries.filter(([key]) => key !== "employees" && key !== "teamCount" && key !== "pendingLeaves");

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
      {role === "EMPLOYEE" ? (
        <>
          <div className="grid cols-3 dashboard-grid">
            {currentEmployeeId ? (
              <article className="card metric-card metric-card--attendance-widget">
                <div className="metric-card-header">
                  <div>
                    <p className="eyebrow">Attendance today</p>
                    <strong>{getAttendanceWidgetTitle(selfAttendance)}</strong>
                    <p className="muted">{currentMonthLabel} overview</p>
                  </div>
                </div>
                {attendanceProgressData.length ? (
                  <div className="dashboard-attendance-chart">
                    <div className="dashboard-attendance-chart__visual">
                      <ResponsiveContainer width="100%" height={188}>
                        <PieChart>
                          <Pie
                            data={attendanceProgressData}
                            dataKey="value"
                            nameKey="label"
                            innerRadius={52}
                            outerRadius={76}
                            paddingAngle={3}
                            stroke="none"
                          >
                            {attendanceProgressData.map((entry) => (
                              <Cell key={entry.key} fill={entry.color} />
                            ))}
                          </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                      <div className="dashboard-attendance-chart__center">
                        <strong>{attendancePerformance}%</strong>
                        <span>{currentMonthLabel}</span>
                      </div>
                    </div>
                    <div className="dashboard-attendance-chart__legend">
                      <div className="dashboard-attendance-chart__summary">
                        <span>{currentMonthLabel} attendance</span>
                        <strong>
                          {attendedEquivalentDays % 1 === 0 ? attendedEquivalentDays : attendedEquivalentDays.toFixed(1)} / {elapsedMonthDays} days
                        </strong>
                      </div>
                      {attendanceProgressData.map((entry) => (
                        <div key={entry.key} className="dashboard-attendance-chart__legend-item">
                          <div className="dashboard-attendance-chart__legend-main">
                            <span className="dashboard-attendance-chart__swatch" style={{ backgroundColor: entry.color }} />
                            <span>{entry.label}</span>
                          </div>
                          <strong>{entry.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
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
            <article className="card metric-card">
              <p className="eyebrow">Leave balance</p>
              <strong>{formatLeaveDays(totalRemainingLeave)}</strong>
              <p className="muted">
                {totalAllocatedLeave
                  ? `${Math.round((totalRemainingLeave / totalAllocatedLeave) * 100)}% of allocated leave remaining`
                  : "No leave balances assigned yet"}
              </p>
              {leaveChartData.length ? (
                <div className="dashboard-leave-balance-chart">
                  <div className="dashboard-leave-balance-chart__top">
                    <div className="dashboard-leave-balance-chart__visual">
                      <ResponsiveContainer width="100%" height={188}>
                        <PieChart>
                          <Pie
                            data={leaveChartData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={52}
                            outerRadius={76}
                            paddingAngle={3}
                            stroke="none"
                          >
                            {leaveChartData.map((entry) => (
                              <Cell key={entry.id} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="dashboard-leave-balance-chart__center">
                        <strong>{Number.isInteger(totalRemainingLeave) ? totalRemainingLeave : totalRemainingLeave.toFixed(1)}</strong>
                        <span>days left</span>
                      </div>
                    </div>
                    <div className="dashboard-leave-balance-chart__summary">
                      <div className="table-cell-stack">
                        <span className="table-cell-secondary">Leaves taken</span>
                        <span className="table-cell-primary">{formatLeaveDays(totalUsedLeave)}</span>
                      </div>
                      <div className="table-cell-stack">
                        <span className="table-cell-secondary">Allocated</span>
                        <span className="table-cell-primary">{formatLeaveDays(totalAllocatedLeave)}</span>
                      </div>
                      <div className="table-cell-stack">
                        <span className="table-cell-secondary">Remaining</span>
                        <span className="table-cell-primary">{formatLeaveDays(totalRemainingLeave)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="dashboard-leave-balance-chart__legend">
                    {leaveChartData.map((entry) => {
                      const percentage = totalAllocatedLeave ? Math.round((entry.value / totalAllocatedLeave) * 100) : 0;

                      return (
                        <div key={entry.id} className="dashboard-leave-balance-chart__legend-item">
                          <div className="dashboard-leave-balance-chart__legend-main">
                            <span className="dashboard-leave-balance-chart__swatch" style={{ backgroundColor: entry.color }} />
                            <div className="table-cell-stack">
                              <span className="table-cell-primary">{entry.fullName}</span>
                              <span className="table-cell-secondary">
                                {Number.isInteger(entry.value) ? entry.value : entry.value.toFixed(1)}/{Number.isInteger(entry.allocated) ? entry.allocated : entry.allocated.toFixed(1)} days
                              </span>
                            </div>
                          </div>
                          <strong>{percentage}% left</strong>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="dashboard-balance-list">
                  {leaveBalances.map((balance) => (
                    <div key={balance.id} className="dashboard-inline-row">
                      <span>{balance.leaveType.code}</span>
                      <strong>{formatLeaveDays(balance.remainingDays)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </article>
            <article className="card metric-card metric-card--project">
              <div className="metric-card-header">
                <div>
                  <p className="eyebrow">Ongoing project</p>
                  <strong>{currentEmployee?.department ? `${currentEmployee.department.name} workspace rollout` : "Project details coming soon"}</strong>
                </div>
                <span className="dashboard-project-badge">Setup pending</span>
              </div>
              <p className="muted">
                {currentEmployee?.department
                  ? "This card will surface your active assignment, milestone, and reporting context once the project workspace is linked."
                  : "Your active project assignment will appear here once project data is connected."}
              </p>
              <div className="dashboard-project-meta">
                <div className="table-cell-stack">
                  <span className="table-cell-secondary">Role in project</span>
                  <span className="table-cell-primary">
                    {currentEmployee?.user?.role.name === "EMPLOYEE" ? "Project contributor" : currentEmployee?.user?.role.name ?? "Contributor"}
                  </span>
                </div>
                <div className="table-cell-stack">
                  <span className="table-cell-secondary">Manager</span>
                  <span className="table-cell-primary">
                    {currentEmployee?.manager ? `${currentEmployee.manager.firstName} ${currentEmployee.manager.lastName}` : "Not assigned"}
                  </span>
                </div>
                <div className="table-cell-stack">
                  <span className="table-cell-secondary">Current phase</span>
                  <span className="table-cell-primary">Planning</span>
                </div>
                <div className="table-cell-stack">
                  <span className="table-cell-secondary">Next milestone</span>
                  <span className="table-cell-primary">Project page setup</span>
                </div>
              </div>
            </article>
          </div>

          <article className="card dashboard-actions-card">
            <div className="dashboard-actions-header">
              <div>
                <p className="eyebrow">Quick actions</p>
                <h3>Get things done faster</h3>
              </div>
            </div>
            <div className="dashboard-quick-actions">
              <button onClick={() => navigate("/leaves")}>Apply leave</button>
              <button className="secondary" onClick={() => navigate("/attendance")}>
                Request correction
              </button>
              <button className="secondary" onClick={() => navigate("/payroll")}>
                View payroll
              </button>
              <button className="secondary" onClick={() => navigate("/attendance")}>
                Open attendance
              </button>
            </div>
          </article>

          {isTeamLead ? (
            <article className="card dashboard-team-lead-card">
              <div className="dashboard-actions-header">
                <div>
                  <p className="eyebrow">Team Leader desk</p>
                  <h3>Keep your team flow moving</h3>
                </div>
                <span className="dashboard-project-badge">TL</span>
              </div>
              <p className="muted">
                Track your scoped team’s attendance and pending leave flow from here. Task assignment and progress collection can plug into this section next.
              </p>
              <div className="dashboard-project-meta">
                <div className="table-cell-stack">
                  <span className="table-cell-secondary">Scoped team members</span>
                  <span className="table-cell-primary">{scopedTeamCount}</span>
                </div>
                <div className="table-cell-stack">
                  <span className="table-cell-secondary">Pending team leaves</span>
                  <span className="table-cell-primary">{pendingTeamLeaves}</span>
                </div>
                <div className="table-cell-stack">
                  <span className="table-cell-secondary">Primary focus</span>
                  <span className="table-cell-primary">Daily coordination</span>
                </div>
                <div className="table-cell-stack">
                  <span className="table-cell-secondary">Next workflow</span>
                  <span className="table-cell-primary">Status collection</span>
                </div>
              </div>
              <div className="dashboard-quick-actions dashboard-quick-actions--compact">
                <button className="secondary" onClick={() => navigate("/attendance")}>
                  Review team attendance
                </button>
                <button className="secondary" onClick={() => navigate("/leaves")}>
                  Review team leaves
                </button>
              </div>
            </article>
          ) : null}

          <div className="grid cols-2 dashboard-support-grid">
            <article className="card metric-card">
              <p className="eyebrow">Leave activity</p>
              <strong>{pendingLeaveRequests.length}</strong>
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
                <span>Pending requests</span>
                <strong>{pendingLeaveRequests.length}</strong>
              </div>
            </article>
            <article className="card metric-card">
              <p className="eyebrow">This month</p>
              <strong>{formatLeaveDays(currentMonthLeaveTaken)}</strong>
              <p className="muted">Approved leave taken this month</p>
              <div className="dashboard-inline-row">
                <span>Unpaid leave</span>
                <strong>{formatLeaveDays(currentMonthUnpaidLeave)}</strong>
              </div>
            </article>
          </div>
        </>
      ) : (
      <div className="grid cols-2 dashboard-grid">
        {(role === "ADMIN" || role === "HR" || role === "MANAGER") ? (
          <article className="card metric-card metric-card--attendance-overview">
                <div className="metric-card-header">
                  <div>
                    <p className="eyebrow">Attendance overview</p>
                  </div>
                  <div className="dashboard-overview-tabs" role="tablist" aria-label="Attendance overview range">
                <button
                  type="button"
                  className={attendanceOverviewTab === "today" ? "dashboard-overview-tab active" : "dashboard-overview-tab"}
                  onClick={() => setAttendanceOverviewTab("today")}
                >
                  Today
                </button>
                <button
                  type="button"
                  className={attendanceOverviewTab === "month" ? "dashboard-overview-tab active" : "dashboard-overview-tab"}
                  onClick={() => setAttendanceOverviewTab("month")}
                >
                  Month
                </button>
              </div>
            </div>
            <div className="dashboard-attendance-chart__topbar">
              <div className="dashboard-attendance-chart__summary">
                <span>{activeOverviewSummaryLabel}</span>
                <strong>{activeOverviewSummary}</strong>
              </div>
            </div>
            {activeOverviewData.length ? (
              <div className="dashboard-attendance-chart">
                <div className="dashboard-attendance-chart__visual">
                  <ResponsiveContainer width="100%" height={188}>
                    <PieChart>
                      <Pie
                        data={activeOverviewData}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={attendanceOverviewTab === "today" ? 52 : 0}
                        outerRadius={76}
                        paddingAngle={3}
                        stroke="none"
                        label={
                          attendanceOverviewTab === "month"
                            ? ({ value, x, y }: { value?: number; x?: number; y?: number }) =>
                                value && x !== undefined && y !== undefined ? (
                                  <text
                                    x={x}
                                    y={y}
                                    fill="#ffffff"
                                    fontSize="12"
                                    fontWeight="700"
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                  >
                                    {formatChartValue(value)}
                                  </text>
                                ) : null
                            : false
                        }
                        labelLine={false}
                      >
                        {activeOverviewData.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        wrapperStyle={{ zIndex: 20 }}
                        content={
                          <AttendanceOverviewTooltip
                            denominator={activeOverviewDenominator}
                            contextLabel={activeOverviewLabel}
                          />
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {attendanceOverviewTab === "today" ? (
                    <div className="dashboard-attendance-chart__center">
                      <strong>{activeOverviewCenterTitle}</strong>
                      <span>{activeOverviewCenterSubtext}</span>
                    </div>
                  ) : null}
                </div>
                <div className="dashboard-attendance-chart__legend">
                  {attendanceOverviewTab === "today"
                    ? activeOverviewData.map((entry) => (
                        <div key={entry.key} className="dashboard-attendance-chart__legend-item">
                          <div className="dashboard-attendance-chart__legend-main">
                            <span className="dashboard-attendance-chart__swatch" style={{ backgroundColor: entry.color }} />
                            <span>{entry.label}</span>
                          </div>
                          <strong>{entry.value}</strong>
                        </div>
                      ))
                    : (
                      <>
                        <div className="dashboard-attendance-chart__legend-item">
                          <div className="dashboard-attendance-chart__legend-main">
                            <span className="dashboard-attendance-chart__swatch" style={{ backgroundColor: ADMIN_ATTENDANCE_COLORS.unmarked }} />
                            <span>Total workforce</span>
                          </div>
                          <strong>{workforceCount}</strong>
                        </div>
                        <div className="dashboard-attendance-chart__legend-item">
                          <div className="dashboard-attendance-chart__legend-main">
                            <span className="dashboard-attendance-chart__swatch" style={{ backgroundColor: ADMIN_ATTENDANCE_COLORS.present }} />
                            <span>Avg present/day</span>
                          </div>
                          <strong>{formatChartValue(presentAverageHeadcount)}</strong>
                        </div>
                        <div className="dashboard-attendance-chart__legend-item">
                          <div className="dashboard-attendance-chart__legend-main">
                            <span className="dashboard-attendance-chart__swatch" style={{ backgroundColor: ADMIN_ATTENDANCE_COLORS.leave }} />
                            <span>Leaves till date</span>
                          </div>
                          <strong>{leaveDaysInMonth}</strong>
                        </div>
                        <div className="dashboard-attendance-chart__legend-item">
                          <div className="dashboard-attendance-chart__legend-main">
                            <span className="dashboard-attendance-chart__swatch" style={{ backgroundColor: ADMIN_ATTENDANCE_COLORS.absent }} />
                            <span>Absents till date</span>
                          </div>
                          <strong>{absentDaysInMonth}</strong>
                        </div>
                        <div className="dashboard-attendance-chart__legend-item">
                          <div className="dashboard-attendance-chart__legend-main">
                            <span className="dashboard-attendance-chart__swatch" style={{ backgroundColor: ADMIN_ATTENDANCE_COLORS.halfDay }} />
                            <span>Half days</span>
                          </div>
                          <strong>{halfDays}</strong>
                        </div>
                      </>
                    )}
                </div>
              </div>
            ) : (
              <div className="dashboard-inline-row">
                <span>No attendance data yet</span>
                <strong>-</strong>
              </div>
            )}
          </article>
        ) : null}
        {(role === "ADMIN" || role === "HR" || role === "MANAGER") ? (
          <article className="card metric-card metric-card--leave-requests">
            <div className="metric-card-header">
              <div>
                <p className="eyebrow">Leave requests</p>
              </div>
              <div className="dashboard-card-actions">
                <div className="dashboard-overview-tabs" role="tablist" aria-label="Leave requests range">
                  <button
                    type="button"
                    className={leaveRequestsTab === "pending" ? "dashboard-overview-tab active" : "dashboard-overview-tab"}
                    onClick={() => setLeaveRequestsTab("pending")}
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    className={leaveRequestsTab === "month" ? "dashboard-overview-tab active" : "dashboard-overview-tab"}
                    onClick={() => setLeaveRequestsTab("month")}
                  >
                    Month
                  </button>
                </div>
                <button type="button" className="secondary dashboard-card-link" onClick={() => navigate("/leaves")}>
                  Review requests
                </button>
              </div>
            </div>
            {leaveRequestsTab === "pending" ? (
              <div className="dashboard-leave-requests-card">
                <div className="dashboard-leave-requests-card__visual">
                  {pendingLeaveChartData.length ? (
                    <ResponsiveContainer width="100%" height={188}>
                      <PieChart>
                        <Pie data={pendingLeaveChartData} dataKey="value" nameKey="label" innerRadius={52} outerRadius={76} paddingAngle={3} stroke="none">
                          {pendingLeaveChartData.map((entry) => (
                            <Cell key={entry.key} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="dashboard-inline-row dashboard-inline-row--empty">
                      <span>No pending requests</span>
                    </div>
                  )}
                  {pendingLeaveChartData.length ? (
                    <div className="dashboard-leave-requests-card__center">
                      <strong>{pendingRequests.length}</strong>
                      <span>pending</span>
                    </div>
                  ) : null}
                </div>
                <div className="dashboard-leave-requests-card__stats">
                  <div className="dashboard-leave-requests-card__stat">
                    <span>Total pending</span>
                    <strong>{pendingRequests.length}</strong>
                  </div>
                  <div className="dashboard-leave-requests-card__stat">
                    <span>Unpaid pending</span>
                    <strong>{pendingUnpaidRequests}</strong>
                  </div>
                  <div className="dashboard-leave-requests-card__stat">
                    <span>Half-day pending</span>
                    <strong>{pendingHalfDayRequests}</strong>
                  </div>
                  <div className="dashboard-leave-requests-card__stat">
                    <span>Earliest request</span>
                    <strong>{earliestPendingLeave ? new Date(earliestPendingLeave.startDate).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "-"}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="dashboard-leave-requests-card">
                <div className="dashboard-leave-requests-card__visual">
                  {monthLeaveTypeData.length ? (
                    <ResponsiveContainer width="100%" height={188}>
                      <BarChart data={monthLeaveTypeData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="code" tickLine={false} axisLine={false} fontSize={12} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="dashboard-inline-row dashboard-inline-row--empty">
                      <span>No leave activity this month</span>
                    </div>
                  )}
                </div>
                <div className="dashboard-leave-requests-card__stats">
                  <div className="dashboard-leave-requests-card__stat">
                    <span>Approved</span>
                    <strong>{approvedMonthRequests}</strong>
                  </div>
                  <div className="dashboard-leave-requests-card__stat">
                    <span>Rejected</span>
                    <strong>{rejectedMonthRequests}</strong>
                  </div>
                  <div className="dashboard-leave-requests-card__stat">
                    <span>Cancelled</span>
                    <strong>{cancelledMonthRequests}</strong>
                  </div>
                  <div className="dashboard-leave-requests-card__stat">
                    <span>Approved unpaid</span>
                    <strong>{approvedUnpaidMonthRequests}</strong>
                  </div>
                </div>
              </div>
            )}
          </article>
        ) : null}
        {currentEmployeeId && role !== "ADMIN" ? (
              <article className="card metric-card metric-card--attendance-widget">
                <div className="metric-card-header">
                  <div>
                    <p className="eyebrow">Attendance today</p>
                    <strong>{getAttendanceWidgetTitle(selfAttendance)}</strong>
                  </div>
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
        {nonEmployeeMetricEntries.map(([key, value]) => (
          <article key={key} className={`card metric-card metric-card--${getMetricVariant(key)}`}>
            <p className="eyebrow">{formatMetricKey(key)}</p>
            <strong>{formatMetricValue(value)}</strong>
            <p className="muted">{getMetricHint(key, value)}</p>
          </article>
        ))}
      </div>
      )}
        </>
      ) : null}
    </section>
  );
}
