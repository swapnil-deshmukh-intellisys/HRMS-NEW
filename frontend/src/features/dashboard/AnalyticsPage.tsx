import "./DashboardPage.css";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ATTENDANCE_EVENT, getAttendanceUpdatedDetail } from "../../components/common/attendanceQuickActionUtils";
import MessageCard from "../../components/common/MessageCard";
import { apiRequest } from "../../services/api";
import type { Attendance, CalendarDay, Employee, EmployeeDashboardData, LeaveBalance, LeaveRequest, Role } from "../../types";
import { formatAttendanceTime, formatLeaveDays, formatMetricKey } from "../../utils/format";

type DashboardData = Record<string, number | string | boolean | null | undefined | object>;
type MetricVariant = "numeric" | "status";
type AttendanceOverviewTab = "today" | "month";
type LeaveRequestsTab = "pending" | "month";
type CalendarResponse = {
  month: number;
  year: number;
  days: CalendarDay[];
};

const EmployeeAttendanceWidgetCard = lazy(() =>
  import("./DashboardChartCards").then((module) => ({ default: module.EmployeeAttendanceWidgetCard })),
);
const EmployeeLeaveBalanceCard = lazy(() =>
  import("./DashboardChartCards").then((module) => ({ default: module.EmployeeLeaveBalanceCard })),
);
const AttendanceOverviewCard = lazy(() =>
  import("./DashboardChartCards").then((module) => ({ default: module.AttendanceOverviewCard })),
);
const LeaveRequestsCard = lazy(() =>
  import("./DashboardChartCards").then((module) => ({ default: module.LeaveRequestsCard })),
);

const LEAVE_BALANCE_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#ef4444"];
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

