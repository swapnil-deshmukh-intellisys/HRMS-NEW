import "./LeaveTable.css";
import "../../components/common/Table.css";
import { Calendar, ChevronDown } from "lucide-react";
import { Fragment, useState } from "react";
import { getFileUrl } from "../../services/api";
import type { LeaveRequest, Role } from "../../types";
import { formatDateLabel, formatDateTime, formatLeaveDays } from "../../utils/format";

type LeaveTableProps = {
  leaves: LeaveRequest[];
  role: Role;
  currentEmployeeId: number | null;
  onCancel?: (id: number) => void | Promise<void>;
  onApprove?: (id: number) => void | Promise<void>;
  onReject?: (id: number) => void | Promise<void>;
  onUploadMedicalProof?: (id: number, file: File) => void | Promise<void>;
  onReviewMedicalProof?: (id: number, action: "approve" | "reject") => void | Promise<void>;
};

export default function LeaveTable({
  leaves,
  role,
  currentEmployeeId,
  onCancel,
  onApprove,
  onReject,
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


  function renderActions(leave: LeaveRequest) {
    const isPending = leave.status === "PENDING";
    
    // For personal leaves, only allow cancellation of pending requests
    if (isPending && leave.managerApprovalStatus === "PENDING" && leave.employee.id === currentEmployeeId && onCancel) {
      return (
        <button className="secondary leave-action-button" onClick={() => onCancel(leave.id)}>
          Cancel
        </button>
      );
    }

    // Role-based review actions
    if (isPending) {
      const isManagerReview = role === "MANAGER" && leave.employee.managerId === currentEmployeeId && leave.managerApprovalStatus === "PENDING";
      const isHrReview = (role === "HR" || role === "ADMIN") && leave.hrApprovalStatus === "PENDING";

      if ((isManagerReview || isHrReview) && onApprove && onReject) {
        return (
          <Fragment>
            <button onClick={() => onApprove(leave.id)}>
              Approve
            </button>
            <button className="secondary" onClick={() => onReject(leave.id)}>
              Reject
            </button>
          </Fragment>
        );
      }
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

  // Group leaves by month
  function groupLeavesByMonth(leaves: LeaveRequest[]) {
    const grouped: Record<string, LeaveRequest[]> = {};
    
    leaves.forEach(leave => {
      const startDate = new Date(leave.startDate);
      const monthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(leave);
    });
    
    // Sort months in descending order (most recent first)
    const sortedMonths = Object.keys(grouped).sort((a, b) => {
      const [yearA, monthA] = a.split('-').map(Number);
      const [yearB, monthB] = b.split('-').map(Number);
      return yearB - yearA || monthB - monthA;
    });
    
    return sortedMonths.map(monthKey => ({
      monthKey,
      monthLabel: formatMonthLabel(monthKey),
      leaves: grouped[monthKey].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    }));
  }

  function formatMonthLabel(monthKey: string) {
    const [year, month] = monthKey.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }

  const monthGroups = groupLeavesByMonth(leaves);

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
                <th style={{ width: "40px" }}></th>
              </tr>
            </thead>
            <tbody>
              {monthGroups.map((monthGroup) => (
                <Fragment key={monthGroup.monthKey}>
                  <tr className="leave-month-header">
                    <td colSpan={7}>
                      <div className="leave-month-header__content">
                        <h3 className="leave-month-header__title">
                          <Calendar size={16} strokeWidth={2.5} style={{ opacity: 0.6 }} />
                          {monthGroup.monthLabel}
                        </h3>
                        <span className="leave-month-header__count">{monthGroup.leaves.length} leave{monthGroup.leaves.length !== 1 ? 's' : ''}</span>
                      </div>
                    </td>
                  </tr>
                  {monthGroup.leaves.map((leave) => {
                    const expanded = isExpanded(leave.id);

                    return (
                      <Fragment key={leave.id}>
                    <tr 
                      className={`expandable-row-trigger leave-request-row ${expanded ? "expanded-row-trigger leave-request-row--expanded" : ""}`}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest("button")) return;
                        toggleExpanded(leave.id);
                      }}
                    >
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
                        <ChevronDown className={`expandable-row-icon ${expanded ? "expanded" : ""}`} />
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="expanded-row-content">
                        <td colSpan={7}>
                          <div className="expanded-details-container">
                            <div className="expanded-details-grid">
                              
                              <div className="detail-block" style={{ gridColumn: "span 2" }}>
                                <span className="table-cell-secondary">Reason</span>
                                <span className="table-cell-primary" style={{ whiteSpace: "pre-wrap" }}>{leave.reason || "No reason provided"}</span>
                              </div>

                              <div className="detail-block">
                                <span className="table-cell-secondary">Approval Progress</span>
                                <div className="leave-progress" style={{ marginTop: '4px' }}>
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

                              <div className="detail-block">
                                <span className="table-cell-secondary">Leave specifics</span>
                                <span className="table-cell-primary">{leave.leaveType.name}</span>
                                <span className="table-cell-primary" style={{ fontSize: '13px', marginTop: '2px' }}>
                                  {formatLeaveRange(leave)}
                                </span>
                                <span className="table-cell-secondary" style={{ fontSize: '12px' }}>
                                  {`${formatLeaveDays(leave.paidDays)} Paid / ${formatLeaveDays(leave.unpaidDays)} Unpaid`}
                                </span>
                              </div>

                              {leave.attachmentPath ? (
                                <div className="detail-block">
                                  <span className="table-cell-secondary">Attachment</span>
                                  <a
                                    className="table-cell-primary leave-request-details__link"
                                    href={getFileUrl(leave.attachmentPath) ?? "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: "var(--color-accent)", textDecoration: "underline" }}
                                  >
                                    {leave.attachmentName ?? "View attachment"}
                                  </a>
                                </div>
                              ) : null}

                              {(leave.hrApprovalStatus === "REJECTED" && leave.hrRejectionReason) || 
                               (leave.managerApprovalStatus === "REJECTED" && leave.managerRejectionReason) ? (
                                <div className="detail-block" style={{ gridColumn: "span 2" }}>
                                  <span className="table-cell-secondary error-text">Rejection Remarks</span>
                                  {leave.managerApprovalStatus === "REJECTED" ? (
                                    <span className="attendance-warning-text">Manager: {leave.managerRejectionReason}</span>
                                  ) : null}
                                  {leave.hrApprovalStatus === "REJECTED" ? (
                                    <span className="attendance-warning-text">HR: {leave.hrRejectionReason}</span>
                                  ) : null}
                                </div>
                              ) : null}

                              {leave.medicalProofRequired ? (
                                <div className="detail-block" style={{ gridColumn: "span 3" }}>
                                  <span className="table-cell-secondary">Medical Proof Requirement</span>
                                  <div style={{ display: "flex", gap: "16px", alignItems: "center", marginTop: "4px" }}>
                                    <span className="table-cell-primary">{getMedicalProofStatusLabel(leave)}</span>
                                    {leave.medicalProofDueAt ? (
                                      <span className="table-cell-secondary" style={{ fontSize: '12px' }}>Due: {formatDateTime(leave.medicalProofDueAt)}</span>
                                    ) : null}
                                  </div>
                                  
                                  {leave.medicalProofRejectionReason ? (
                                    <span className="attendance-warning-text" style={{ marginTop: "4px" }}>{leave.medicalProofRejectionReason}</span>
                                  ) : null}

                                  {canUploadMedicalProof(leave) ? (
                                    <div className="button-row row-actions" style={{ marginTop: "8px" }}>
                                      <input
                                        type="file"
                                        accept=".pdf,application/pdf"
                                        style={{ maxWidth: "200px" }}
                                        onChange={(event) =>
                                          setMedicalProofFiles((current) => ({
                                            ...current,
                                            [leave.id]: event.target.files?.[0] ?? null,
                                          }))
                                        }
                                      />
                                      <button
                                        type="button"
                                        disabled={!medicalProofFiles[leave.id]}
                                        onClick={() => {
                                          const file = medicalProofFiles[leave.id];
                                          if (!file || !onUploadMedicalProof) return;
                                          void onUploadMedicalProof(leave.id, file);
                                        }}
                                      >
                                        Upload proof
                                      </button>
                                    </div>
                                  ) : null}

                                  {canHrReviewMedicalProof(leave) ? (
                                    <div className="button-row row-actions" style={{ marginTop: "8px" }}>
                                      <button
                                        type="button"
                                        onClick={() => onReviewMedicalProof?.(leave.id, "approve")}
                                      >
                                        Verify proof
                                      </button>
                                      <button
                                        type="button"
                                        className="secondary"
                                        onClick={() => onReviewMedicalProof?.(leave.id, "reject")}
                                      >
                                        Reject proof
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}

                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
                </Fragment>
              ))}
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
