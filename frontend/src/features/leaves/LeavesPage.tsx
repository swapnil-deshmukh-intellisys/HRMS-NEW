import "./LeavesPage.css";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FormEvent } from "react";
import toast from "react-hot-toast";
import Modal from "../../components/common/Modal";
import { apiRequest } from "../../services/api";
import type { LeaveBalance, LeaveRequest, LeaveType, Role } from "../../types";
import { formatLeaveDays } from "../../utils/format";
import LeaveForm, { type LeaveFormValues } from "./LeaveForm";
import LeaveTable from "./LeaveTable";
import { countWords, LEAVE_REASON_MAX_WORDS, LEAVE_REASON_MIN_WORDS } from "./reasonValidation";

type LeavesPageProps = {
  token: string | null;
  role: Role;
  currentEmployeeId: number | null;
};

const initialLeaveForm = (): LeaveFormValues => {
  const now = new Date();
  const currentHour = now.getHours();
  let defaultDate = now;
  if (currentHour >= 14) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    defaultDate = tomorrow;
  }
  const dateStr = formatLocalIsoDate(defaultDate);
  return {
    leaveTypeId: "",
    startDate: dateStr,
    endDate: dateStr,
    startDayDuration: "FULL_DAY",
    endDayDuration: "FULL_DAY",
    reason: "",
  };
};

function formatLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function LeavesPage({ token, role, currentEmployeeId }: LeavesPageProps) {
  const navigate = useNavigate();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [form, setForm] = useState<LeaveFormValues>(initialLeaveForm);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveFormOpen, setLeaveFormOpen] = useState(false);
  const [leaveBalancesOpen, setLeaveBalancesOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: "cancel" | "approve" | "reject"; leaveId: number } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");
  const [expandedPolicyIndex, setExpandedPolicyIndex] = useState<number | null>(null);
  const summaryBalances = balances.filter((balance) => !balance.leaveType.deductFullQuotaOnApproval);

  // Filter leaves based on role and active tab
  const getFilteredLeaves = () => {
    // 1. First, determine which leaves this user should even see in this page
    // For Managers and Employees: show only their OWN leaves
    // For HR and Admin: show all leaves for management
    const visibleLeaves = (role === "HR" || role === "ADMIN" || role === "MANAGER")
      ? leaves
      : leaves.filter(leave => leave.employee.id === currentEmployeeId);

    // 2. Then filter by the active tab
    if (activeTab === "pending") {
      return visibleLeaves.filter(leave => {
        const isOwnLeave = leave.employee.id === currentEmployeeId;
        const isApprovedButPendingProof = leave.status === "APPROVED" && leave.medicalProofRequired && 
          (leave.medicalProofStatus === "PENDING_UPLOAD" || leave.medicalProofStatus === "PENDING_HR_REVIEW");

        if (role === "HR" || role === "ADMIN") {
          // HR/Admin pending: requests needing HR approval OR approved requests needing HR medical proof review
          const needsHrApproval = leave.status === "PENDING" && leave.hrApprovalStatus === "PENDING";
          const needsHrProofReview = leave.status === "APPROVED" && leave.medicalProofRequired && leave.medicalProofStatus === "PENDING_HR_REVIEW";
          return needsHrApproval || needsHrProofReview;
        } else if (role === "MANAGER") {
          // Managers see their own pending leaves/approved needing proof OR their team's pending manager-approval leaves
          const isOwnPendingOrNeedingProof = isOwnLeave && (leave.status === "PENDING" || isApprovedButPendingProof);
          const isTeamLeavePending = leave.employee.managerId === currentEmployeeId && leave.status === "PENDING" && leave.managerApprovalStatus === "PENDING";
          return isOwnPendingOrNeedingProof || isTeamLeavePending;
        } else {
          // For regular employees: their own pending leaves OR approved leaves needing proof
          return isOwnLeave && (leave.status === "PENDING" || isApprovedButPendingProof);
        }
      });
    }

    return visibleLeaves; // "all" tab shows all visible leaves
  };

  const filteredLeaves = getFilteredLeaves();

  // Get pending leaves count for badge (independent of active tab)
  const getPendingLeavesCount = () => {
    const visibleLeaves = (role === "HR" || role === "ADMIN" || role === "MANAGER")
      ? leaves
      : leaves.filter(leave => leave.employee.id === currentEmployeeId);

    return visibleLeaves.filter(leave => {
      const isOwnLeave = leave.employee.id === currentEmployeeId;
      const isApprovedButPendingProof = leave.status === "APPROVED" && leave.medicalProofRequired && 
        (leave.medicalProofStatus === "PENDING_UPLOAD" || leave.medicalProofStatus === "PENDING_HR_REVIEW");

      if (role === "HR" || role === "ADMIN") {
        const needsHrApproval = leave.status === "PENDING" && leave.hrApprovalStatus === "PENDING";
        const needsHrProofReview = leave.status === "APPROVED" && leave.medicalProofRequired && leave.medicalProofStatus === "PENDING_HR_REVIEW";
        return needsHrApproval || needsHrProofReview;
      } else if (role === "MANAGER") {
        const isOwnPendingOrNeedingProof = isOwnLeave && (leave.status === "PENDING" || isApprovedButPendingProof);
        const isTeamLeavePending = leave.employee.managerId === currentEmployeeId && leave.status === "PENDING" && leave.managerApprovalStatus === "PENDING";
        return isOwnPendingOrNeedingProof || isTeamLeavePending;
      } else {
        return isOwnLeave && (leave.status === "PENDING" || isApprovedButPendingProof);
      }
    }).length;
  };

  const pendingCount = getPendingLeavesCount();
  const today = new Date();
  const currentQuarterLabel =
    today.getMonth() >= 3 && today.getMonth() <= 5
      ? "Q1 · Apr to Jun"
      : today.getMonth() >= 6 && today.getMonth() <= 8
        ? "Q2 · Jul to Sep"
        : today.getMonth() >= 9 && today.getMonth() <= 11
          ? "Q3 · Oct to Dec"
          : "Q4 · Jan to Mar";

  const getPreviousQuarterInfo = () => {
    const currentMonth = today.getMonth(); // 0-indexed
    const currentYear = today.getFullYear();

    if (currentMonth >= 3 && currentMonth <= 5) {
      return {
        label: "Q4 · Jan to Mar",
        months: [0, 1, 2],
        year: currentYear,
      };
    } else if (currentMonth >= 6 && currentMonth <= 8) {
      return {
        label: "Q1 · Apr to Jun",
        months: [3, 4, 5],
        year: currentYear,
      };
    } else if (currentMonth >= 9 && currentMonth <= 11) {
      return {
        label: "Q2 · Jul to Sep",
        months: [6, 7, 8],
        year: currentYear,
      };
    } else {
      return {
        label: "Q3 · Oct to Dec",
        months: [9, 10, 11],
        year: currentYear - 1,
      };
    }
  };

  const getPreviousQuarterStats = () => {
    const prevQ = getPreviousQuarterInfo();
    const ownApprovedLeaves = leaves.filter(
      (leave) =>
        leave.employee.id === currentEmployeeId &&
        leave.status === "APPROVED"
    );

    const prevQLeaves = ownApprovedLeaves.filter((leave) => {
      const sDate = new Date(leave.startDate);
      return sDate.getFullYear() === prevQ.year && prevQ.months.includes(sDate.getMonth());
    });

    let totalPaid = 0;
    let totalUnpaid = 0;

    for (const leave of prevQLeaves) {
      totalPaid += leave.paidDays;
      totalUnpaid += leave.unpaidDays;
    }

    const totalTaken = totalPaid + totalUnpaid;
    const exceeded = totalUnpaid > 0;

    return {
      label: prevQ.label,
      totalTaken,
      totalPaid,
      totalUnpaid,
      exceeded,
    };
  };

  const prevStats = getPreviousQuarterStats();

  const loadLeaveTypes = useCallback(async () => {
    if (leaveTypes.length) {
      return;
    }

    const response = await apiRequest<LeaveType[]>("/leave-types", { token });
    setLeaveTypes(response.data.filter((t) => t.code !== "EL"));
  }, [leaveTypes.length, token]);

  const reloadData = useCallback(async (options?: { showPageLoader?: boolean }) => {
    const showPageLoader = options?.showPageLoader ?? true;

    try {
      if (showPageLoader) {
        setLoading(true);
      }
      const [balancesResponse, leavesResponse] = await Promise.all([
        apiRequest<LeaveBalance[]>("/leave-balances/me", { token }),
        apiRequest<LeaveRequest[]>("/leaves", { token }),
      ]);

      setBalances(balancesResponse.data.filter((b) => b.leaveType.code !== "EL"));
      setLeaves(leavesResponse.data);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to load leave information.");
    } finally {
      if (showPageLoader) {
        setLoading(false);
      }
    }
  }, [token]);

  useEffect(() => {
    reloadData({ showPageLoader: true });
  }, [reloadData]);

  useEffect(() => {
    loadLeaveTypes().catch((requestError) => {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to load leave types.");
    });
  }, [loadLeaveTypes]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSubmittingLeave(true);
      const now = new Date();
      const currentHour = now.getHours();
      let minDate = formatLocalIsoDate(now);
      if (currentHour >= 14) {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        minDate = formatLocalIsoDate(tomorrow);
      }

      if (form.startDate < minDate || form.endDate < minDate) {
        if (currentHour >= 14 && (form.startDate === formatLocalIsoDate(now) || form.endDate === formatLocalIsoDate(now))) {
          toast.error("Present day leave application is blocked after 2:00 PM.");
        } else {
          toast.error("Leave dates cannot be in the past.");
        }
        return;
      }

      if (form.startDate === form.endDate && form.startDayDuration !== form.endDayDuration) {
        toast.error("For a single-date leave, duration must match on both start and end.");
        return;
      }

      const reasonWordCount = countWords(form.reason);

      if (reasonWordCount < LEAVE_REASON_MIN_WORDS || reasonWordCount > LEAVE_REASON_MAX_WORDS) {
        toast.error(`Leave reason must be between ${LEAVE_REASON_MIN_WORDS} and ${LEAVE_REASON_MAX_WORDS} words.`);
        return;
      }

      const formData = new FormData();
      formData.append("leaveTypeId", String(Number(form.leaveTypeId)));
      formData.append("startDate", form.startDate);
      formData.append("endDate", form.endDate);
      formData.append("startDayDuration", form.startDayDuration);
      formData.append("endDayDuration", form.endDayDuration);
      formData.append("reason", form.reason);
      if (attachmentFile) {
        formData.append("attachment", attachmentFile);
      }

      await apiRequest<LeaveRequest>("/leaves", {
        method: "POST",
        token,
        body: formData,
      });

      toast.success("Leave request submitted.");
      setForm(initialLeaveForm());
      setAttachmentFile(null);
      setLeaveFormOpen(false);
      await reloadData({ showPageLoader: false });
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to submit leave request.");
    } finally {
      setSubmittingLeave(false);
    }
  }


  async function cancelLeave(id: number) {
    try {
      await apiRequest(`/leaves/${id}/cancel`, {
        method: "PUT",
        token,
      });

      toast.success("Leave request cancelled.");
      await reloadData();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to cancel leave request.");
    }
  }

  async function approveLeave(id: number) {
    try {
      const endpoint = role === "HR" || role === "ADMIN" ? "hr-approve" : "manager-approve";
      await apiRequest(`/leaves/${id}/${endpoint}`, {
        method: "PUT",
        token,
      });

      toast.success("Leave request approved.");
      await reloadData();
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
      const endpoint = role === "HR" || role === "ADMIN" ? "hr-reject" : "manager-reject";
      await apiRequest(`/leaves/${id}/${endpoint}`, {
        method: "PUT",
        token,
        body: { rejectionReason: reason },
      });

      toast.success("Leave request rejected.");
      setRejectionReason("");
      await reloadData();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to reject leave request.");
    }
  }

  async function uploadMedicalProof(id: number, file: File) {
    try {
      const formData = new FormData();
      formData.append("medicalProof", file);
      await apiRequest(`/leaves/${id}/medical-proof`, {
        method: "POST",
        token,
        body: formData,
      });

      toast.success("Medical proof uploaded.");
      await reloadData();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to upload medical proof.");
    }
  }

  async function reviewMedicalProof(id: number, action: "approve" | "reject") {
    try {
      await apiRequest(`/leaves/${id}/medical-proof/${action}`, {
        method: "PUT",
        token,
      });

      toast.success(action === "approve" ? "Medical proof verified." : "Medical proof rejected and leave converted to unpaid.");
      await reloadData();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to review medical proof.");
    }
  }

  return (
    <section className="stack">
      {loading ? (
        <article className="card skeleton-card skeleton-card--table">
          <span className="skeleton-line skeleton-line--title" />
          <span className="skeleton-line skeleton-line--long" />
          <span className="skeleton-line skeleton-line--long" />
          <span className="skeleton-line skeleton-line--long" />
        </article>
      ) : (
        <div className="card dense-table-card leaves-page-table-card">
          <div className="leaves-history-header">
            <div>
              <h3>Leave requests</h3>
              <p className="muted">Track and manage your time off applications.</p>
            </div>
            <div className="button-row row-actions leaves-page-actions">
              <button type="button" className="secondary leaves-page-balance-button" onClick={() => navigate('/calendar')}>
                View team calendar
              </button>
              <button type="button" className="secondary leaves-page-balance-button" onClick={() => setLeaveBalancesOpen(true)}>
                View leave balances
              </button>
              <button type="button" className="leaves-page-primary-button" onClick={() => setLeaveFormOpen(true)}>
                Apply for leave
              </button>
            </div>
          </div>
          <div className="leaves-page-tabs" role="tablist" aria-label="Leave requests filter">
            {pendingCount > 0 ? (
              <button
                type="button"
                className={activeTab === "pending" ? "leaves-page-tab active leaves-page-tab--with-count" : "leaves-page-tab leaves-page-tab--with-count"}
                onClick={() => setActiveTab("pending")}
              >
                <span>Pending</span>
                <span className="leaves-page-tab__count">{pendingCount}</span>
              </button>
            ) : (
              <button
                type="button"
                className={activeTab === "pending" ? "leaves-page-tab active" : "leaves-page-tab"}
                onClick={() => setActiveTab("pending")}
              >
                Pending
              </button>
            )}
            <button
              type="button"
              className={activeTab === "all" ? "leaves-page-tab active leaves-page-tab--with-count" : "leaves-page-tab leaves-page-tab--with-count"}
              onClick={() => setActiveTab("all")}
            >
              <span>All</span>
              <span className="leaves-page-tab__count">
                {(role === "HR" || role === "ADMIN" || role === "MANAGER")
                  ? leaves.length
                  : leaves.filter(l => l.employee.id === currentEmployeeId).length}
              </span>
            </button>
          </div>
          <LeaveTable
            leaves={filteredLeaves}
            role={role}
            currentEmployeeId={currentEmployeeId}
            onCancel={(id) => {
              if (window.confirm("Are you sure you want to cancel this leave request? This will remove it from the active approval flow.")) {
                void cancelLeave(id);
              }
            }}
            onApprove={(id) => {
              if (window.confirm("Are you sure you want to approve this leave request? This will deduct the balance and update attendance records.")) {
                void approveLeave(id);
              }
            }}
            onReject={(id) => setConfirmAction({ type: "reject", leaveId: id })}
            onUploadMedicalProof={uploadMedicalProof}
            onReviewMedicalProof={reviewMedicalProof}
          />
        </div>
      )}
      <Modal open={leaveFormOpen} title="Apply leave" className="leave-modal-surface" onClose={() => setLeaveFormOpen(false)}>
        <div className="stack">
          <LeaveForm
            form={form}
            attachmentName={attachmentFile?.name}
            leaveTypes={leaveTypes}
            balances={balances}
            isSubmitting={submittingLeave}
            onChange={setForm}
            onAttachmentChange={setAttachmentFile}
            onSubmit={handleSubmit}
          />
          <aside className="leave-policy-note">
            <p className="eyebrow" style={{ marginBottom: "8px" }}>Leave policy</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <strong style={{ fontSize: "13px", color: "var(--color-text-strong)", display: "block" }}>🥪 Sandwich Leave Rule</strong>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: "1.4" }}>
                  Sandwich leave is not allowed. If an official weekend or holiday falls directly between two approved leave days (e.g., Friday and Monday), those intermediate weekend/holiday days will also be deducted as leaves from your balance.
                </p>
              </div>
              <div>
                <strong style={{ fontSize: "13px", color: "var(--color-text-strong)", display: "block" }}>⚙️ Approval Workflow</strong>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: "1.4" }}>
                  Both Manager and HR approvals are required. Your request must be reviewed and approved by both your direct manager and the HR department before it is officially authorized.
                </p>
              </div>
              <div>
                <strong style={{ fontSize: "13px", color: "var(--color-text-strong)", display: "block" }}>✉️ Application Channels</strong>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: "1.4" }}>
                  Apply through HRMS or official email only. Informal submissions via verbal notices or instant messengers (e.g., WhatsApp, Slack) are not recognized as valid.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </Modal>
      <Modal open={leaveBalancesOpen} title="Leave balances" className="leave-modal-surface" onClose={() => setLeaveBalancesOpen(false)}>
        <div className="leave-balance-modal-layout">
          <section className="leave-balance-hero">
            <div className="leave-balance-hero__copy">
              <p className="eyebrow">Leave wallet</p>
              <h3>Your available time off</h3>
              <p className="muted">
                Live balance for the current financial year. Paid leave is shown here based on your latest approved requests.
              </p>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "16px" }}>
                {/* Current Quarter Card */}
                <div className="leave-balance-quarter-indicator">
                  <span className="leave-balance-quarter-indicator__label">Current quarter</span>
                  <strong>{currentQuarterLabel}</strong>
                  <span className="leave-balance-quarter-indicator__subtext">Active Allocation</span>
                </div>

                {/* Previous Quarter Card */}
                <div 
                  className="leave-balance-quarter-indicator"
                  style={prevStats.exceeded ? {
                    background: "rgba(239, 68, 68, 0.22)",
                    border: "1px solid rgba(239, 68, 68, 0.45)",
                    boxShadow: "0 4px 12px rgba(239, 68, 68, 0.12)",
                  } : undefined}
                >
                  <span 
                    className="leave-balance-quarter-indicator__label"
                    style={prevStats.exceeded ? { color: "#ff9c9c" } : undefined}
                  >
                    Previous Quarter ({prevStats.label.split(" · ")[0]})
                  </span>
                  <strong style={prevStats.exceeded ? { color: "#ffccd2" } : undefined}>
                    {prevStats.totalTaken} {prevStats.totalTaken === 1 ? "day" : "days"} taken
                  </strong>
                  <span 
                    className="leave-balance-quarter-indicator__subtext"
                    style={{ color: prevStats.exceeded ? "#ffb3b8" : "rgba(255, 255, 255, 0.6)" }}
                  >
                    {prevStats.exceeded 
                      ? `Exceeded! (${prevStats.totalUnpaid} unpaid)`
                      : "Within quarterly quota"
                    }
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="leave-balance-list">
            {summaryBalances.length ? (
              summaryBalances.map((balance) => (
                <article key={balance.id} className="leave-balance-list-item">
                  <div className="leave-balance-list-item__meta">
                    <p className="leave-balance-list-item__code">{balance.leaveType.code}</p>
                    <h4>{balance.leaveType.name}</h4>
                  </div>
                  <div className="leave-balance-list-item__value">
                    <strong>{formatLeaveDays(balance.visibleDays ?? balance.remainingDays)}</strong>
                    <span>available now</span>
                  </div>
                </article>
              ))
            ) : (
              <div className="leave-balance-empty">
                <p className="eyebrow">No balances</p>
                <h4>No leave balances available yet</h4>
                <p className="muted">Balances will appear here once your leave policy is assigned.</p>
              </div>
            )}
          </section>

          <aside className="leave-policy-note leave-policy-note--premium" style={{ display: "flex", flexDirection: "column", gap: "12px", border: "1px solid rgba(148, 163, 184, 0.16)" }}>
            <p className="eyebrow" style={{ margin: 0, color: "var(--color-text-secondary)", marginBottom: "4px" }}>Policy snapshot</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                {
                  title: "🥪 Sandwich Leave Rule",
                  summary: "Sandwich leave is not allowed.",
                  detail: "If an official weekend or holiday falls directly between two approved leave days (e.g., Friday and Monday), those intermediate weekend/holiday days will also be deducted as leaves from your balance."
                },
                {
                  title: "🤒 Sick Leave Proof Submission",
                  summary: "Medical proof must be uploaded within 24 hours of approval.",
                  detail: "Sick Leave requests spanning 2 or more days require uploading a valid medical certificate within a strict 24-hour deadline of being approved. If not uploaded within 24 hours, the leave automatically converts to Casual Leave, or Unpaid Leave if your CL balances are exhausted."
                },
                {
                  title: "🕒 Same-Day Cutoff Time",
                  summary: "Same-day leave requests must be submitted before 1:30 PM.",
                  detail: "Applying for present-day leave is restricted and blocked after 1:30 PM (the half-shift milestone) to prevent operational bottlenecks and ensure predictability for the team."
                },
                {
                  title: "📅 Quarterly Allocation Rule",
                  summary: "Casual and Sick Leaves are credited on a quarterly basis.",
                  detail: "Casual Leaves (CL) and Sick Leaves (SL) are credited quarterly (3 CL and 2 SL per quarter). Exceeding the current credited balance converts the extra days to Unpaid Leaves."
                },
                {
                  title: "⚙️ Approval Workflow",
                  summary: "Both Manager and HR approvals are required.",
                  detail: "All leave requests must be approved by both your direct manager and the HR department. The leave is not fully authorized until both roles have submitted their approvals."
                }
              ].map((policy, index) => {
                const isExpanded = expandedPolicyIndex === index;
                return (
                  <div 
                    key={index} 
                    style={{ 
                      background: "rgba(148, 163, 184, 0.05)", 
                      borderRadius: "12px", 
                      padding: "12px", 
                      border: isExpanded ? "1px solid var(--color-primary)" : "1px solid rgba(148, 163, 184, 0.1)",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div 
                      onClick={() => setExpandedPolicyIndex(isExpanded ? null : index)}
                      style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center", 
                        cursor: "pointer",
                        userSelect: "none"
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text-strong)", letterSpacing: "0.01em" }}>
                          {policy.title}
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: "1.3" }}>
                          {policy.summary}
                        </span>
                      </div>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "24px",
                        height: "24px",
                        marginLeft: "12px"
                      }}>
                        <span 
                          style={{ 
                            fontSize: "12px", 
                            color: "var(--color-primary)", 
                            fontWeight: 700,
                            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease",
                            display: "inline-block"
                          }}
                        >
                          ▼
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div 
                        style={{ 
                          marginTop: "12px", 
                          borderTop: "1px dashed rgba(148, 163, 184, 0.4)", 
                          paddingTop: "12px",
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "var(--color-text-secondary)",
                          lineHeight: "1.5",
                          animation: "fadeIn 0.2s ease"
                        }}
                      >
                        {policy.detail}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </Modal>
      <Modal
        open={confirmAction !== null}
        title="Reject leave request"
        onClose={() => {
          setConfirmAction(null);
          setRejectionReason("");
        }}
      >
        <div className="stack leave-review-modal">
          <p className="muted">
            Please provide a reason for rejecting this leave request. This will be visible to the employee.
          </p>

          <textarea
            className="leave-form__input"
            style={{ minHeight: '100px' }}
            placeholder="e.g. Critical project deadline, overlapping leaves in team..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />

          <div className="button-row">
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
