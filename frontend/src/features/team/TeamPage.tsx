import "./TeamPage.css";
import { useEffect, useMemo, useState } from "react";
import MessageCard from "../../components/common/MessageCard";
import Table from "../../components/common/Table";
import { apiRequest } from "../../services/api";
import type { Attendance, Employee, LeaveRequest, Role } from "../../types";
import { formatAttendanceTime, formatDateLabel } from "../../utils/format";
import LeaveTable from "../leaves/LeaveTable";
import Modal from "../../components/common/Modal";
import toast from "react-hot-toast";

type TeamPageProps = {
  token: string | null;
  role: Role;
  currentEmployeeId: number | null;
  currentEmployee: Employee | null;
};

type TeamTab = "PROJECTS" | "MEMBERS" | "ATTENDANCE" | "LEAVES";
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

export default function TeamPage({ token, role, currentEmployee }: TeamPageProps) {
  const today = toLocalDateString(new Date());
  const [activeTab, setActiveTab] = useState<TeamTab>("PROJECTS");
  const [projectCategory, setProjectCategory] = useState<"MAGAZINES" | "INDUSTRIES">("MAGAZINES");
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<VisibleMonth>(() => getVisibleMonthFromDate(today));
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<{ type: "cancel" | "approve" | "reject"; leaveId: number } | null>(null);
  const [teamAttendanceFilter, setTeamAttendanceFilter] = useState<"" | "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY">("");
  const [rejectionReason, setRejectionReason] = useState("");
  const isTeamLead = Boolean(currentEmployee?.capabilities?.some((capability) => capability.capability === "TEAM_LEAD"));
  const isManager = role === "MANAGER";
  const canAccessTeam = isTeamLead || isManager;
  const teamMembers = useMemo(() => {
    const directReports = currentEmployee?.teamMembers ?? [];
    const scopedReports = currentEmployee?.scopedTeamMembers?.map((item) => item.employee) ?? [];
    
    // Use a Map to filter out duplicates by ID
    const memberMap = new Map();
    [...directReports, ...scopedReports].forEach(member => {
      if (member) memberMap.set(member.id, member);
    });
    
    return Array.from(memberMap.values());
  }, [currentEmployee?.teamMembers, currentEmployee?.scopedTeamMembers]);

  const teamMemberIds = useMemo(() => new Set(teamMembers.map((member) => member.id)), [teamMembers]);
  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const currentMonthLabel = new Date(visibleMonth.year, visibleMonth.month, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  useEffect(() => {
    if (!canAccessTeam || !token) {
      setLoading(false);
      return;
    }

    async function loadTeamData() {
      try {
        setLoading(true);
        const attendancePath = attendanceDate ? `/attendance?date=${attendanceDate}` : "/attendance";
        const [attendanceResponse, leaveResponse] = await Promise.all([
          apiRequest<Attendance[]>(attendancePath, { token }),
          apiRequest<LeaveRequest[]>("/leaves", { token }),
        ]);
        setAttendance(attendanceResponse.data);
        setLeaves(leaveResponse.data);
      } catch (requestError) {
        toast.error(requestError instanceof Error ? requestError.message : "Failed to load team data.");
      } finally {
        setLoading(false);
      }
    }

    void loadTeamData();
  }, [attendanceDate, isTeamLead, token]);

  async function approveLeave(id: number) {
    try {
      await apiRequest(`/leaves/${id}/manager-approve`, {
        method: "PUT",
        token,
      });
      toast.success("Leave request approved.");
      // Reload leaves
      const leaveResponse = await apiRequest<LeaveRequest[]>("/leaves", { token });
      setLeaves(leaveResponse.data);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to approve leave request.");
    }
  }

  async function rejectLeave(id: number, reason: string) {
    if (!reason.trim()) {
      toast.error("Rejection reason is required.");
      return;
    }
    try {
      await apiRequest(`/leaves/${id}/manager-reject`, {
        method: "PUT",
        token,
        body: { rejectionReason: reason },
      });
      toast.success("Leave request rejected.");
      setRejectionReason("");
      // Reload leaves
      const leaveResponse = await apiRequest<LeaveRequest[]>("/leaves", { token });
      setLeaves(leaveResponse.data);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to reject leave request.");
    }
  }

  async function cancelLeave(id: number) {
    try {
      await apiRequest(`/leaves/${id}/cancel`, {
        method: "PUT",
        token,
      });
      toast.success("Leave request cancelled.");
      // Reload leaves
      const leaveResponse = await apiRequest<LeaveRequest[]>("/leaves", { token });
      setLeaves(leaveResponse.data);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to cancel leave request.");
    }
  }

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

  if (!canAccessTeam) {
    return (
      <section className="stack">
        <MessageCard title="Team workspace" tone="error" message="This page is available only for Managers and Team Leads." />
      </section>
    );
  }

  return (
    <section className="stack">
      <div className="team-page-primary-tabs" role="tablist" aria-label="Team workspace sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "PROJECTS"}
          className={`team-page-primary-tab ${activeTab === "PROJECTS" ? "team-page-primary-tab--active" : ""}`.trim()}
          onClick={() => setActiveTab("PROJECTS")}
        >
          Ongoing Projects
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "MEMBERS"}
          className={`team-page-primary-tab ${activeTab === "MEMBERS" ? "team-page-primary-tab--active" : ""}`.trim()}
          onClick={() => setActiveTab("MEMBERS")}
        >
          Team Members
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "ATTENDANCE"}
          className={`team-page-primary-tab ${activeTab === "ATTENDANCE" ? "team-page-primary-tab--active" : ""}`.trim()}
          onClick={() => setActiveTab("ATTENDANCE")}
        >
          Attendance
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "LEAVES"}
          className={`team-page-primary-tab ${activeTab === "LEAVES" ? "team-page-primary-tab--active" : ""}`.trim()}
          onClick={() => setActiveTab("LEAVES")}
        >
          Leaves
        </button>
      </div>

      {activeTab === "PROJECTS" && (
        <div className="stack">
          <div className="team-page-tabs" role="tablist" aria-label="Project categories">
            <button
              type="button"
              role="tab"
              aria-selected={projectCategory === "MAGAZINES"}
              className={`team-page-tab ${projectCategory === "MAGAZINES" ? "team-page-tab--active" : ""}`.trim()}
              onClick={() => setProjectCategory("MAGAZINES")}
            >
              Magazines
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={projectCategory === "INDUSTRIES"}
              className={`team-page-tab ${projectCategory === "INDUSTRIES" ? "team-page-tab--active" : ""}`.trim()}
              onClick={() => setProjectCategory("INDUSTRIES")}
            >
              Industries
            </button>
          </div>

          {projectCategory === "MAGAZINES" ? (
            <div className="card team-page-card">
              <div className="team-page-header">
                <div>
                  <h3>Magazines</h3>
                  <p className="muted">Active editorial and publication projects.</p>
                </div>
                <button type="button" className="secondary team-page-add-btn">
                  <span className="add-icon">+</span>
                  Add Magazine
                </button>
              </div>
              <div className="stack projects-stack">
                {["Forbes", "Fortune", "Financial Times", "Business Today"].map((magazine) => (
                  <article key={magazine} className="project-item-card project-item-card--stacked">
                    <div className="project-icon-wrap">
                      <span className="project-initial">{magazine[0]}</span>
                    </div>
                    <div className="project-info">
                      <strong>{magazine}</strong>
                      <span className="muted text-xs">Editorial Publication</span>
                    </div>
                    <div className="project-actions">
                      <span className="status-pill status-pill--active">Active</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="card team-page-card">
              <div className="team-page-header">
                <div>
                  <h3>Industries</h3>
                  <p className="muted">Key industry focus areas and sectors.</p>
                </div>
                <button type="button" className="secondary team-page-add-btn">
                  <span className="add-icon">+</span>
                  Add Industry
                </button>
              </div>
              <div className="grid cols-5 projects-grid">
                {["Tech", "Fashion", "Finance", "Health", "Real Estate"].map((industry) => (
                  <article key={industry} className="project-item-card">
                    <div className="project-icon-wrap project-icon-wrap--industry">
                      <span className="project-initial">{industry[0]}</span>
                    </div>
                    <div className="project-info">
                      <strong>{industry}</strong>
                      <span className="status-pill status-pill--stable">Monitoring</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "MEMBERS" && (
        <div className="card dense-table-card team-page-card">
          <div className="team-page-header">
            <div>
              <h3>Team members</h3>
              <p className="muted">Manage and view your direct and scoped team members.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table table--dense">
              <thead>
                <tr>
                  <th>Name</th>
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
      )}

      {activeTab === "ATTENDANCE" && (
        <div className="card dense-table-card team-page-card">
          <div className="team-page-header">
            <div>
              <h3>Team attendance</h3>
              <p className="muted">Monitor daily check-ins and attendance statuses for your team.</p>
            </div>
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
                  {datePickerOpen && (
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
                  )}
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
          </div>
          {loading ? (
            <div className="page-loading" style={{ padding: '20px' }}>
              <span className="skeleton-line skeleton-line--title" />
              <span className="skeleton-line skeleton-line--long" />
            </div>
          ) : (
            <Table
              compact
              columns={["Employee", "Designation", "Date", "Check in", "Check out", "Worked", "Status"]}
              rows={teamAttendanceRows.map((record) => [
                <span className="table-cell-primary" key={record.id}>
                  {record.employee ? `${record.employee.firstName} ${record.employee.lastName}` : `Employee #${record.employeeId}`}
                </span>,
                record.employee?.jobTitle ?? "-",
                formatDateLabel(record.attendanceDate),
                formatAttendanceTime(record.checkInTime),
                formatAttendanceTime(record.checkOutTime),
                getWorkedDurationLabel(record),
                <span className={getStatusClass(record.status)} key={`status-${record.id}`}>
                  {record.status}
                </span>,
              ])}
              emptyState={{
                title: "No attendance records",
                description: "No entries found for the selected date.",
              }}
            />
          )}
        </div>
      )}

      {activeTab === "LEAVES" && (
        <div className="card dense-table-card team-page-card">
          <div className="team-page-header">
            <div>
              <h3>Leave requests</h3>
              <p className="muted">Review and manage leave applications from your team.</p>
            </div>
          </div>
          {loading ? (
            <div className="page-loading" style={{ padding: '20px' }}>
              <span className="skeleton-line skeleton-line--title" />
              <span className="skeleton-line skeleton-line--long" />
            </div>
          ) : (
            <LeaveTable
              leaves={teamLeaveRows}
              role={role}
              currentEmployeeId={currentEmployee?.id ?? null}
              onApprove={(id) => {
                if (window.confirm("Approve this leave request?")) {
                  void approveLeave(id);
                }
              }}
              onReject={(id) => setConfirmAction({ type: "reject", leaveId: id })}
              onCancel={(id) => {
                if (window.confirm("Cancel this leave request?")) {
                  void cancelLeave(id);
                }
              }}
            />
          )}
        </div>
      )}

      <Modal
        open={confirmAction !== null}
        title="Reject leave"
        onClose={() => {
          setConfirmAction(null);
          setRejectionReason("");
        }}
      >
        <div className="stack leave-review-modal">
          <p className="muted">
            Please provide a reason for rejecting this leave request. This will be visible to the team member.
          </p>

          <textarea
            className="leave-form__input"
            style={{ minHeight: '100px', width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
            placeholder="e.g. Critical project deadline, overlapping leaves in team..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />

          <div className="button-row" style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setConfirmAction(null);
                setRejectionReason("");
              }}
            >
              Back
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                const action = confirmAction;
                if (!action || action.type !== "reject") return;
                void rejectLeave(action.leaveId, rejectionReason);
                setConfirmAction(null);
              }}
            >
              Reject Request
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
