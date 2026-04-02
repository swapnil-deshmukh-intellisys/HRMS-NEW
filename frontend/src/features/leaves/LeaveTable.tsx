import "./LeaveTable.css";
import { Fragment, useState } from "react";
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
  const [expandedLeaveIds, setExpandedLeaveIds] = useState<number[]>([]);

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
      if (leave.managerApprovedAt && leave.hrApprovedAt) {
        return `Mgr ${formatDateTime(leave.managerApprovedAt)} / HR ${formatDateTime(leave.hrApprovedAt)}`;
      }

      return leave.hrApprovedAt ? formatDateTime(leave.hrApprovedAt) : leave.managerApprovedAt ? formatDateTime(leave.managerApprovedAt) : "Approved";
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

    if (leave.managerApprovalStatus === "APPROVED" && leave.hrApprovalStatus === "APPROVED") {
      return "Fully approved";
    }

    if (leave.managerApprovalStatus === "APPROVED") {
      return leave.managerApprovedAt ? `Mgr ${formatDateTime(leave.managerApprovedAt)}` : "Manager approved";
    }

    if (leave.hrApprovalStatus === "APPROVED") {
      return leave.hrApprovedAt ? `HR ${formatDateTime(leave.hrApprovedAt)}` : "HR approved";
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
    if (leave.status !== "PENDING" || leave.hrApprovalStatus !== "PENDING") {
      return false;
    }

    return role === "ADMIN" || role === "HR";
  }

  function renderActions(leave: LeaveRequest) {
    if (canManagerReview(leave)) {
      return (
        <>
          <button className="leave-action-button" onClick={() => onReview(leave.id, "approve", "manager")}>
            Manager approve
          </button>
          <button className="secondary leave-action-button" onClick={() => onReview(leave.id, "reject", "manager")}>
            Reject
          </button>
        </>
      );
    }

    if (canHrReview(leave)) {
      return (
        <>
          <button className="leave-action-button" onClick={() => onReview(leave.id, "approve", "hr")}>
            HR approve
          </button>
          <button className="secondary leave-action-button" onClick={() => onReview(leave.id, "reject", "hr")}>
            Reject
          </button>
        </>
      );
    }

    if (leave.status === "PENDING" && leave.managerApprovalStatus === "PENDING" && leave.employee.id === currentEmployeeId) {
      return (
        <button className="secondary leave-action-button" onClick={() => onCancel(leave.id)}>
          Cancel
        </button>
      );
    }

    if (role === "EMPLOYEE" && leave.employee.id !== currentEmployeeId && teamLeadScopeIds.includes(leave.employee.id)) {
      return <span className="table-cell-secondary">View only</span>;
    }

    return <span>-</span>;
  }

  function renderStatusProgress(leave: LeaveRequest) {
    const steps = [leave.managerApprovalStatus, leave.hrApprovalStatus];
    const approvedCount = steps.filter((status) => status === "APPROVED").length;
    const fullyApproved = approvedCount === 2 && leave.status === "APPROVED";
    const hasRejected = steps.some((status) => status === "REJECTED") || leave.status === "REJECTED";
    const isCancelled = leave.status === "CANCELLED";

    return (
      <div className="leave-status-progress" title={`Manager: ${leave.managerApprovalStatus}, HR: ${leave.hrApprovalStatus}`}>
        <div className="leave-status-progress__track" aria-hidden="true">
          <span
            className={`leave-status-progress__step ${
              isCancelled
                ? "leave-status-progress__step--cancelled"
                : hasRejected
                  ? leave.managerApprovalStatus === "REJECTED"
                    ? "leave-status-progress__step--rejected"
                    : "leave-status-progress__step--pending"
                  : fullyApproved
                    ? "leave-status-progress__step--approved"
                    : "leave-status-progress__step--active"
            }`}
          />
          <span
            className={`leave-status-progress__step ${
              isCancelled
                ? "leave-status-progress__step--cancelled"
                : hasRejected
                  ? leave.hrApprovalStatus === "REJECTED"
                    ? "leave-status-progress__step--rejected"
                    : "leave-status-progress__step--pending"
                  : fullyApproved
                    ? "leave-status-progress__step--approved"
                    : "leave-status-progress__step--active"
            }`}
          />
        </div>
        <span className="leave-status-progress__meta">
          {isCancelled ? "X" : hasRejected ? "!" : `${approvedCount}/2`}
        </span>
      </div>
    );
  }

  function isExpanded(leaveId: number) {
    return expandedLeaveIds.includes(leaveId);
  }

  function toggleExpanded(leaveId: number) {
    setExpandedLeaveIds((current) =>
      current.includes(leaveId) ? current.filter((id) => id !== leaveId) : [...current, leaveId],
    );
  }

  return (
    <div className="leave-table-surface">
      {leaves.length ? (
        <div className="table-wrap">
          <table className="table table--dense">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Days</th>
                <th>Status</th>
                <th>Actions</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((leave) => {
                const expanded = isExpanded(leave.id);

                return (
                  <Fragment key={leave.id}>
                    <tr className={expanded ? "leave-request-row leave-request-row--expanded" : "leave-request-row"}>
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
                      <td>
                        {renderStatusProgress(leave)}
                      </td>
                      <td>
                        <div className="button-row row-actions leave-table-actions">{renderActions(leave)}</div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="secondary leave-expand-button"
                          onClick={() => toggleExpanded(leave.id)}
                          aria-expanded={expanded}
                        >
                          {expanded ? "Hide" : "View"}
                        </button>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="leave-request-details-row">
                        <td colSpan={7}>
                          <div className="leave-request-details">
                            <div className="leave-request-details__grid">
                              <div className="leave-request-details__section">
                                <p className="eyebrow">Approval progress</p>
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
                              </div>
                              <div className="leave-request-details__section">
                                <p className="eyebrow">More info</p>
                                <div className="leave-request-details__meta">
                                  <div className="leave-request-details__item">
                                    <span className="leave-request-details__label">Paid / unpaid</span>
                                    <span className="leave-request-details__value">{`${formatLeaveDays(leave.paidDays)} / ${formatLeaveDays(leave.unpaidDays)}`}</span>
                                  </div>
                                  <div className="leave-request-details__item">
                                    <span className="leave-request-details__label">Reviewed on</span>
                                    <span className="leave-request-details__value">{getReviewSummary(leave)}</span>
                                  </div>
                                  <div className="leave-request-details__item">
                                    <span className="leave-request-details__label">Attachment</span>
                                    {leave.attachmentPath ? (
                                      <a
                                        className="leave-request-details__link"
                                        href={getFileUrl(leave.attachmentPath) ?? "#"}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        {leave.attachmentName ?? "View attachment"}
                                      </a>
                                    ) : (
                                      <span className="leave-request-details__value">No attachment</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="leave-request-details__reason-block">
                              <p className="eyebrow">Reason</p>
                              <p className="leave-request-details__reason">{leave.reason}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="leave-table-empty-cell">
          <div className="leave-table-empty-state">
            <strong>No leave requests yet.</strong>
            <span>Use the Apply for leave action to submit the first request.</span>
          </div>
        </div>
      )}
    </div>
  );
}
