import "./TeamPage.css";
import { useEffect, useMemo, useState } from "react";
import MessageCard from "../../components/common/MessageCard";
import Table from "../../components/common/Table";
import { apiRequest } from "../../services/api";
import type { Attendance, Employee, LeaveRequest, Role } from "../../types";
import { formatAttendanceTime, formatDateLabel, formatLeaveDays } from "../../utils/format";

type TeamPageProps = {
  token: string | null;
  role: Role;
  currentEmployeeId: number | null;
  currentEmployee: Employee | null;
};

type TeamTab = "ATTENDANCE" | "LEAVES";
type TeamPrimaryTab = "PROJECTS" | "MEMBERS";
type VisibleMonth = {
  month: number;
  year: number;
};

function toLocalDateString(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDateString(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function getVisibleMonthFromDate(value: string) {
  const date = parseLocalDateString(value);
  return {
    month: date.getMonth(),
    year: date.getFullYear(),
  };
}

function getCalendarDays({ month, year }: VisibleMonth) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const leadingDays = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();
  const totalCells = Math.ceil((leadingDays + totalDays) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const date = new Date(year, month, index - leadingDays + 1);
    return {
      key: date.toISOString(),
      value: date,
      inCurrentMonth: date.getMonth() === month,
    };
  });
}

