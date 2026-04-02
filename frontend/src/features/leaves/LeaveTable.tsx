import "./LeaveTable.css";
import { getFileUrl } from "../../services/api";
import type { LeaveRequest, Role } from "../../types";
import { formatDateLabel, formatDateTime, formatLeaveDays } from "../../utils/format";

type LeaveTableProps = {
  leaves: LeaveRequest[];
  role: Role;
  currentEmployeeId: number | null;
  teamLeadScopeIds?: number[];
  onReview: (id: number, action: "approve" | "reject", stage: "manager" | "hr") => void | Promise<void>;
  onCancel: (id: number) => void | Promise<void>;
};

export default function LeaveTable({
  leaves,
  role,
  currentEmployeeId,
  teamLeadScopeIds = [],
  onReview,
  onCancel,
}: LeaveTableProps) {
  function getStatusClass(status: LeaveRequest["status"]) {
    return `status-pill status-pill--${status.toLowerCase()}`;
  }

  function getDurationLabel(leave: LeaveRequest) {
    const sameDay = formatDateLabel(leave.startDate) === formatDateLabel(leave.endDate);

    if (sameDay) {
      return leave.startDayDuration === "HALF_DAY" ? "Half day" : "Full day";
    }

    if (leave.startDayDuration === "HALF_DAY" && leave.endDayDuration === "HALF_DAY") {
      return "Start & end day half";
    }

    if (leave.startDayDuration === "HALF_DAY") {
      return "Start day half";
    }

    if (leave.endDayDuration === "HALF_DAY") {
      return "End day half";
    }

    return "Full days";
  }

  function formatLeaveRange(leave: LeaveRequest) {
    if (leave.startDate === leave.endDate || formatDateLabel(leave.startDate) === formatDateLabel(leave.endDate)) {
      return formatDateLabel(leave.startDate);
    }

    return `${formatDateLabel(leave.startDate)} to ${formatDateLabel(leave.endDate)}`;
  }

  function getStepClass(status: LeaveRequest["managerApprovalStatus"]) {
    return `leave-step leave-step--${status.toLowerCase()}`;
  }

  function getReviewSummary(leave: LeaveRequest) {
    if (leave.status === "APPROVED") {
      return leave.hrApprovedAt ? formatDateTime(leave.hrApprovedAt) : "HR approved";
    }

    if (leave.status === "REJECTED") {
      if (leave.hrApprovalStatus === "REJECTED") {
        return leave.hrRejectionReason || "Rejected by HR";
      }

      if (leave.managerApprovalStatus === "REJECTED") {
        return leave.managerRejectionReason || "Rejected by manager";
      }
    }

    if (leave.status === "CANCELLED") {
      return "Cancelled";
    }

    if (leave.managerApprovalStatus === "APPROVED") {
      return leave.managerApprovedAt ? `Mgr ${formatDateTime(leave.managerApprovedAt)}` : "Awaiting HR";
    }

    return "-";
  }

  function canManagerReview(leave: LeaveRequest) {
    if (leave.status !== "PENDING" || leave.managerApprovalStatus !== "PENDING") {
      return false;
    }

    if (role === "ADMIN") {
      return true;
    }

    return role === "MANAGER" && leave.employee.managerId === currentEmployeeId && leave.employee.id !== currentEmployeeId;
  }

  function canHrReview(leave: LeaveRequest) {
    if (
      leave.status !== "PENDING" ||
      leave.managerApprovalStatus !== "APPROVED" ||
      leave.hrApprovalStatus !== "PENDING"
    ) {
      return false;
    }

    return role === "ADMIN" || role === "HR";
  }

  return (
    <div className="leave-table-surface">
      <div className="table-wrap">
        <table className="table table--dense">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Type</th>
              <th>Dates</th>
              <th>Days</th>
              <th>Breakdown</th>
              <th>Progress</th>
              <th>Reason</th>
              <th>Reviewed On</th>
              <th>Attachment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaves.length ? (
              leaves.map((leave) => (
                <tr key={leave.id}>
                  <td>
                    <div className="table-cell-stack">
                      <span className="table-cell-primary">{`${leave.employee.firstName} ${leave.employee.lastName}`}</span>
                      <span className="table-cell-secondary">{leave.employee.employeeCode}</span>
                    </div>
                  </td>
                  <td>
                    <div className="table-cell-stack">
                      <span className="table-cell-primary">{leave.leaveType.name}</span>
                      <span className="table-cell-secondary">{leave.leaveType.code}</span>
                    </div>
                  </td>
                  <td>{formatLeaveRange(leave)}</td>
                  <td>
                    <div className="table-cell-stack">
                      <span className="table-cell-primary">{formatLeaveDays(leave.totalDays)}</span>
                      <span className="table-cell-secondary">{getDurationLabel(leave)}</span>
                    </div>
                  </td>
                  <td>{`${formatLeaveDays(leave.paidDays)} Paid / ${formatLeaveDays(leave.unpaidDays)} Unpaid`}</td>
                  <td>
                    <div className="leave-progress">
                      <div className={getStepClass(leave.managerApprovalStatus)}>
                        <span className="leave-step__label">Manager</span>
                        <span className="leave-step__value">{leave.managerApprovalStatus}</span>
                      </div>
                      <div className={getStepClass(leave.hrApprovalStatus)}>
                        <span className="leave-step__label">HR</span>
                        <span className="leave-step__value">{leave.hrApprovalStatus}</span>
                      </div>
                    </div>
                  </td>
                  <td>{leave.reason}</td>
                  <td>{getReviewSummary(leave)}</td>
                  <td>
                    {leave.attachmentPath ? (
                      <div className="table-cell-stack">
                        <a className="table-cell-primary" href={getFileUrl(leave.attachmentPath) ?? "#"} target="_blank" rel="noreferrer">
                          View
                        </a>
                        <span className="table-cell-secondary">{leave.attachmentName ?? "Attachment"}</span>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <div className="button-row row-actions leave-table-actions">
                      {canManagerReview(leave) ? (
                        <>
                          <button className="leave-action-button" onClick={() => onReview(leave.id, "approve", "manager")}>Manager approve</button>
                          <button className="secondary leave-action-button" onClick={() => onReview(leave.id, "reject", "manager")}>
                            Reject
                          </button>
                        </>
                      ) : canHrReview(leave) ? (
                        <>
                          <button className="leave-action-button" onClick={() => onReview(leave.id, "approve", "hr")}>HR approve</button>
                          <button className="secondary leave-action-button" onClick={() => onReview(leave.id, "reject", "hr")}>
                            Reject
                          </button>
                        </>
                      ) : leave.status === "PENDING" &&
                        leave.managerApprovalStatus === "PENDING" &&
                        leave.employee.id === currentEmployeeId ? (
                        <button className="secondary leave-action-button" onClick={() => onCancel(leave.id)}>
                          Cancel
                        </button>
                      ) : role === "EMPLOYEE" &&
                        leave.employee.id !== currentEmployeeId &&
                        teamLeadScopeIds.includes(leave.employee.id) ? (
                        <span className="table-cell-secondary">View only</span>
                      ) : (
                        <span className={getStatusClass(leave.status)}>{leave.status}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="leave-table-empty-cell">
                  <div className="leave-table-empty-state">
                    <strong>No leave requests yet.</strong>
                    <span>Use the Apply for leave action to submit the first request.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
