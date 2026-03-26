import "./LeaveTable.css";
import { getFileUrl } from "../../services/api";
import type { LeaveRequest, Role } from "../../types";
import { formatDateLabel, formatDateTime, formatLeaveDays } from "../../utils/format";

type LeaveTableProps = {
  leaves: LeaveRequest[];
  role: Role;
  currentEmployeeId: number | null;
  teamLeadScopeIds?: number[];
  onReview: (id: number, action: "approve" | "reject") => void | Promise<void>;
  onCancel: (id: number) => void | Promise<void>;
};

export default function LeaveTable({ leaves, role, currentEmployeeId, teamLeadScopeIds = [], onReview, onCancel }: LeaveTableProps) {
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
              <th>Status</th>
              <th>Reason</th>
              <th>Reviewed On</th>
              <th>Attachment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaves.length ? leaves.map((leave) => (
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
                  <span className={getStatusClass(leave.status)}>{leave.status}</span>
                </td>
                <td>{leave.reason}</td>
                <td>
                  {leave.status === "APPROVED"
                    ? leave.approvedAt
                      ? formatDateTime(leave.approvedAt)
                      : "-"
                    : leave.status === "REJECTED"
                      ? leave.rejectionReason || "Rejected"
                      : leave.status === "CANCELLED"
                        ? "Cancelled"
                        : "-"}
                </td>
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
                  <div className="button-row row-actions">
                    {leave.status === "PENDING" &&
                    (role === "HR" ||
                      role === "ADMIN" ||
                      (role === "MANAGER" &&
                        leave.employee.managerId === currentEmployeeId &&
                        leave.employee.id !== currentEmployeeId) ||
                      (role === "EMPLOYEE" &&
                        leave.employee.id !== currentEmployeeId &&
                        teamLeadScopeIds.includes(leave.employee.id))) ? (
                      <>
                        <button onClick={() => onReview(leave.id, "approve")}>Approve</button>
                        <button className="secondary" onClick={() => onReview(leave.id, "reject")}>
                          Reject
                        </button>
                      </>
                    ) : leave.status === "PENDING" && leave.employee.id === currentEmployeeId ? (
                      <button className="secondary" onClick={() => onCancel(leave.id)}>
                        Cancel
                      </button>
                    ) : (
                      "-"
                    )}
                  </div>
                </td>
              </tr>
            )) : (
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
