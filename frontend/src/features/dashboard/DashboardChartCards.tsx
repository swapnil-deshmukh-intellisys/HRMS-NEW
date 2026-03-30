import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Attendance, LeaveBalance } from "../../types";
import { formatLeaveDays, formatTime } from "../../utils/format";

type EmployeeAttendanceProgressEntry = {
  key: string;
  value: number;
  color: string;
};

type LeaveBalanceChartEntry = {
  id: number;
  name: string;
  fullName: string;
  value: number;
  allocated: number;
  color: string;
};

type AttendanceOverviewEntry = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type PendingLeaveChartEntry = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type MonthLeaveTypeEntry = {
  code: string;
  value: number;
};

type AttendanceOverviewTooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload: AttendanceOverviewEntry;
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

export function EmployeeAttendanceWidgetCard(props: {
  title: string;
  attendanceTodayDateLabel: string;
  selfAttendance: Attendance | null;
  progressData: EmployeeAttendanceProgressEntry[];
  centerPrimary: string;
  centerSecondary: string;
  workedTodayDisplay: string;
  progressPercent: number;
  shiftTargetDisplay: string;
}) {
  const {
    title,
    attendanceTodayDateLabel,
    selfAttendance,
    progressData,
    centerPrimary,
    centerSecondary,
    workedTodayDisplay,
    progressPercent,
    shiftTargetDisplay,
  } = props;

  return (
    <article className="card metric-card metric-card--attendance-widget">
      <div className="metric-card-header">
        <div>
          <p className="eyebrow">Attendance today</p>
          <strong>{title}</strong>
          <p className="muted">{attendanceTodayDateLabel}</p>
        </div>
      </div>
      <div className="dashboard-attendance-progress">
        <div className="dashboard-attendance-progress__visual">
          <ResponsiveContainer width="100%" height={188}>
            <PieChart>
              <Pie
                data={progressData}
                dataKey="value"
                nameKey="key"
                innerRadius={52}
                outerRadius={76}
                paddingAngle={selfAttendance?.checkInTime || selfAttendance?.checkOutTime ? 3 : 0}
                stroke="none"
              >
                {progressData.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="dashboard-attendance-progress__center">
            <strong>{centerPrimary}</strong>
            <span>{centerSecondary}</span>
          </div>
        </div>
        <div className="dashboard-attendance-progress__details">
          <div className="dashboard-attendance-progress__summary">
            <span>Shift target</span>
            <strong>{shiftTargetDisplay}</strong>
          </div>
          <div className="dashboard-attendance-progress__stats">
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
              <span className="table-cell-primary">{workedTodayDisplay}</span>
            </div>
            <div className="table-cell-stack">
              <span className="table-cell-secondary">Progress</span>
              <span className="table-cell-primary">
                {selfAttendance?.checkInTime || selfAttendance?.checkOutTime ? `${progressPercent}%` : "-"}
              </span>
            </div>
          </div>
          <div className="dashboard-attendance-progress__bar">
            <div
              className="dashboard-attendance-progress__bar-fill"
              style={{ width: `${selfAttendance?.checkInTime || selfAttendance?.checkOutTime ? progressPercent : 0}%` }}
            />
          </div>
          <div className="dashboard-inline-row">
            <span>Worked vs target</span>
            <strong>{workedTodayDisplay === "-" ? "-" : `${workedTodayDisplay} / ${shiftTargetDisplay}`}</strong>
          </div>
        </div>
      </div>
    </article>
  );
}

export function EmployeeLeaveBalanceCard(props: {
  totalRemainingLeave: number;
  totalAllocatedLeave: number;
  totalUsedLeave: number;
  leaveChartData: LeaveBalanceChartEntry[];
  leaveBalances: LeaveBalance[];
}) {
  const { totalRemainingLeave, totalAllocatedLeave, totalUsedLeave, leaveChartData, leaveBalances } = props;

  return (
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
                        {Number.isInteger(entry.value) ? entry.value : entry.value.toFixed(1)}/
                        {Number.isInteger(entry.allocated) ? entry.allocated : entry.allocated.toFixed(1)} days
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
  );
}

export function AttendanceOverviewCard(props: {
  attendanceOverviewTab: "today" | "month";
  onTabChange: (tab: "today" | "month") => void;
  activeOverviewSummaryLabel: string;
  activeOverviewSummary: string;
  activeOverviewData: AttendanceOverviewEntry[];
  activeOverviewDenominator: number;
  activeOverviewLabel: string;
  activeOverviewCenterTitle: string;
  activeOverviewCenterSubtext: string;
  workforceCount: number;
  presentAverageHeadcount: number;
  leaveDaysInMonth: number;
  absentDaysInMonth: number;
  halfDays: number;
}) {
  const {
    attendanceOverviewTab,
    onTabChange,
    activeOverviewSummaryLabel,
    activeOverviewSummary,
    activeOverviewData,
    activeOverviewDenominator,
    activeOverviewLabel,
    activeOverviewCenterTitle,
    activeOverviewCenterSubtext,
    workforceCount,
    presentAverageHeadcount,
    leaveDaysInMonth,
    absentDaysInMonth,
    halfDays,
  } = props;

  return (
    <article className="card metric-card metric-card--attendance-overview">
      <div className="metric-card-header">
        <div>
          <p className="eyebrow">Attendance overview</p>
        </div>
        <div className="dashboard-overview-tabs" role="tablist" aria-label="Attendance overview range">
          <button
            type="button"
            className={attendanceOverviewTab === "today" ? "dashboard-overview-tab active" : "dashboard-overview-tab"}
            onClick={() => onTabChange("today")}
          >
            Today
          </button>
          <button
            type="button"
            className={attendanceOverviewTab === "month" ? "dashboard-overview-tab active" : "dashboard-overview-tab"}
            onClick={() => onTabChange("month")}
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
                  content={<AttendanceOverviewTooltip denominator={activeOverviewDenominator} contextLabel={activeOverviewLabel} />}
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
                      <span className="dashboard-attendance-chart__swatch" style={{ backgroundColor: "#e5e7eb" }} />
                      <span>Total workforce</span>
                    </div>
                    <strong>{workforceCount}</strong>
                  </div>
                  <div className="dashboard-attendance-chart__legend-item">
                    <div className="dashboard-attendance-chart__legend-main">
                      <span className="dashboard-attendance-chart__swatch" style={{ backgroundColor: "#16a34a" }} />
                      <span>Avg present/day</span>
                    </div>
                    <strong>{formatChartValue(presentAverageHeadcount)}</strong>
                  </div>
                  <div className="dashboard-attendance-chart__legend-item">
                    <div className="dashboard-attendance-chart__legend-main">
                      <span className="dashboard-attendance-chart__swatch" style={{ backgroundColor: "#f59e0b" }} />
                      <span>Leaves till date</span>
                    </div>
                    <strong>{leaveDaysInMonth}</strong>
                  </div>
                  <div className="dashboard-attendance-chart__legend-item">
                    <div className="dashboard-attendance-chart__legend-main">
                      <span className="dashboard-attendance-chart__swatch" style={{ backgroundColor: "#ef4444" }} />
                      <span>Absents till date</span>
                    </div>
                    <strong>{absentDaysInMonth}</strong>
                  </div>
                  <div className="dashboard-attendance-chart__legend-item">
                    <div className="dashboard-attendance-chart__legend-main">
                      <span className="dashboard-attendance-chart__swatch" style={{ backgroundColor: "#2563eb" }} />
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
  );
}

export function LeaveRequestsCard(props: {
  leaveRequestsTab: "pending" | "month";
  onTabChange: (tab: "pending" | "month") => void;
  onReviewRequests: () => void;
  pendingLeaveChartData: PendingLeaveChartEntry[];
  pendingRequestsCount: number;
  pendingUnpaidRequests: number;
  pendingHalfDayRequests: number;
  earliestPendingLeaveLabel: string;
  monthLeaveTypeData: MonthLeaveTypeEntry[];
  approvedMonthRequests: number;
  rejectedMonthRequests: number;
  cancelledMonthRequests: number;
  approvedUnpaidMonthRequests: number;
}) {
  const {
    leaveRequestsTab,
    onTabChange,
    onReviewRequests,
    pendingLeaveChartData,
    pendingRequestsCount,
    pendingUnpaidRequests,
    pendingHalfDayRequests,
    earliestPendingLeaveLabel,
    monthLeaveTypeData,
    approvedMonthRequests,
    rejectedMonthRequests,
    cancelledMonthRequests,
    approvedUnpaidMonthRequests,
  } = props;

  return (
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
              onClick={() => onTabChange("pending")}
            >
              Pending
            </button>
            <button
              type="button"
              className={leaveRequestsTab === "month" ? "dashboard-overview-tab active" : "dashboard-overview-tab"}
              onClick={() => onTabChange("month")}
            >
              Month
            </button>
          </div>
          <button type="button" className="secondary dashboard-card-link" onClick={onReviewRequests}>
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
                <strong>{pendingRequestsCount}</strong>
                <span>pending</span>
              </div>
            ) : null}
          </div>
          <div className="dashboard-leave-requests-card__stats">
            <div className="dashboard-leave-requests-card__stat">
              <span>Total pending</span>
              <strong>{pendingRequestsCount}</strong>
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
              <strong>{earliestPendingLeaveLabel}</strong>
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
  );
}
