import "./AttendancePage.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import MessageCard from "../../components/common/MessageCard";
import Modal from "../../components/common/Modal";
import Table from "../../components/common/Table";
import { ATTENDANCE_EVENT } from "../../components/common/attendanceQuickActionUtils";
import { apiRequest } from "../../services/api";
import type { Attendance, AttendanceRegularizationRequest, Employee, Role } from "../../types";
import { formatAttendanceTime, formatDateLabel, formatDateTime, formatWeekday, isToday } from "../../utils/format";

type AttendancePageProps = {
  token: string | null;
  role: Role;
  currentEmployeeId: number | null;
  currentEmployee: Employee | null;
};

type AttendanceListRow = Omit<Attendance, "status"> & {
  status: Attendance["status"] | "UNMARKED";
};

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

export default function AttendancePage({ token, role, currentEmployeeId, currentEmployee }: AttendancePageProps) {
  const today = toLocalDateString(new Date());
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [regularizations, setRegularizations] = useState<AttendanceRegularizationRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesTotal, setEmployeesTotal] = useState(0);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDate, setFilterDate] = useState(today);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<VisibleMonth>(() => getVisibleMonthFromDate(today));
  const [regularizationOpen, setRegularizationOpen] = useState(false);
  const [finalizeConfirmOpen, setFinalizeConfirmOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<AttendanceRegularizationRequest | null>(null);
  const [reviewRejectionReason, setReviewRejectionReason] = useState("");
  const [regularizationForm, setRegularizationForm] = useState({
    attendanceDate: today,
    proposedCheckInTime: "",
    proposedCheckOutTime: "",
    reason: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [teamLeadScopeIds, setTeamLeadScopeIds] = useState<number[]>([]);
  const isTeamLead = Boolean(currentEmployee?.capabilities?.some((capability) => capability.capability === "TEAM_LEAD"));
  const canManageOthers = role !== "EMPLOYEE" || isTeamLead;
  const canFinalizeAttendance = role === "ADMIN" || role === "HR";
  const activeOverviewFilter = filterStatus === "HALF_DAY" ? "PRESENT" : filterStatus;
  const navigate = useNavigate();
  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const currentMonthLabel = new Date(visibleMonth.year, visibleMonth.month, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  function getWorkedDurationLabel(record: AttendanceListRow) {
    if (record.status === "LEAVE") {
      return "-";
    }

    if (record.status === "ABSENT") {
      return "Absent";
    }

    if (record.status === "UNMARKED") {
      return "Unmarked";
    }

    if (record.checkOutTime) {
      return formatWorkedDuration(record.workedMinutes);
    }

    return isToday(record.attendanceDate) ? "In progress" : "Checkout missing";
  }

  function renderWorkedDuration(record: AttendanceListRow) {
    const label = getWorkedDurationLabel(record);

    if (label === "Checkout missing") {
      return <span className="attendance-warning-text">{label}</span>;
    }

    return label;
  }

  const reloadAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const searchParams = new URLSearchParams();
      if (filterDate) {
        searchParams.set("date", filterDate);
      }
      const path = `/attendance${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      const response = await apiRequest<Attendance[]>(path, { token });
      setAttendance(response.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load attendance history.");
    } finally {
      setLoading(false);
    }
  }, [filterDate, token]);

  const reloadRegularizations = useCallback(async () => {
    try {
      const response = await apiRequest<AttendanceRegularizationRequest[]>("/attendance/regularizations", { token });
      setRegularizations(response.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load attendance correction requests.");
    }
  }, [token]);

  const reloadEmployees = useCallback(async () => {
    if (role !== "EMPLOYEE") {
      try {
        const response = await apiRequest<{ items: Employee[]; pagination?: { total: number } }>("/employees?limit=1000", { token });
        setEmployees(response.data.items);
        setEmployeesTotal(response.data.pagination?.total ?? response.data.items.length);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed to load employees for attendance.");
      }
      return;
    }

    if (!isTeamLead || !currentEmployeeId) {
      setEmployees([]);
      setEmployeesTotal(currentEmployeeId ? 1 : 0);
      setTeamLeadScopeIds([]);
      return;
    }

    try {
      const response = await apiRequest<Employee>(`/employees/${currentEmployeeId}`, { token });
      const scopedEmployees = response.data.scopedTeamMembers?.map((item) => item.employee) ?? [];
      setEmployees(scopedEmployees);
      setEmployeesTotal(new Set([currentEmployeeId, ...scopedEmployees.map((employee) => employee.id)]).size);
      setTeamLeadScopeIds(scopedEmployees.map((employee) => employee.id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load scoped team members.");
    }
  }, [currentEmployeeId, isTeamLead, role, token]);

  useEffect(() => {
    reloadAttendance();
  }, [reloadAttendance]);

  useEffect(() => {
    const handleAttendanceUpdated = () => {
      void reloadAttendance();
    };

    window.addEventListener(ATTENDANCE_EVENT, handleAttendanceUpdated);
    return () => window.removeEventListener(ATTENDANCE_EVENT, handleAttendanceUpdated);
  }, [reloadAttendance]);

  useEffect(() => {
    if (filterDate !== today) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void reloadAttendance();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [filterDate, reloadAttendance, today]);

  useEffect(() => {
    reloadRegularizations();
  }, [reloadRegularizations]);

  useEffect(() => {
    reloadEmployees();
  }, [reloadEmployees]);

  useEffect(() => {
    setVisibleMonth(getVisibleMonthFromDate(filterDate || today));
  }, [filterDate, today]);

  async function handleFinalizeAttendance() {
    try {
      setError("");
      const response = await apiRequest<{ attendanceDate: string; createdCount: number }>("/attendance/finalize", {
        method: "POST",
        token,
        body: {
          date: filterDate || undefined,
        },
      });

      const createdCount = response.data.createdCount;
      setMessage(
        createdCount > 0
          ? `Attendance finalized. ${createdCount} employee${createdCount === 1 ? "" : "s"} marked absent.`
          : "Attendance finalized. No new absent records were needed.",
      );
      await reloadAttendance();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to finalize attendance.");
    }
  }

  async function handleRegularizationSubmit() {
    try {
      setError("");
      const response = await apiRequest<AttendanceRegularizationRequest>("/attendance/regularizations", {
        method: "POST",
        token,
        body: {
          attendanceDate: regularizationForm.attendanceDate,
          proposedCheckInTime: regularizationForm.proposedCheckInTime || undefined,
          proposedCheckOutTime: regularizationForm.proposedCheckOutTime || undefined,
          reason: regularizationForm.reason,
        },
      });
      setMessage(response.message);
      setRegularizationOpen(false);
      setRegularizationForm({
        attendanceDate: today,
        proposedCheckInTime: "",
        proposedCheckOutTime: "",
        reason: "",
      });
      await reloadRegularizations();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to submit attendance correction request.");
    }
  }

  async function handleReviewRequest(status: "APPROVED" | "REJECTED", requestId: number, rejectionReason?: string) {
    try {
      setError("");
      const response = await apiRequest<AttendanceRegularizationRequest>(`/attendance/regularizations/${requestId}/review`, {
        method: "POST",
        token,
        body: {
          status,
          rejectionReason,
        },
      });
      setMessage(response.message);
      setReviewModalOpen(false);
      setReviewTarget(null);
      setReviewRejectionReason("");
      await Promise.all([reloadRegularizations(), reloadAttendance()]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to review attendance correction request.");
    }
  }

  async function handleCancelRegularization(requestId: number) {
    try {
      setError("");
      const response = await apiRequest<AttendanceRegularizationRequest>(`/attendance/regularizations/${requestId}/cancel`, {
        method: "POST",
        token,
      });
      setMessage(response.message);
      await reloadRegularizations();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to cancel attendance correction request.");
    }
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

  function getStatusClass(status: AttendanceListRow["status"]) {
    return `status-pill status-pill--${status.toLowerCase().replace(/_/g, "-")}`;
  }

  function getStatusLabel(record: AttendanceListRow) {
    const baseLabel = record.status === "HALF_DAY" ? "Half day" : record.status === "UNMARKED" ? "Unmarked" : record.status.charAt(0) + record.status.slice(1).toLowerCase();

    if (record.leaveTypeCode && (record.status === "LEAVE" || record.status === "HALF_DAY")) {
      return `${baseLabel} (${record.leaveTypeCode})`;
    }

    return baseLabel;
  }

  function getRegularizationStatusClass(status: AttendanceRegularizationRequest["status"]) {
    return `status-pill status-pill--${status.toLowerCase().replace(/_/g, "-")}`;
  }

  function canReviewRequest(record: AttendanceRegularizationRequest) {
    if (role === "ADMIN" || role === "HR") {
      return true;
    }

    if (role === "MANAGER") {
      return Boolean(currentEmployeeId) && record.employee.managerId === currentEmployeeId && record.employeeId !== currentEmployeeId;
    }

    return role === "EMPLOYEE" && isTeamLead && record.employeeId !== currentEmployeeId && teamLeadScopeIds.includes(record.employeeId);
  }

  const filteredAttendance = attendance.filter((record) => {
    if (filterStatus) {
      if (filterStatus === "PRESENT") {
        if (record.status !== "PRESENT" && record.status !== "HALF_DAY") {
          return false;
        }
      } else if (record.status !== filterStatus) {
        return false;
      }
    }

    return true;
  });

  const workforceEmployees = useMemo(() => {
    if (role === "EMPLOYEE") {
      if (isTeamLead) {
        const scopedEmployees = employees.filter((employee) => employee.id !== currentEmployeeId);
        return currentEmployee ? [currentEmployee, ...scopedEmployees] : scopedEmployees;
      }

      return currentEmployee ? [currentEmployee] : [];
    }

    return employees;
  }, [currentEmployee, currentEmployeeId, employees, isTeamLead, role]);

  const attendanceOverviewSource = useMemo(() => attendance, [attendance]);

  const attendanceOverview = useMemo(
    () =>
      attendanceOverviewSource.reduce(
        (summary, record) => {
          if (record.status === "PRESENT" || record.status === "HALF_DAY") {
            summary.present += 1;
          } else if (record.status === "ABSENT") {
            summary.absent += 1;
          } else if (record.status === "LEAVE") {
            summary.leave += 1;
          }

          return summary;
        },
        { present: 0, absent: 0, leave: 0 },
      ),
    [attendanceOverviewSource],
  );

  const totalWorkforceCount = useMemo(() => {
    if (employeesTotal > 0) {
      return employeesTotal;
    }

    return workforceEmployees.length;
  }, [employeesTotal, workforceEmployees.length]);

  const markedEmployeeIds = useMemo(
    () => new Set(attendanceOverviewSource.map((record) => record.employee?.id ?? record.employeeId)),
    [attendanceOverviewSource],
  );

  const unmarkedRows = useMemo<AttendanceListRow[]>(() => {
    if (!filterDate) {
      return [];
    }

    return workforceEmployees
      .filter((employee) => !markedEmployeeIds.has(employee.id))
      .map((employee) => ({
        id: -employee.id,
        employeeId: employee.id,
        attendanceDate: parseLocalDateString(filterDate).toISOString(),
        checkInTime: null,
        checkOutTime: null,
        workedMinutes: 0,
        status: "UNMARKED",
        employee,
      }));
  }, [filterDate, markedEmployeeIds, workforceEmployees]);

  const attendanceRows = useMemo<AttendanceListRow[]>(() => {
    if (filterStatus === "UNMARKED") {
      return unmarkedRows;
    }

    return filteredAttendance;
  }, [filterStatus, filteredAttendance, unmarkedRows]);

  const unmarkedCount = useMemo(() => {
    if (employeesTotal > 0) {
      return Math.max(0, employeesTotal - markedEmployeeIds.size);
    }

    return unmarkedRows.length;
  }, [employeesTotal, markedEmployeeIds.size, unmarkedRows.length]);

  const columns = [
    ...(canManageOthers ? ["Employee"] : []),
    "Date",
    "Check in",
    "Check out",
    "Worked duration",
    "Status",
  ];

  const regularizationColumns = [
    ...(canManageOthers ? ["Employee"] : []),
    "Date",
    "Proposed times",
    "Reason",
    "Status",
    "Reviewed On",
    "Actions",
  ];

  return (
    <section className="stack">
      {error ? <MessageCard title="Attendance issue" tone="error" message={error} /> : null}
      {message ? <p className="success-text">{message}</p> : null}
      <div className="card dense-table-card attendance-table-card">
        <div className="stack">
          <div className="attendance-history-header">
            <div>
              <h3>Attendance history</h3>
              <p className="muted">Track attendance entries, mark today, and manage correction requests from one workspace.</p>
            </div>
            <div className="button-row row-actions">
              <button className="secondary attendance-header-action" onClick={() => setRegularizationOpen(true)}>
                Request correction
              </button>
              {canFinalizeAttendance ? (
                <button className="secondary attendance-header-action" onClick={() => setFinalizeConfirmOpen(true)}>
                  Finalize selected day
                </button>
              ) : null}
            </div>
          </div>
          <div className="attendance-toolbar">
            <div className="attendance-history-filters">
              <label className="attendance-filter-field attendance-filter-field--date">
                Date
                <div className="attendance-date-picker">
                  <button
                    type="button"
                    className="attendance-date-input attendance-date-trigger"
                    onClick={() => setDatePickerOpen((current) => !current)}
                  >
                    <span>{formatDateLabel(filterDate)}</span>
                  </button>
                  {datePickerOpen ? (
                    <div className="attendance-date-popover">
                      <div className="attendance-date-popover__header">
                        <button
                          type="button"
                          className="secondary attendance-date-popover__nav"
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
                          className="secondary attendance-date-popover__nav"
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
                      <div className="attendance-date-popover__weekdays">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
                          <span key={label}>{label}</span>
                        ))}
                      </div>
                      <div className="attendance-date-popover__grid">
                        {calendarDays.map((day) => {
                          const isoDate = toLocalDateString(day.value);
                          const isSelected = isoDate === filterDate;
                          const isFuture = isoDate > today;

                          return (
                            <button
                              key={day.key}
                              type="button"
                              className={`attendance-date-popover__day ${!day.inCurrentMonth ? "attendance-date-popover__day--muted" : ""} ${isSelected ? "attendance-date-popover__day--selected" : ""}`.trim()}
                              disabled={isFuture}
                              onClick={() => {
                                setFilterDate(isoDate);
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
              <label className="attendance-filter-field attendance-filter-field--status">
                Status
                <select className="attendance-status-select" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
                  <option value="">All statuses</option>
                  <option value="PRESENT">Present</option>
                  <option value="HALF_DAY">Half day</option>
                  <option value="LEAVE">Leave</option>
                  <option value="ABSENT">Absent</option>
                  <option value="UNMARKED">Unmarked</option>
                </select>
              </label>
            </div>
            <div className="attendance-overview-row">
              <button
                type="button"
                className={`attendance-overview-chip attendance-overview-chip--present ${activeOverviewFilter === "PRESENT" ? "attendance-overview-chip--active" : ""}`.trim()}
                onClick={() => setFilterStatus((current) => (current === "PRESENT" || current === "HALF_DAY" ? "" : "PRESENT"))}
              >
                <span className="attendance-overview-chip__label">Present</span>
                <strong className="attendance-overview-chip__value">
                  {attendanceOverview.present}/{totalWorkforceCount}
                </strong>
              </button>
              <button
                type="button"
                className={`attendance-overview-chip attendance-overview-chip--absent ${activeOverviewFilter === "ABSENT" ? "attendance-overview-chip--active" : ""}`.trim()}
                onClick={() => setFilterStatus((current) => (current === "ABSENT" ? "" : "ABSENT"))}
              >
                <span className="attendance-overview-chip__label">Absent</span>
                <strong className="attendance-overview-chip__value">{attendanceOverview.absent}</strong>
              </button>
              <button
                type="button"
                className={`attendance-overview-chip attendance-overview-chip--leave ${activeOverviewFilter === "LEAVE" ? "attendance-overview-chip--active" : ""}`.trim()}
                onClick={() => setFilterStatus((current) => (current === "LEAVE" ? "" : "LEAVE"))}
              >
                <span className="attendance-overview-chip__label">On leave</span>
                <strong className="attendance-overview-chip__value">{attendanceOverview.leave}</strong>
              </button>
              <button
                type="button"
                className={`attendance-overview-chip attendance-overview-chip--unmarked ${activeOverviewFilter === "UNMARKED" ? "attendance-overview-chip--active" : ""}`.trim()}
                onClick={() => setFilterStatus((current) => (current === "UNMARKED" ? "" : "UNMARKED"))}
              >
                <span className="attendance-overview-chip__label">Unmarked</span>
                <strong className="attendance-overview-chip__value">{unmarkedCount}</strong>
              </button>
            </div>
          </div>
        </div>
        {loading ? (
          <div className="page-loading">
            <span className="skeleton-line skeleton-line--title" />
            <span className="skeleton-line skeleton-line--long" />
            <span className="skeleton-line skeleton-line--long" />
            <span className="skeleton-line skeleton-line--long" />
          </div>
        ) : (
          <Table
            compact
            columns={columns}
            rows={attendanceRows.map((record) => {
              const cells = [
                <div className="table-cell-stack" key={`date-${record.id}`}>
                  <span className="table-cell-primary">{isToday(record.attendanceDate) ? "Today" : formatDateLabel(record.attendanceDate)}</span>
                  <span className="table-cell-secondary">
                    {isToday(record.attendanceDate) ? formatDateLabel(record.attendanceDate) : formatWeekday(record.attendanceDate)}
                  </span>
                </div>,
                formatAttendanceTime(record.checkInTime),
                formatAttendanceTime(record.checkOutTime),
                renderWorkedDuration(record),
                <div className="table-cell-stack" key={`status-${record.id}`}>
                  <span className={getStatusClass(record.status)}>{getStatusLabel(record)}</span>
                </div>,
              ];

              if (canManageOthers) {
                cells.unshift(
                  <div className="table-cell-stack attendance-person-cell" key={`employee-${record.id}`}>
                    <button
                      type="button"
                      className="attendance-history-person-trigger attendance-history-person-trigger--name"
                      onClick={() => {
                        if (!record.employee) {
                          return;
                        }
                        navigate(`/employees/${record.employee.id}?tab=attendance`);
                      }}
                    >
                      {record.employee ? `${record.employee.firstName} ${record.employee.lastName}` : "Unknown employee"}
                    </button>
                    <span className="table-cell-secondary attendance-person-cell__code">{record.employee?.employeeCode ?? "-"}</span>
                  </div>,
                );
              }

              return cells;
            })}
          />
        )}
      </div>
      <div className="card dense-table-card attendance-table-card">
        <div className="attendance-history-header">
          <div>
            <h3>Correction requests</h3>
            <p className="muted">Review submitted corrections and keep attendance records accurate.</p>
          </div>
        </div>
        <Table
          compact
          columns={regularizationColumns}
          rows={regularizations.map((record) => {
            const cells = [
              <div className="table-cell-stack" key={`regularization-date-${record.id}`}>
                <span className="table-cell-primary">{formatDateLabel(record.attendanceDate)}</span>
                <span className="table-cell-secondary">{formatWeekday(record.attendanceDate)}</span>
              </div>,
              <div className="table-cell-stack" key={`regularization-times-${record.id}`}>
                <span className="table-cell-primary">
                  {formatAttendanceTime(record.proposedCheckInTime)} to {formatAttendanceTime(record.proposedCheckOutTime)}
                </span>
                <span className="table-cell-secondary">
                  {record.proposedCheckInTime && record.proposedCheckOutTime
                    ? "Full correction"
                    : record.proposedCheckInTime
                      ? "Check-in only"
                      : "Check-out only"}
                </span>
              </div>,
              record.reason,
              <span key={`regularization-status-${record.id}`} className={getRegularizationStatusClass(record.status)}>
                {record.status}
              </span>,
              <div className="table-cell-stack" key={`regularization-reviewed-${record.id}`}>
                <span className="table-cell-primary">{formatDateTime(record.reviewedAt)}</span>
                <span className="table-cell-secondary">
                  {record.rejectionReason ? `Reason: ${record.rejectionReason}` : record.reviewedBy ? `${record.reviewedBy.firstName} ${record.reviewedBy.lastName}` : "-"}
                </span>
              </div>,
              <div key={`regularization-actions-${record.id}`} className="table-action-group">
                {record.status === "PENDING" && canReviewRequest(record) ? (
                  <>
                    <button className="secondary" onClick={() => handleReviewRequest("APPROVED", record.id)}>
                      Approve
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        setReviewTarget(record);
                        setReviewRejectionReason("");
                        setReviewModalOpen(true);
                      }}
                    >
                      Reject
                    </button>
                  </>
                ) : null}
                {record.status === "PENDING" && currentEmployeeId === record.employeeId ? (
                  <button className="secondary" onClick={() => handleCancelRegularization(record.id)}>
                    Cancel
                  </button>
                ) : null}
                {record.status !== "PENDING" || (!canReviewRequest(record) && currentEmployeeId !== record.employeeId) ? <span>-</span> : null}
              </div>,
            ];

            if (canManageOthers) {
              cells.unshift(
                <div className="table-cell-stack" key={`regularization-employee-${record.id}`}>
                  <span className="table-cell-primary">{`${record.employee.firstName} ${record.employee.lastName}`}</span>
                  <span className="table-cell-secondary">{record.employee.employeeCode}</span>
                </div>,
              );
            }

            return cells;
          })}
          emptyState={{
            title: "No correction requests yet",
            description: "Submitted attendance correction requests will appear here for tracking and review.",
          }}
        />
      </div>

      <Modal open={regularizationOpen} title="Request attendance correction" onClose={() => setRegularizationOpen(false)}>
        <div className="stack regularization-form">
          <label>
            Date
            <input
              type="date"
              max={today}
              value={regularizationForm.attendanceDate}
              onChange={(event) => setRegularizationForm((current) => ({ ...current, attendanceDate: event.target.value }))}
            />
          </label>
          <div className="regularization-time-grid">
            <label>
              Proposed check in
              <input
                type="time"
                value={regularizationForm.proposedCheckInTime}
                onChange={(event) => setRegularizationForm((current) => ({ ...current, proposedCheckInTime: event.target.value }))}
              />
            </label>
            <label>
              Proposed check out
              <input
                type="time"
                value={regularizationForm.proposedCheckOutTime}
                onChange={(event) => setRegularizationForm((current) => ({ ...current, proposedCheckOutTime: event.target.value }))}
              />
            </label>
          </div>
          <label>
            Reason
            <textarea
              rows={4}
              value={regularizationForm.reason}
              onChange={(event) => setRegularizationForm((current) => ({ ...current, reason: event.target.value }))}
              placeholder="Why should this attendance entry be corrected?"
            />
          </label>
          <div className="button-row">
            <button onClick={handleRegularizationSubmit}>Submit request</button>
            <button className="secondary" onClick={() => setRegularizationOpen(false)}>
              Close
            </button>
          </div>
        </div>
      </Modal>
      <Modal open={finalizeConfirmOpen} title="Finalize attendance" onClose={() => setFinalizeConfirmOpen(false)}>
        <div className="stack regularization-form">
          <p className="muted">
            Finalizing this date will mark all unrecorded working-day employees absent for the selected day.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="secondary"
              onClick={() => setFinalizeConfirmOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setFinalizeConfirmOpen(false);
                void handleFinalizeAttendance();
              }}
            >
              Finalize selected day
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={reviewModalOpen} title="Reject correction request" onClose={() => setReviewModalOpen(false)}>
        <div className="stack regularization-form">
          <p className="muted">Add a clear reason so the employee understands why the correction was rejected.</p>
          <label>
            Rejection reason
            <textarea
              rows={4}
              value={reviewRejectionReason}
              onChange={(event) => setReviewRejectionReason(event.target.value)}
              placeholder="Explain why this request is being rejected"
            />
          </label>
          <div className="button-row">
            <button
              onClick={() => {
                if (reviewTarget) {
                  void handleReviewRequest("REJECTED", reviewTarget.id, reviewRejectionReason);
                }
              }}
            >
              Reject request
            </button>
            <button className="secondary" onClick={() => setReviewModalOpen(false)}>
              Close
            </button>
          </div>
        </div>
      </Modal>

    </section>
  );
}
