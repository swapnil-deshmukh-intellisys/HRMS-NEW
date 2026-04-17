import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { apiRequest } from "../../services/api";
import type { Attendance, CalendarDay, LeaveRequest, Role } from "../../types";
import { formatMetricKey } from "../../utils/format";

const AttendanceOverviewCard = lazy(() =>
  import("./DashboardChartCards").then((module) => ({ default: module.AttendanceOverviewCard })),
);
const LeaveRequestsCard = lazy(() =>
  import("./DashboardChartCards").then((module) => ({ default: module.LeaveRequestsCard })),
);

type DashboardData = Record<string, number | string | boolean | null | undefined | object>;
type MetricVariant = "numeric" | "status";
type AttendanceOverviewTab = "today" | "month";
type LeaveRequestsTab = "pending" | "month";
type CalendarResponse = {
  month: number;
  year: number;
  days: CalendarDay[];
};

const ADMIN_ATTENDANCE_COLORS = {
  present: "#16a34a",
  halfDay: "#2563eb",
  leave: "#f59e0b",
  unmarked: "#e5e7eb",
  absent: "#ef4444",
} as const;

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

export default function ManagementAnalytics({ token, role }: { token: string | null; role: Role }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [attendanceOverviewTab, setAttendanceOverviewTab] = useState<AttendanceOverviewTab>("today");
  const [leaveRequestsTab, setLeaveRequestsTab] = useState<LeaveRequestsTab>("pending");
  const { summary: globalSummary } = useApp();

  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const endpoint = role === "MANAGER" ? "/dashboard/manager" : "/dashboard/hr";
    const now = new Date();
    const calendarEndpoint = `/calendar?month=${now.getMonth() + 1}&year=${now.getFullYear()}`;

    setLoading(true);
    Promise.all([
      apiRequest<DashboardData>(endpoint, { token }),
      apiRequest<Attendance[]>("/attendance", { token }),
      apiRequest<CalendarResponse>(calendarEndpoint, { token }),
      apiRequest<LeaveRequest[]>("/leaves", { token }),
    ])
      .then(([dashboardResponse, attendanceResponse, calendarResponse, leaveResponse]) => {
        setDashboardData(dashboardResponse.data);
        setAttendanceRecords(attendanceResponse.data);
        setCalendarDays(calendarResponse.data.days);
        setLeaveRequests(leaveResponse.data);
      })
      .catch((requestError) => console.error(requestError instanceof Error ? requestError.message : "Failed to load management dashboard"))
      .finally(() => setLoading(false));
  }, [role, token]);

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

      if (attendance.checkOutTime) return "Attendance completed";
      if (attendance.checkInTime) return "Checked in today";
      return attendance.status ?? "Attendance recorded";
    }

    if (key === "pendingLeaves") return "Awaiting action";
    if (key === "payrollCount") return "Total records";
    if (key === "employees") return "Active workforce";
    if (key === "departments") return "Configured teams";
    if (key === "teamCount") return "Direct reports";
    if (key === "pendingApprovals") return "Needs review";
    return "Live metric";
  }

  function formatMetricValueLocal(value: DashboardData[string]) {
    if (typeof value === "object") return "Available";
    return String(value ?? "-");
  }

  const effectiveSummary = (dashboardData || globalSummary || {}) as DashboardData;
  const metricEntries = Object.entries(effectiveSummary).filter(([key]) => key !== "attendanceToday" && key !== "currentEmployee" && typeof effectiveSummary[key] !== "object");
  const workforceCount = role === "MANAGER" ? Number(effectiveSummary.teamCount ?? 0) : Number(effectiveSummary.employees ?? 0);
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
        {metricEntries.map(([key, value]) => (
          <article key={key} className={`card metric-card metric-card--${getMetricVariant(key)}`}>
            <p className="eyebrow">{formatMetricKey(key)}</p>
            <strong>{formatMetricValueLocal(value)}</strong>
            <p className="muted">{getMetricHint(key, value)}</p>
          </article>
        ))}
      </div>
    </>
  );
}