export default function TeamPage({ token, role, currentEmployeeId, currentEmployee }: TeamPageProps) {
  const today = toLocalDateString(new Date());
  const [primaryTab, setPrimaryTab] = useState<TeamPrimaryTab>("PROJECTS");
  const [teamTab, setTeamTab] = useState<TeamTab>("ATTENDANCE");
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<VisibleMonth>(() => getVisibleMonthFromDate(today));
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [teamAttendanceFilter, setTeamAttendanceFilter] = useState<"" | "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY">("");
  const isTeamLead = Boolean(currentEmployee?.capabilities?.some((capability) => capability.capability === "TEAM_LEAD"));
  const teamMembers = useMemo(() => currentEmployee?.scopedTeamMembers?.map((item) => item.employee) ?? [], [currentEmployee?.scopedTeamMembers]);
  const teamMemberIds = useMemo(() => new Set(teamMembers.map((member) => member.id)), [teamMembers]);
  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const currentMonthLabel = new Date(visibleMonth.year, visibleMonth.month, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  useEffect(() => {
    if (!isTeamLead || !token) {
      setLoading(false);
      return;
    }

    async function loadTeamData() {
      try {
        setLoading(true);
        setError("");
        const attendancePath = attendanceDate ? `/attendance?date=${attendanceDate}` : "/attendance";
        const [attendanceResponse, leaveResponse] = await Promise.all([
          apiRequest<Attendance[]>(attendancePath, { token }),
          apiRequest<LeaveRequest[]>("/leaves", { token }),
        ]);
        setAttendance(attendanceResponse.data);
        setLeaves(leaveResponse.data);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed to load team data.");
      } finally {
        setLoading(false);
      }
    }

    void loadTeamData();
  }, [attendanceDate, isTeamLead, token]);

  useEffect(() => {
    setVisibleMonth(getVisibleMonthFromDate(attendanceDate || today));
  }, [attendanceDate, today]);

  const teamAttendanceRows = useMemo(
    () =>
      attendance.filter((record) => {
        if (!teamMemberIds.has(record.employeeId)) return false;
        if (!teamAttendanceFilter) return true;
        if (teamAttendanceFilter === "PRESENT") return record.status === "PRESENT" || record.status === "HALF_DAY";
        return record.status === teamAttendanceFilter;
      }),
    [attendance, teamAttendanceFilter, teamMemberIds],
  );

  const teamAttendanceOverview = useMemo(
    () =>
      attendance
        .filter((record) => teamMemberIds.has(record.employeeId))
        .reduce(
          (summary, record) => {
            if (record.status === "PRESENT" || record.status === "HALF_DAY") summary.present += 1;
            if (record.status === "ABSENT") summary.absent += 1;
            if (record.status === "LEAVE") summary.leave += 1;
            return summary;
          },
          { present: 0, absent: 0, leave: 0 },
        ),
    [attendance, teamMemberIds],
  );

  const teamLeaveRows = useMemo(
    () => leaves.filter((leave) => teamMemberIds.has(leave.employee.id)),
    [leaves, teamMemberIds],
  );

  function getStatusClass(status: Attendance["status"]) {
    return `status-pill status-pill--${status.toLowerCase().replace(/_/g, "-")}`;
  }

  function formatWorkedDuration(workedMinutes: number) {
    if (!workedMinutes || workedMinutes <= 0) {
      return "-";
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

  function getWorkedDurationLabel(record: Attendance) {
    if (record.status === "LEAVE") {
      return "-";
    }

    if (record.status === "ABSENT") {
      return "Absent";
    }

    if (record.checkOutTime) {
      return formatWorkedDuration(record.workedMinutes);
    }

    return toLocalDateString(new Date(record.attendanceDate)) === today ? "In progress" : "Checkout missing";
  }

  if (role !== "EMPLOYEE" || !isTeamLead) {
    return (
      <section className="stack">
        <MessageCard title="Team workspace" tone="error" message="This page is available only for Team Leads." />
      </section>
    );
  }

  return (
    <section className="stack">
      {error ? <MessageCard title="Team issue" tone="error" message={error} /> : null}
      <div className="team-page-primary-tabs" role="tablist" aria-label="Team workspace sections">
        <button
          type="button"
          role="tab"
          aria-selected={primaryTab === "PROJECTS"}
          className={`team-page-primary-tab ${primaryTab === "PROJECTS" ? "team-page-primary-tab--active" : ""}`.trim()}
          onClick={() => setPrimaryTab("PROJECTS")}
        >
          Ongoing Projects
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={primaryTab === "MEMBERS"}
          className={`team-page-primary-tab ${primaryTab === "MEMBERS" ? "team-page-primary-tab--active" : ""}`.trim()}
          onClick={() => setPrimaryTab("MEMBERS")}
        >
          Members
        </button>
      </div>

      {primaryTab === "PROJECTS" ? (
        <div className="card dense-table-card team-page-card">
        <div className="team-page-header">
            <div>
              <h3>Projects overview</h3>
              <p className="muted">This is a placeholder overview. Project tracking cards and delivery status will be added here.</p>
            </div>
          </div>
          <div className="team-page-overview-grid">
            <article className="team-page-overview-card">
              <p className="eyebrow">Active projects</p>
              <strong>04</strong>
              <p className="muted">Dummy metrics for initial layout.</p>
            </article>
            <article className="team-page-overview-card">
              <p className="eyebrow">Upcoming milestones</p>
              <strong>07</strong>
              <p className="muted">Dummy metrics for initial layout.</p>
            </article>
            <article className="team-page-overview-card">
              <p className="eyebrow">At risk items</p>
              <strong>02</strong>
              <p className="muted">Dummy metrics for initial layout.</p>
            </article>
          </div>
          <div className="team-page-overview-note">
            <p className="eyebrow">Roadmap</p>
            <p className="muted">
              Next step: connect project entities, owner assignments, target dates, and progress percentages to replace this dummy overview.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="card dense-table-card team-page-card">
            <div className="team-page-header">
              <div>
                <h3>Team workspace</h3>
                <p className="muted">View team members and switch between team attendance and leave records.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table table--dense">
                <thead>
                  <tr>
                    <th>Team member</th>
                    <th>Designation</th>
                    <th>Employee code</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.length ? (
                    teamMembers.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <span className="table-cell-primary">{`${member.firstName} ${member.lastName}`}</span>
                        </td>
                        <td>{member.jobTitle ?? "-"}</td>
                        <td>{member.employeeCode}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3}>
                        <div className="table-empty-state">
                          <strong>No team members assigned.</strong>
                          <span>Assigned team members will appear here.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card dense-table-card team-page-card">
            <div className="team-page-header">
              <div className="team-page-tabs" role="tablist" aria-label="Team data">
                <button
                  type="button"
                  role="tab"
                  aria-selected={teamTab === "ATTENDANCE"}
                  className={`team-page-tab ${teamTab === "ATTENDANCE" ? "team-page-tab--active" : ""}`.trim()}
                  onClick={() => setTeamTab("ATTENDANCE")}
                >
                  Attendance
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={teamTab === "LEAVES"}
                  className={`team-page-tab ${teamTab === "LEAVES" ? "team-page-tab--active" : ""}`.trim()}
                  onClick={() => setTeamTab("LEAVES")}
                >
                  Leaves
                </button>
              </div>
          {teamTab === "ATTENDANCE" ? (
            <div className="team-page-attendance-controls">
              <label className="team-page-date-filter">
                Date
                <div className="team-page-date-picker">
                  <button
                    type="button"
                    className="team-page-date-input team-page-date-trigger"
                    onClick={() => setDatePickerOpen((current) => !current)}
                  >
                    <span>{formatDateLabel(attendanceDate)}</span>
                  </button>
                  {datePickerOpen ? (
                    <div className="team-page-date-popover">
                      <div className="team-page-date-popover__header">
                        <button
                          type="button"
                          className="secondary team-page-date-popover__nav"
                          onClick={() =>
                            setVisibleMonth((current) => {
                              const previousMonth = new Date(current.year, current.month - 1, 1);
                              return {
                                month: previousMonth.getMonth(),
                                year: previousMonth.getFullYear(),
                              };
                            })
                          }
                        >
                          Prev
                        </button>
                        <strong>{currentMonthLabel}</strong>
                        <button
                          type="button"
                          className="secondary team-page-date-popover__nav"
                          onClick={() =>
                            setVisibleMonth((current) => {
                              const nextMonth = new Date(current.year, current.month + 1, 1);
                              return {
                                month: nextMonth.getMonth(),
                                year: nextMonth.getFullYear(),
                              };
                            })
                          }
                        >
                          Next
                        </button>
                      </div>
                      <div className="team-page-date-popover__weekdays">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
                          <span key={label}>{label}</span>
                        ))}
                      </div>
                      <div className="team-page-date-popover__grid">
                        {calendarDays.map((day) => {
                          const isoDate = toLocalDateString(day.value);
                          const isSelected = isoDate === attendanceDate;
                          const isFuture = isoDate > today;

                          return (
                            <button
                              key={day.key}
                              type="button"
                              className={`team-page-date-popover__day ${!day.inCurrentMonth ? "team-page-date-popover__day--muted" : ""} ${isSelected ? "team-page-date-popover__day--selected" : ""}`.trim()}
                              disabled={isFuture}
                              onClick={() => {
                                setAttendanceDate(isoDate);
                                setDatePickerOpen(false);
                              }}
                            >
                              {day.value.getDate()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </label>
              <div className="team-page-overview-row">
                <button
                  type="button"
                  className={`team-page-overview-chip team-page-overview-chip--present ${teamAttendanceFilter === "PRESENT" ? "team-page-overview-chip--active" : ""}`.trim()}
                  onClick={() => setTeamAttendanceFilter((current) => (current === "PRESENT" ? "" : "PRESENT"))}
                >
                  <span className="team-page-overview-chip__label">Present</span>
                  <strong className="team-page-overview-chip__value">{teamAttendanceOverview.present}</strong>
                </button>
                <button
                  type="button"
                  className={`team-page-overview-chip team-page-overview-chip--absent ${teamAttendanceFilter === "ABSENT" ? "team-page-overview-chip--active" : ""}`.trim()}
                  onClick={() => setTeamAttendanceFilter((current) => (current === "ABSENT" ? "" : "ABSENT"))}
                >
                  <span className="team-page-overview-chip__label">Absent</span>
                  <strong className="team-page-overview-chip__value">{teamAttendanceOverview.absent}</strong>
                </button>
                <button
                  type="button"
                  className={`team-page-overview-chip team-page-overview-chip--leave ${teamAttendanceFilter === "LEAVE" ? "team-page-overview-chip--active" : ""}`.trim()}
                  onClick={() => setTeamAttendanceFilter((current) => (current === "LEAVE" ? "" : "LEAVE"))}
                >
                  <span className="team-page-overview-chip__label">On leave</span>
                  <strong className="team-page-overview-chip__value">{teamAttendanceOverview.leave}</strong>
                </button>
              </div>
            </div>
          ) : null}
        </div>
            {loading ? (
              <div className="page-loading">
                <span className="skeleton-line skeleton-line--title" />
                <span className="skeleton-line skeleton-line--long" />
                <span className="skeleton-line skeleton-line--long" />
              </div>
            ) : teamTab === "ATTENDANCE" ? (
              <Table
                compact
                columns={["Employee", "Designation", "Date", "Check in", "Check out", "Worked duration", "Status"]}
                rows={teamAttendanceRows.map((record) => [
                  <span className="table-cell-primary" key={`team-attendance-name-${record.id}`}>
                    {record.employee ? `${record.employee.firstName} ${record.employee.lastName}` : `Employee #${record.employeeId}`}
                  </span>,
                  record.employee?.jobTitle ?? "-",
                  formatDateLabel(record.attendanceDate),
                  formatAttendanceTime(record.checkInTime),
                  formatAttendanceTime(record.checkOutTime),
                  getWorkedDurationLabel(record),
                  <span className={getStatusClass(record.status)} key={`team-attendance-status-${record.id}`}>
                    {record.status}
                  </span>,
                ])}
                emptyState={{
                  title: "No team attendance records",
                  description: "No attendance entries found for the selected date.",
                }}
              />
            ) : (
              <Table
                compact
                columns={["Employee", "Designation", "Leave type", "Duration", "Status"]}
                rows={teamLeaveRows.map((leave) => [
                  <span className="table-cell-primary" key={`team-leave-name-${leave.id}`}>
                    {`${leave.employee.firstName} ${leave.employee.lastName}`}
                  </span>,
                  leave.employee.jobTitle ?? "-",
                  leave.leaveType.code,
                  `${formatDateLabel(leave.startDate)} to ${formatDateLabel(leave.endDate)} (${formatLeaveDays(leave.totalDays)})`,
                  <span className={`status-pill status-pill--${leave.status.toLowerCase()}`} key={`team-leave-status-${leave.id}`}>
                    {leave.status}
                  </span>,
                ])}
                emptyState={{
                  title: "No team leave records",
                  description: "Team leave requests will appear here.",
                }}
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}
