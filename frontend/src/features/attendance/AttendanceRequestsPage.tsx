import "./AttendancePage.css";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";
import type { AttendanceRegularizationRequest, Role, Employee } from "../../types";
import { formatAttendanceTime, formatDateLabel, formatDateTime, formatWeekday } from "../../utils/format";
import Table from "../../components/common/Table";
import Modal from "../../components/common/Modal";
import toast from "react-hot-toast";
import { ArrowLeft, Calendar, Clock } from "lucide-react";

type AttendanceRequestsPageProps = {
  token: string | null;
  role: Role;
  currentEmployeeId: number | null;
  currentEmployee?: Employee | null;
};

function toLocalDateString(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function convertTo24Hour(time12: string, ampm: string): string {
  if (!time12 || !time12.trim() || time12.includes("-")) return "";
  
  const parts = time12.split(":");
  let hours = parseInt(parts[0], 10);
  let minutes = 0;
  
  if (parts[1]) {
    minutes = parseInt(parts[1], 10);
  }
  
  if (isNaN(hours)) return "";
  if (isNaN(minutes)) minutes = 0;
  
  if (ampm === "PM" && hours < 12) {
    hours += 12;
  } else if (ampm === "AM" && hours === 12) {
    hours = 0;
  }
  
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatTimeInput(value: string, prevValue: string): string {
  if (!value) {
    return "--:--";
  }

  if (!prevValue || prevValue.length !== 5 || prevValue[2] !== ":") {
    prevValue = "--:--";
  }

  // Deletion logic
  if (value.length < prevValue.length) {
    const nDeleted = prevValue.length - value.length;
    let start = 0;
    while (start < value.length && value[start] === prevValue[start]) {
      start++;
    }

    const chars = prevValue.split("");
    for (let i = 0; i < nDeleted; i++) {
      let delIdx = start + i;
      if (delIdx === 2) {
        delIdx = 1;
      }
      if (delIdx >= 0 && delIdx < 5) {
        chars[delIdx] = "-";
      }
    }
    chars[2] = ":";
    return chars.join("");
  }

  // Addition logic
  if (value.length > prevValue.length) {
    let start = 0;
    while (start < prevValue.length && value[start] === prevValue[start]) {
      start++;
    }

    const insertedChar = value[start];
    if (!/^\d$/.test(insertedChar)) {
      return prevValue;
    }

    const chars = prevValue.split("");
    let targetIdx = start;
    if (targetIdx === 2) {
      targetIdx = 3;
    }

    if (targetIdx >= 0 && targetIdx < 5) {
      chars[targetIdx] = insertedChar;
    }
    chars[2] = ":";
    return chars.join("");
  }

  // Same length but character changes
  const chars = prevValue.split("");
  for (let i = 0; i < 5; i++) {
    if (i === 2) continue;
    if (value[i] !== prevValue[i]) {
      if (/^\d$/.test(value[i])) {
        chars[i] = value[i];
      } else if (value[i] === "-") {
        chars[i] = "-";
      }
    }
  }
  chars[2] = ":";
  return chars.join("");
}

export default function AttendanceRequestsPage({ token, role, currentEmployeeId, currentEmployee }: AttendanceRequestsPageProps) {
  const navigate = useNavigate();
  const today = toLocalDateString(new Date());
  const joiningDateFormatted = currentEmployee?.joiningDate 
    ? toLocalDateString(new Date(currentEmployee.joiningDate)) 
    : undefined;
  const [regularizations, setRegularizations] = useState<AttendanceRegularizationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<AttendanceRegularizationRequest | null>(null);
  const [reviewRejectionReason, setReviewRejectionReason] = useState("");

  const [regularizationOpen, setRegularizationOpen] = useState(false);
  const [regularizationForm, setRegularizationForm] = useState({
    attendanceDate: today,
    proposedCheckInTime: "",
    proposedCheckOutTime: "",
    reason: "",
  });
  const [checkInTime, setCheckInTime] = useState("--:--");
  const [checkInAmPm, setCheckInAmPm] = useState("AM");
  const [checkOutTime, setCheckOutTime] = useState("--:--");
  const [checkOutAmPm, setCheckOutAmPm] = useState("PM");

  const reloadRegularizations = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const response = await apiRequest<AttendanceRegularizationRequest[]>("/attendance/regularizations", { token });
      setRegularizations(response.data);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to load attendance correction requests.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    reloadRegularizations();
  }, [reloadRegularizations]);

  async function handleReviewRequest(status: "APPROVED" | "REJECTED", requestId: number, rejectionReason?: string) {
    if (status === "APPROVED") {
      if (!window.confirm("Are you sure you want to approve this attendance correction request?")) {
        return;
      }
    }

    try {
      const response = await apiRequest<AttendanceRegularizationRequest>(`/attendance/regularizations/${requestId}/review`, {
        method: "POST",
        token,
        body: { status, rejectionReason },
      });
      toast.success(response.message);
      setReviewModalOpen(false);
      setReviewTarget(null);
      setReviewRejectionReason("");
      await reloadRegularizations();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to review attendance correction request.");
    }
  }

  async function handleRegularizationSubmit() {
    const checkIn24 = convertTo24Hour(checkInTime, checkInAmPm);
    const checkOut24 = convertTo24Hour(checkOutTime, checkOutAmPm);

    try {
      const response = await apiRequest<AttendanceRegularizationRequest>("/attendance/regularizations", {
        method: "POST",
        token,
        body: {
          attendanceDate: regularizationForm.attendanceDate,
          proposedCheckInTime: checkIn24 || undefined,
          proposedCheckOutTime: checkOut24 || undefined,
          reason: regularizationForm.reason,
        },
      });
      toast.success(response.message);
      setRegularizationOpen(false);
      setRegularizationForm({
        attendanceDate: today,
        proposedCheckInTime: "",
        proposedCheckOutTime: "",
        reason: "",
      });
      setCheckInTime("--:--");
      setCheckOutTime("--:--");
      setCheckInAmPm("AM");
      setCheckOutAmPm("PM");
      await reloadRegularizations();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to submit attendance correction request.");
    }
  }

  async function handleCancelRegularization(requestId: number) {
    if (!window.confirm("Are you sure you want to cancel this attendance correction request?")) {
      return;
    }

    try {
      const response = await apiRequest<AttendanceRegularizationRequest>(`/attendance/regularizations/${requestId}/cancel`, {
        method: "POST",
        token,
      });
      toast.success(response.message);
      await reloadRegularizations();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to cancel attendance correction request.");
    }
  }

  function getRegularizationStatusClass(status: AttendanceRegularizationRequest["status"]) {
    return `status-pill status-pill--${status.toLowerCase().replace(/_/, "-")}`;
  }

  function canReviewRequest(record: AttendanceRegularizationRequest) {
    if (role === "ADMIN" || role === "HR") return true;
    if (role === "MANAGER") {
      return Boolean(currentEmployeeId) && record.employee.managerId === currentEmployeeId && record.employeeId !== currentEmployeeId;
    }
    return false;
  }

  const columns = [
    ...(role !== "EMPLOYEE" ? ["Employee"] : []),
    "Date",
    "Proposed times",
    "Reason",
    "Status",
    "Reviewed On",
    "Actions",
  ];

  const visibleRegularizations = useMemo(() => {
    if (role === "EMPLOYEE") {
      return regularizations.filter((record) => record.employeeId === currentEmployeeId);
    }
    return regularizations;
  }, [currentEmployeeId, regularizations, role]);

  return (
    <section className="stack">
      <div className="action-row" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button 
          onClick={() => navigate("/attendance")} 
          className="attendance-header-action secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content' }}
        >
          <ArrowLeft size={18} />
          Back to Attendance
        </button>
      </div>

      <div className="card dense-table-card attendance-table-card">
        <div className="attendance-history-header">
          <div>
            <p className="eyebrow">Attendance Management</p>
            <h3>Correction Requests</h3>
          </div>
          {(role === "ADMIN" || role === "HR" || role === "MANAGER") && (
            <button className="secondary attendance-header-action" onClick={() => setRegularizationOpen(true)}>
              Correct self attendance
            </button>
          )}
        </div>

        {loading ? (
          <div className="page-loading">
            <span className="skeleton-line skeleton-line--title" />
            <span className="skeleton-line skeleton-line--long" />
          </div>
        ) : (
          <Table
            compact
            columns={columns}
            rows={visibleRegularizations.map((record) => {
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
                record.reviewedAt ? (
                  <div className="table-cell-stack" key={`regularization-reviewed-${record.id}`}>
                    <span className="table-cell-primary">{formatDateTime(record.reviewedAt)}</span>
                    <span className="table-cell-secondary">
                      {record.rejectionReason ? `Reason: ${record.rejectionReason}` : record.reviewedBy ? `${record.reviewedBy.firstName} ${record.reviewedBy.lastName}` : "-"}
                    </span>
                  </div>
                ) : "-",
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
                  {record.status === "PENDING" && currentEmployeeId === record.employeeId && (
                    <button className="secondary" onClick={() => handleCancelRegularization(record.id)}>
                      Cancel
                    </button>
                  )}
                  {record.status !== "PENDING" || (!canReviewRequest(record) && currentEmployeeId !== record.employeeId) ? <span>-</span> : null}
                </div>,
              ];

              if (role !== "EMPLOYEE") {
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
              title: "No correction requests",
              description: "There are currently no attendance correction requests to display.",
            }}
          />
        )}
      </div>

      <Modal open={regularizationOpen} title="Request attendance correction" onClose={() => setRegularizationOpen(false)}>
        <div className="stack regularization-form">
          <label>
            Date
            <div className="time-input-container">
              <Calendar size={16} className="time-input-icon" />
              <input
                type="date"
                className="regularization-time-input"
                min={joiningDateFormatted}
                max={today}
                value={regularizationForm.attendanceDate}
                onChange={(event) => setRegularizationForm((current) => ({ ...current, attendanceDate: event.target.value }))}
              />
            </div>
          </label>
          <div className="regularization-time-grid">
            <label>
              Proposed check in
              <div className="time-input-container">
                <Clock size={16} className="time-input-icon" />
                <input
                  type="text"
                  className="regularization-time-input"
                  placeholder="e.g. 09:00"
                  value={checkInTime}
                  onChange={(event) => {
                    const input = event.target;
                    const oldVal = checkInTime;
                    const newVal = formatTimeInput(input.value, oldVal);
                    
                    let newCursorPos = input.selectionStart || 0;
                    if (input.value.length > oldVal.length) {
                      let start = 0;
                      while (start < oldVal.length && input.value[start] === oldVal[start]) {
                        start++;
                      }
                      newCursorPos = start + 1;
                      if (newCursorPos === 2) {
                        newCursorPos = 3;
                      }
                    } else if (input.value.length < oldVal.length) {
                      let start = 0;
                      while (start < input.value.length && input.value[start] === oldVal[start]) {
                        start++;
                      }
                      const nDeleted = oldVal.length - input.value.length;
                      if (nDeleted === 1 && start === 2) {
                        newCursorPos = 1;
                      } else {
                        newCursorPos = start;
                      }
                    }
                    
                    setCheckInTime(newVal);
                    requestAnimationFrame(() => {
                      try {
                        input.setSelectionRange(newCursorPos, newCursorPos);
                      } catch (e) {}
                    });
                  }}
                />
                <select
                  value={checkInAmPm}
                  onChange={(event) => setCheckInAmPm(event.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--color-text-strong)',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer',
                    outline: 'none',
                    padding: '0 8px 0 0',
                    width: 'auto',
                    minHeight: 'auto',
                    backgroundImage: 'none',
                    appearance: 'auto'
                  }}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </label>
            <label>
              Proposed check out
              <div className="time-input-container">
                <Clock size={16} className="time-input-icon" />
                <input
                  type="text"
                  className="regularization-time-input"
                  placeholder="e.g. 06:00"
                  value={checkOutTime}
                  onChange={(event) => {
                    const input = event.target;
                    const oldVal = checkOutTime;
                    const newVal = formatTimeInput(input.value, oldVal);
                    
                    let newCursorPos = input.selectionStart || 0;
                    if (input.value.length > oldVal.length) {
                      let start = 0;
                      while (start < oldVal.length && input.value[start] === oldVal[start]) {
                        start++;
                      }
                      newCursorPos = start + 1;
                      if (newCursorPos === 2) {
                        newCursorPos = 3;
                      }
                    } else if (input.value.length < oldVal.length) {
                      let start = 0;
                      while (start < input.value.length && input.value[start] === oldVal[start]) {
                        start++;
                      }
                      const nDeleted = oldVal.length - input.value.length;
                      if (nDeleted === 1 && start === 2) {
                        newCursorPos = 1;
                      } else {
                        newCursorPos = start;
                      }
                    }
                    
                    setCheckOutTime(newVal);
                    requestAnimationFrame(() => {
                      try {
                        input.setSelectionRange(newCursorPos, newCursorPos);
                      } catch (e) {}
                    });
                  }}
                />
                <select
                  value={checkOutAmPm}
                  onChange={(event) => setCheckOutAmPm(event.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--color-text-strong)',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer',
                    outline: 'none',
                    padding: '0 8px 0 0',
                    width: 'auto',
                    minHeight: 'auto',
                    backgroundImage: 'none',
                    appearance: 'auto'
                  }}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
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
          <p className="muted">Explain why this correction request is being rejected.</p>
          <label>
            Rejection reason
            <textarea
              rows={4}
              value={reviewRejectionReason}
              onChange={(event) => setReviewRejectionReason(event.target.value)}
              placeholder="Enter reason..."
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
