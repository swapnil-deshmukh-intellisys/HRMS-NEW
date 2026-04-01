import "./AttendancePage.css";
import { useCallback, useEffect, useMemo, useState } from "react";
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

export default function AttendancePage({ token, role, currentEmployeeId, currentEmployee }: AttendancePageProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [regularizations, setRegularizations] = useState<AttendanceRegularizationRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesTotal, setEmployeesTotal] = useState(0);
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDate, setFilterDate] = useState(today);
  const [regularizationOpen, setRegularizationOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<AttendanceRegularizationRequest | null>(null);
  const [reviewRejectionReason, setReviewRejectionReason] = useState("");
  const [employeeMonthHistoryOpen, setEmployeeMonthHistoryOpen] = useState(false);
  const [employeeMonthHistoryTarget, setEmployeeMonthHistoryTarget] = useState<Employee | null>(null);
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

    return isToday(record.attendanceDate) ? "In progress" : "Checkout missing";
  }

  function renderWorkedDuration(record: Attendance) {
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
      const path = "/attendance";
      const response = await apiRequest<Attendance[]>(path, { token });
      setAttendance(response.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load attendance history.");
    } finally {
      setLoading(false);
    }
  }, [token]);

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
        const response = await apiRequest<{ items: Employee[]; pagination?: { total: number } }>("/employees", { token });
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
    reloadRegularizations();
  }, [reloadRegularizations]);

  useEffect(() => {
    reloadEmployees();
  }, [reloadEmployees]);

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

  function getStatusClass(status: Attendance["status"]) {
    return `status-pill status-pill--${status.toLowerCase().replace(/_/g, "-")}`;
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
    const recordDate = new Date(record.attendanceDate);

    if (filterEmployeeId && String(record.employee?.id ?? record.employeeId) !== filterEmployeeId) {
      return false;
    }

    if (filterStatus && record.status !== filterStatus) {
      return false;
    }

    if (filterDate) {
      const selectedDate = new Date(filterDate);
      selectedDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);
      if (recordDate < selectedDate || recordDate >= nextDay) {
        return false;
      }
    }

    return true;
  });

  const employeeMonthHistory = useMemo(() => {
    if (!employeeMonthHistoryTarget) {
      return [];
    }

    const referenceDate = filterDate ? new Date(filterDate) : new Date();
    const month = referenceDate.getMonth();
    const year = referenceDate.getFullYear();

    return attendance
      .filter((record) => {
        if ((record.employee?.id ?? record.employeeId) !== employeeMonthHistoryTarget.id) {
          return false;
        }

        const recordDate = new Date(record.attendanceDate);
        return recordDate.getMonth() === month && recordDate.getFullYear() === year;
      })
      .sort((left, right) => new Date(left.attendanceDate).getTime() - new Date(right.attendanceDate).getTime());
  }, [attendance, employeeMonthHistoryTarget, filterDate]);

  const employeeMonthHistoryLabel = useMemo(() => {
    const referenceDate = filterDate ? new Date(filterDate) : new Date();
    return referenceDate.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  }, [filterDate]);

  const attendanceOverview = useMemo(
    () =>
      filteredAttendance.reduce(
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
    [filteredAttendance],
  );

  const totalWorkforceCount = useMemo(() => {
    if (role === "EMPLOYEE") {
      if (isTeamLead) {
        return new Set([currentEmployeeId, ...teamLeadScopeIds].filter((value): value is number => Boolean(value))).size;
      }

      return currentEmployeeId ? 1 : 0;
    }

    if (employeesTotal > 0) {
      return employeesTotal;
    }

    return new Set(attendance.map((record) => record.employee?.id ?? record.employeeId)).size;
  }, [attendance, currentEmployeeId, employeesTotal, isTeamLead, role, teamLeadScopeIds]);

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

  const monthHistoryColumns = ["Date", "Check in", "Check out", "Worked duration", "Status"];

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
              <button className="secondary" onClick={() => setRegularizationOpen(true)}>
                Request correction
              </button>
              {canFinalizeAttendance ? (
                <button className="secondary" onClick={handleFinalizeAttendance}>
                  Finalize selected day
                </button>
              ) : null}
            </div>
          </div>
          <div className="attendance-history-filters">
            <label className="attendance-filter-field">
              Date
              <input
                type="date"
                max={today}
                value={filterDate}
                onChange={(event) => setFilterDate(event.target.value)}
              />
            </label>
            <label className="attendance-filter-field">
              Status
              <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
                <option value="">All statuses</option>
                <option value="PRESENT">Present</option>
                <option value="HALF_DAY">Half day</option>
                <option value="LEAVE">Leave</option>
                <option value="ABSENT">Absent</option>
              </select>
            </label>
            {canManageOthers ? (
              <label className="attendance-filter-field">
                Employee
                <select value={filterEmployeeId} onChange={(event) => setFilterEmployeeId(event.target.value)}>
                  <option value="">All employees</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{`${employee.firstName} ${employee.lastName}`}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <div className="attendance-overview-row">
            <div className="attendance-overview-chip attendance-overview-chip--present">
              <span className="attendance-overview-chip__label">Present</span>
              <strong className="attendance-overview-chip__value">
                {attendanceOverview.present}/{totalWorkforceCount}
              </strong>
            </div>
            <div className="attendance-overview-chip attendance-overview-chip--absent">
              <span className="attendance-overview-chip__label">Absent</span>
              <strong className="attendance-overview-chip__value">{attendanceOverview.absent}</strong>
            </div>
            <div className="attendance-overview-chip attendance-overview-chip--leave">
              <span className="attendance-overview-chip__label">On leave</span>
              <strong className="attendance-overview-chip__value">{attendanceOverview.leave}</strong>
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
            rows={filteredAttendance.map((record) => {
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
                <span key={`status-${record.id}`} className={getStatusClass(record.status)}>
                  {record.status}
                </span>,
              ];

              if (canManageOthers) {
                cells.unshift(
                  <div className="table-cell-stack" key={`employee-${record.id}`}>
                    <button
                      type="button"
                      className="attendance-history-person-trigger table-cell-primary"
                      onClick={() => {
                        if (!record.employee) {
                          return;
                        }

                        setEmployeeMonthHistoryTarget(record.employee);
                        setEmployeeMonthHistoryOpen(true);
                      }}
                    >
                      {record.employee ? `${record.employee.firstName} ${record.employee.lastName}` : "Unknown employee"}
                    </button>
                    <span className="table-cell-secondary">{record.employee?.employeeCode ?? "-"}</span>
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

      <Modal
        open={employeeMonthHistoryOpen}
        title={
          employeeMonthHistoryTarget
            ? `${employeeMonthHistoryTarget.firstName} ${employeeMonthHistoryTarget.lastName} attendance`
            : "Attendance"
        }
        onClose={() => {
          setEmployeeMonthHistoryOpen(false);
          setEmployeeMonthHistoryTarget(null);
        }}
      >
        <div className="stack">
          <p className="muted">
            Showing attendance records for {employeeMonthHistoryLabel}.
          </p>
          <Table
            compact
            columns={monthHistoryColumns}
            rows={employeeMonthHistory.map((record) => [
              <div className="table-cell-stack" key={`month-date-${record.id}`}>
                <span className="table-cell-primary">{formatDateLabel(record.attendanceDate)}</span>
                <span className="table-cell-secondary">{formatWeekday(record.attendanceDate)}</span>
              </div>,
              formatAttendanceTime(record.checkInTime),
              formatAttendanceTime(record.checkOutTime),
              renderWorkedDuration(record),
              <span key={`month-status-${record.id}`} className={getStatusClass(record.status)}>
                {record.status}
              </span>,
            ])}
            emptyState={{
              title: "No attendance records for this month",
              description: "No entries were found for the selected employee in this month.",
            }}
          />
        </div>
      </Modal>
    </section>
  );
}
