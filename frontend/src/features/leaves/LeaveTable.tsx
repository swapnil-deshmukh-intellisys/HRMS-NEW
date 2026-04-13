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
  onUploadMedicalProof?: (id: number, file: File) => void | Promise<void>;
  onReviewMedicalProof?: (id: number, action: "approve" | "reject") => void | Promise<void>;
};

export default function LeaveTable({
  leaves,
  role,
  currentEmployeeId,
  teamLeadScopeIds = [],
  onReview,
  onCancel,
  onUploadMedicalProof,
  onReviewMedicalProof,
}: LeaveTableProps) {
  const [expandedLeaveIds, setExpandedLeaveIds] = useState<number[]>([]);
  const [medicalProofFiles, setMedicalProofFiles] = useState<Record<number, File | null>>({});

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

  function getProgressStepClass(status: LeaveRequest["managerApprovalStatus"]) {
    return `leave-status-progress__step leave-status-progress__step--${status.toLowerCase()}`;
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
        return leave.hrApprovedAt ? `HR ${formatDateTime(leave.hrApprovedAt)}` : "HR rejected";
      }

      if (leave.managerApprovalStatus === "REJECTED") {
        return leave.managerApprovedAt ? `Mgr ${formatDateTime(leave.managerApprovedAt)}` : "Manager rejected";
      }

      return "Rejected";
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
      return <span className="leave-action-placeholder">-</span>;
    }

    return <span className="leave-action-placeholder">-</span>;
  }

  function renderStatusProgress(leave: LeaveRequest) {
    return (
      <div className="leave-status-progress" title={`Manager: ${leave.managerApprovalStatus}, HR: ${leave.hrApprovalStatus}`}>
        <div className="leave-status-progress__track" aria-hidden="true">
          <span className={getProgressStepClass(leave.managerApprovalStatus)} />
          <span className={getProgressStepClass(leave.hrApprovalStatus)} />
        </div>
        <span className="leave-status-progress__meta">Mgr / HR</span>
      </div>
    );
  }

  function getMedicalProofStatusLabel(leave: LeaveRequest) {
    switch (leave.medicalProofStatus) {
      case "PENDING_UPLOAD":
        return "Proof upload pending";
      case "PENDING_HR_REVIEW":
        return "Waiting for HR proof review";
      case "APPROVED":
        return "Proof approved";
      case "REJECTED":
        return "Proof rejected";
      case "EXPIRED":
        return "Proof deadline missed";
      default:
        return "Not required";
    }
  }

  function canUploadMedicalProof(leave: LeaveRequest) {
    return (
      leave.employee.id === currentEmployeeId &&
      leave.status === "APPROVED" &&
      leave.medicalProofRequired &&
      leave.medicalProofStatus === "PENDING_UPLOAD"
    );
  }

  function canHrReviewMedicalProof(leave: LeaveRequest) {
    return (
      (role === "HR" || role === "ADMIN") &&
      leave.status === "APPROVED" &&
      leave.medicalProofRequired &&
      leave.medicalProofStatus === "PENDING_HR_REVIEW"
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
                        <span className="table-cell-primary">{`${leave.employee.firstName} ${leave.employee.lastName}`}</span>
                      </td>
                      <td>
                        <span className="table-cell-primary">{leave.leaveType.code}</span>
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
                                    <span className="leave-request-details__label">Leave type</span>
                                    <span className="leave-request-details__value">{leave.leaveType.name}</span>
                                  </div>
                                  <div className="leave-request-details__item">
                                    <span className="leave-request-details__label">Employee ID</span>
                                    <span className="leave-request-details__value">{leave.employee.employeeCode}</span>
                                  </div>
                                  <div className="leave-request-details__item">
                                    <span className="leave-request-details__label">Paid / unpaid</span>
                                    <span className="leave-request-details__value">{`${formatLeaveDays(leave.paidDays)} / ${formatLeaveDays(leave.unpaidDays)}`}</span>
                                  </div>
                                  <div className="leave-request-details__item">
                                    <span className="leave-request-details__label">Reviewed on</span>
                                    <span className="leave-request-details__value">{getReviewSummary(leave)}</span>
                                  </div>
                                  {leave.hrApprovalStatus === "REJECTED" && leave.hrRejectionReason ? (
                                    <div className="leave-request-details__item">
                                      <span className="leave-request-details__label">HR rejection reason</span>
                                      <span className="leave-request-details__value">{leave.hrRejectionReason}</span>
                                    </div>
                                  ) : null}
                                  {leave.managerApprovalStatus === "REJECTED" && leave.managerRejectionReason ? (
                                    <div className="leave-request-details__item">
                                      <span className="leave-request-details__label">Manager rejection reason</span>
                                      <span className="leave-request-details__value">{leave.managerRejectionReason}</span>
                                    </div>
                                  ) : null}
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
                                  {leave.medicalProofRequired ? (
                                    <>
                                      <div className="leave-request-details__item">
                                        <span className="leave-request-details__label">Medical proof</span>
                                        <span className="leave-request-details__value">{getMedicalProofStatusLabel(leave)}</span>
                                      </div>
                                      <div className="leave-request-details__item">
                                        <span className="leave-request-details__label">Proof due</span>
                                        <span className="leave-request-details__value">
                                          {leave.medicalProofDueAt ? formatDateTime(leave.medicalProofDueAt) : "-"}
                                        </span>
                                      </div>
                                      {leave.medicalProofReviewedAt ? (
                                        <div className="leave-request-details__item">
                                          <span className="leave-request-details__label">Proof reviewed on</span>
                                          <span className="leave-request-details__value">{formatDateTime(leave.medicalProofReviewedAt)}</span>
                                        </div>
                                      ) : null}
                                      {leave.medicalProofRejectionReason ? (
                                        <div className="leave-request-details__item">
                                          <span className="leave-request-details__label">Proof review note</span>
                                          <span className="leave-request-details__value">{leave.medicalProofRejectionReason}</span>
                                        </div>
                                      ) : null}
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            {canUploadMedicalProof(leave) ? (
                              <div className="leave-request-details__reason-block">
                                <p className="eyebrow">Medical proof upload</p>
                                <div className="button-row row-actions leave-table-actions">
                                  <input
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    onChange={(event) =>
                                      setMedicalProofFiles((current) => ({
                                        ...current,
                                        [leave.id]: event.target.files?.[0] ?? null,
                                      }))
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="leave-action-button"
                                    disabled={!medicalProofFiles[leave.id]}
                                    onClick={() => {
                                      const file = medicalProofFiles[leave.id];

                                      if (!file || !onUploadMedicalProof) {
                                        return;
                                      }

                                      void onUploadMedicalProof(leave.id, file);
                                    }}
                                  >
                                    Upload proof
                                  </button>
                                </div>
                              </div>
                            ) : null}
                            {canHrReviewMedicalProof(leave) ? (
                              <div className="leave-request-details__reason-block">
                                <p className="eyebrow">Medical proof review</p>
                                <div className="button-row row-actions leave-table-actions">
                                  <button
                                    type="button"
                                    className="leave-action-button"
                                    onClick={() => {
                                      if (onReviewMedicalProof) {
                                        void onReviewMedicalProof(leave.id, "approve");
                                      }
                                    }}
                                  >
                                    Verify proof
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary leave-action-button"
                                    onClick={() => {
                                      if (onReviewMedicalProof) {
                                        void onReviewMedicalProof(leave.id, "reject");
                                      }
                                    }}
                                  >
                                    Reject proof
                                  </button>
                                </div>
                              </div>
                            ) : null}
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