function DashboardChartCardSkeleton({ eyebrow }: { eyebrow: string }) {
  return (
    <article className="card metric-card dashboard-chart-card-skeleton">
      <p className="eyebrow">{eyebrow}</p>
      <div className="dashboard-chart-card-skeleton__visual" />
      <div className="dashboard-chart-card-skeleton__rows">
        <span className="skeleton-line skeleton-line--short" />
        <span className="skeleton-line skeleton-line--long" />
        <span className="skeleton-line skeleton-line--short" />
      </div>
    </article>
  );
}

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
        ? apiRequest<EmployeeDashboardData>(endpoint, { token })
        : Promise.all([
            apiRequest<DashboardData>(endpoint, { token }),
            apiRequest<Attendance[]>("/attendance", { token }),
            apiRequest<CalendarResponse>(calendarEndpoint, { token }),
            apiRequest<LeaveRequest[]>("/leaves", { token }),
          ]);

    requests
      .then((responses) => {
        if (role === "EMPLOYEE") {
          const dashboardResponse = responses as Awaited<ReturnType<typeof apiRequest<EmployeeDashboardData>>>;
          const employeeDashboard = dashboardResponse.data;

          setData({
            attendanceToday: employeeDashboard.attendanceToday,
            pendingLeaves: employeeDashboard.pendingLeaves,
            payrollCount: employeeDashboard.payrollCount,
            isTeamLead: employeeDashboard.isTeamLead,
            scopedTeamCount: employeeDashboard.scopedTeamCount,
            pendingTeamLeaves: employeeDashboard.pendingTeamLeaves,
          });
          setSelfAttendance(employeeDashboard.attendanceToday);
          setAttendanceRecords(employeeDashboard.attendanceRecords);
          setCalendarDays(employeeDashboard.calendarDays);
          setCurrentEmployee(employeeDashboard.currentEmployee);
          setLeaveBalances(employeeDashboard.leaveBalances);
          setLeaveRequests(employeeDashboard.leaveRequests);
          return;
        }

        const [dashboardResponse, attendanceResponse, calendarResponse, leaveResponse] = responses as [
          Awaited<ReturnType<typeof apiRequest<DashboardData>>>,
          Awaited<ReturnType<typeof apiRequest<Attendance[]>>>,
          Awaited<ReturnType<typeof apiRequest<CalendarResponse>>>,
          Awaited<ReturnType<typeof apiRequest<LeaveRequest[]>>>,
        ];

        setData(dashboardResponse.data);
        setAttendanceRecords(attendanceResponse.data);
        setCalendarDays(calendarResponse.data.days);
        setLeaveRequests(leaveResponse.data);
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [currentEmployeeId, role, token]);

  const loadSelfAttendance = useCallback(async () => {
    if (!currentEmployeeId) {
      setSelfAttendance(null);
      return;
    }

    try {
      const response = await apiRequest<{ attendanceToday?: Attendance | null }>("/attendance/today", { token });
      setSelfAttendance(response.data.attendanceToday ?? null);
    } catch {
      setSelfAttendance(null);
    }
  }, [currentEmployeeId, token]);

  useEffect(() => {
    if (role === "EMPLOYEE") {
      return;
    }

    void loadSelfAttendance();
  }, [loadSelfAttendance, role]);

  useEffect(() => {
    const handleAttendanceUpdated = (event: Event) => {
      const detail = getAttendanceUpdatedDetail(event);

      if (detail) {
        setSelfAttendance(detail.attendanceToday);
        setData((current) => ({ ...current, attendanceToday: detail.attendanceToday }));
        return;
      }

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
  const elapsedWorkingDays = calendarDays.filter((day) => day.isWorkingDay && new Date(day.date) <= nowDate).length;
  const totalWorkingDaysInMonth = calendarDays.filter((day) => day.isWorkingDay).length;
  const presentDays = monthAttendanceRecords.filter((attendance) => attendance.status === "PRESENT").length;
  const halfDays = monthAttendanceRecords.filter((attendance) => attendance.status === "HALF_DAY").length;
  const leaveDaysInMonth = monthAttendanceRecords.filter((attendance) => attendance.status === "LEAVE").length;
  const absentDaysInMonth = monthAttendanceRecords.filter((attendance) => attendance.status === "ABSENT").length;
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

  const shiftTargetMinutes = 8 * 60;
  const workedTodayMinutes = (() => {
    if (!selfAttendance || selfAttendance.status === "LEAVE" || selfAttendance.status === "ABSENT") {
      return 0;
    }

    if (selfAttendance.checkOutTime) {
      return selfAttendance.workedMinutes;
    }

    if (selfAttendance.checkInTime) {
      const checkIn = new Date(selfAttendance.checkInTime);
      return Math.max(0, Math.floor((now.getTime() - checkIn.getTime()) / 60000));
    }

    return 0;
  })();
  const attendanceTodayDateLabel = now.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
  });
  const attendanceProgressPercent = Math.min(100, Math.round((workedTodayMinutes / shiftTargetMinutes) * 100));
  const workedTodayDisplay = selfAttendance?.status === "LEAVE" ? "-" : formatWorkedDuration(workedTodayMinutes);
  const attendanceTodayProgressData =
    selfAttendance?.status === "LEAVE"
      ? [{ key: "leave", value: 1, color: "#f59e0b" }]
      : selfAttendance?.status === "ABSENT"
        ? [{ key: "absent", value: 1, color: "#ef4444" }]
        : selfAttendance?.checkInTime || selfAttendance?.checkOutTime
          ? [
              { key: "worked", value: Math.max(workedTodayMinutes, 1), color: "#16a34a" },
              { key: "remaining", value: Math.max(shiftTargetMinutes - workedTodayMinutes, 0), color: "#e5e7eb" },
            ]
          : [{ key: "unmarked", value: 1, color: "#e5e7eb" }];
  const attendanceCenterPrimary =
    selfAttendance?.status === "LEAVE"
      ? "Leave"
      : selfAttendance?.status === "ABSENT"
        ? "Absent"
        : selfAttendance?.checkInTime || selfAttendance?.checkOutTime
          ? `${attendanceProgressPercent}%`
          : "Not marked";
  const attendanceCenterSecondary =
    selfAttendance?.checkInTime || selfAttendance?.checkOutTime
      ? "today done"
      : selfAttendance?.status === "LEAVE"
        ? "paid day"
        : selfAttendance?.status === "ABSENT"
          ? "not worked"
          : attendanceTodayDateLabel;

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
  const nonEmployeeMetricEntries = metricEntries.filter(([key]) => {
    if (key === "employees" || key === "teamCount" || key === "pendingLeaves") {
      return false;
    }

    if (role === "ADMIN" && key === "payrollCount") {
      return false;
    }

    return true;
  });

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
            {currentEmployeeId ? (
              <Suspense fallback={<DashboardChartCardSkeleton eyebrow="Attendance today" />}>
                <EmployeeAttendanceWidgetCard
                  title={getAttendanceWidgetTitle(selfAttendance)}
                  attendanceTodayDateLabel={attendanceTodayDateLabel}
                  selfAttendance={selfAttendance}
                  progressData={attendanceTodayProgressData}
                  centerPrimary={attendanceCenterPrimary}
                  centerSecondary={attendanceCenterSecondary}
                  workedTodayDisplay={workedTodayDisplay}
                  progressPercent={attendanceProgressPercent}
                  shiftTargetDisplay={formatWorkedDuration(shiftTargetMinutes)}
                />
              </Suspense>
            ) : null}
            <Suspense fallback={<DashboardChartCardSkeleton eyebrow="Leave balance" />}>
              <EmployeeLeaveBalanceCard
                totalRemainingLeave={totalRemainingLeave}
                totalAllocatedLeave={totalAllocatedLeave}
                totalUsedLeave={totalUsedLeave}
                leaveChartData={leaveChartData}
                leaveBalances={leaveBalances}
              />
            </Suspense>
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
          <Suspense fallback={<DashboardChartCardSkeleton eyebrow="Attendance overview" />}>
            <AttendanceOverviewCard
              attendanceOverviewTab={attendanceOverviewTab}
              onTabChange={setAttendanceOverviewTab}
              activeOverviewSummaryLabel={activeOverviewSummaryLabel}
              activeOverviewSummary={activeOverviewSummary}
              activeOverviewData={activeOverviewData}
              activeOverviewDenominator={activeOverviewDenominator}
              activeOverviewLabel={activeOverviewLabel}
              activeOverviewCenterTitle={activeOverviewCenterTitle}
              activeOverviewCenterSubtext={activeOverviewCenterSubtext}
              workforceCount={workforceCount}
              presentAverageHeadcount={presentAverageHeadcount}
              leaveDaysInMonth={leaveDaysInMonth}
              absentDaysInMonth={absentDaysInMonth}
              halfDays={halfDays}
            />
          </Suspense>
        ) : null}
        {(role === "ADMIN" || role === "HR" || role === "MANAGER") ? (
          <Suspense fallback={<DashboardChartCardSkeleton eyebrow="Leave requests" />}>
            <LeaveRequestsCard
              leaveRequestsTab={leaveRequestsTab}
              onTabChange={setLeaveRequestsTab}
              onReviewRequests={() => navigate("/leaves")}
              pendingLeaveChartData={pendingLeaveChartData}
              pendingRequestsCount={pendingRequests.length}
              pendingUnpaidRequests={pendingUnpaidRequests}
              pendingHalfDayRequests={pendingHalfDayRequests}
              earliestPendingLeaveLabel={
                earliestPendingLeave
                  ? new Date(earliestPendingLeave.startDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })
                  : "-"
              }
              monthLeaveTypeData={monthLeaveTypeData}
              approvedMonthRequests={approvedMonthRequests}
              rejectedMonthRequests={rejectedMonthRequests}
              cancelledMonthRequests={cancelledMonthRequests}
              approvedUnpaidMonthRequests={approvedUnpaidMonthRequests}
            />
          </Suspense>
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
                <span className="table-cell-primary">{formatAttendanceTime(selfAttendance?.checkInTime)}</span>
              </div>
              <div className="table-cell-stack">
                <span className="table-cell-secondary">Check out</span>
                <span className="table-cell-primary">{formatAttendanceTime(selfAttendance?.checkOutTime)}</span>
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
