import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import type { Attendance, LeaveRequest } from "../../types";
import { getAttendanceWidgetTitle } from "./dashboardUtils";

const EmployeeAttendanceWidgetCard = lazy(() =>
  import("./DashboardChartCards").then((module) => ({ default: module.MemoizedEmployeeAttendanceWidgetCard })),
);

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

export default function EmployeeAnalytics() {
  const navigate = useNavigate();
  const { summary: globalSummary, analyticsData, fetchAnalyticsData } = useApp();
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  useEffect(() => {
    if (analyticsData) {
      setAttendanceRecords(analyticsData.attendanceRecords);
      setLoading(false);
    }
  }, [analyticsData]);

  const nowDate = new Date();
  const monthAttendanceRecords = attendanceRecords.filter((attendance) => {
    const attendanceDate = new Date(attendance.attendanceDate);
    return (
      attendanceDate.getFullYear() === nowDate.getFullYear() &&
      attendanceDate.getMonth() === nowDate.getMonth() &&
      attendanceDate <= nowDate
    );
  });

  const presentDays = monthAttendanceRecords.filter((attendance) => attendance.status === "PRESENT").length;
  
  const leaveRequests = globalSummary?.leaveRequests ?? [];
  const nextApprovedLeave = leaveRequests
    .filter((leave: LeaveRequest) => leave.status === "APPROVED" && new Date(leave.endDate) >= new Date())
    .sort((left: LeaveRequest, right: LeaveRequest) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime())[0];

  const currentMonthLeaveTaken = leaveRequests
    .filter((leave: LeaveRequest) => leave.status === "APPROVED")
    .reduce((sum: number, leave: LeaveRequest) => {
      const startDate = new Date(leave.startDate);
      if (startDate.getFullYear() === nowDate.getFullYear() && startDate.getMonth() === nowDate.getMonth()) {
        return sum + leave.totalDays;
      }
      return sum;
    }, 0);

  const currentMonthUnpaidLeave = leaveRequests
    .filter((leave: LeaveRequest) => leave.status === "APPROVED")
    .reduce((sum: number, leave: LeaveRequest) => {
      const startDate = new Date(leave.startDate);
      if (startDate.getFullYear() === nowDate.getFullYear() && startDate.getMonth() === nowDate.getMonth()) {
        return sum + leave.unpaidDays;
      }
      return sum;
    }, 0);

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
      <div className="grid cols-2 dashboard-grid analytics-top-grid">
        <Suspense fallback={<DashboardChartCardSkeleton eyebrow="Attendance today" />}>
          <EmployeeAttendanceWidgetCard 
            title={getAttendanceWidgetTitle(globalSummary?.attendanceToday ?? null)}
            selfAttendance={globalSummary?.attendanceToday ?? null}
          />
        </Suspense>

        <article className="card metric-card metric-card--project">
          <div className="metric-card-header">
            <div>
              <p className="eyebrow">Workspace</p>
              <strong>{globalSummary?.currentEmployee?.department ? `${globalSummary.currentEmployee.department.name} team` : "Department information"}</strong>
            </div>
            <div className="dashboard-project-badge">Active</div>
          </div>
          <p className="muted">
            {globalSummary?.currentEmployee?.manager
              ? `Reporting to ${globalSummary.currentEmployee.manager.firstName} ${globalSummary.currentEmployee.manager.lastName}`
              : "Manager linked"}
          </p>
          <div className="dashboard-project-meta">
            <div className="table-cell-stack">
              <span className="table-cell-secondary">Team members</span>
              <span className="table-cell-primary">{String(globalSummary?.scopedTeamCount ?? 0)}</span>
            </div>
            <div className="table-cell-stack">
              <span className="table-cell-secondary">Pending approvals</span>
              <span className="table-cell-primary">{String(globalSummary?.pendingTeamLeaves ?? 0)}</span>
            </div>
          </div>
          <div className="dashboard-inline-row" style={{ justifyContent: "flex-end" }}>
            <div className="dashboard-card-actions">
              <button className="secondary" onClick={() => navigate("/leaves")}>
                Apply for leave
              </button>
            </div>
          </div>
        </article>
      </div>

      <div className="grid cols-3 dashboard-grid">
        <article className="card metric-card metric-card--status">
          <p className="eyebrow">Monthly leave usage</p>
          <strong>{currentMonthLeaveTaken} days</strong>
          <p className="muted">{nowDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
          {currentMonthUnpaidLeave > 0 && <p className="dashboard-attendance-note">{currentMonthUnpaidLeave} days unpaid</p>}
        </article>

        <article className="card metric-card metric-card--numeric">
          <p className="eyebrow">Next approved leave</p>
          <strong>
            {nextApprovedLeave
              ? new Date(nextApprovedLeave.startDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })
              : "None scheduled"}
          </strong>
          <p className="muted">Upcoming activity</p>
        </article>

        <article className="card metric-card metric-card--numeric">
          <p className="eyebrow">Attendance record</p>
          <strong>{presentDays}</strong>
          <p className="muted">Days present this month</p>
        </article>
      </div>
    </>
  );
}
