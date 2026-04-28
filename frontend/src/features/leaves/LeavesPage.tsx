import "./LeavesPage.css";
import { useCallback, useEffect, useState } from "react";
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

const initialLeaveForm = (): LeaveFormValues => ({
  leaveTypeId: "",
  startDate: formatLocalIsoDate(new Date()),
  endDate: formatLocalIsoDate(new Date()),
  startDayDuration: "FULL_DAY",
  endDayDuration: "FULL_DAY",
  reason: "",
});

function formatLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function LeavesPage({ token, role, currentEmployeeId }: LeavesPageProps) {
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
  const summaryBalances = balances.filter((balance) => !balance.leaveType.deductFullQuotaOnApproval);

  // Filter leaves based on role and active tab
  const getFilteredLeaves = () => {
    // 1. First, determine which leaves this user should even see in this page
    // For Managers and Employees: show only their OWN leaves
    // For HR and Admin: show all leaves for management
    const visibleLeaves = (role === "HR" || role === "ADMIN")
      ? leaves
      : leaves.filter(leave => leave.employee.id === currentEmployeeId);

    // 2. Then filter by the active tab
    if (activeTab === "pending") {
      return visibleLeaves.filter(leave => {
        if (role === "HR" || role === "ADMIN") {
          return leave.status === "PENDING" && leave.hrApprovalStatus === "PENDING";
        } else {
          // For everyone else, just their own pending leaves
          return leave.status === "PENDING";
        }
      });
    }

    return visibleLeaves; // "all" tab shows all visible leaves
  };

  const filteredLeaves = getFilteredLeaves();

  // Get pending leaves count for badge (independent of active tab)
  const getPendingLeavesCount = () => {
    const visibleLeaves = (role === "HR" || role === "ADMIN")
      ? leaves
      : leaves.filter(leave => leave.employee.id === currentEmployeeId);

    return visibleLeaves.filter(leave => {
      if (role === "HR" || role === "ADMIN") {
        return leave.status === "PENDING" && leave.hrApprovalStatus === "PENDING";
      } else {
        return leave.status === "PENDING";
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

  const loadLeaveTypes = useCallback(async () => {
    if (leaveTypes.length) {
      return;
    }

    const response = await apiRequest<LeaveType[]>("/leave-types", { token });
    setLeaveTypes(response.data);
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

      setBalances(balancesResponse.data);
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
      const todayIso = formatLocalIsoDate(new Date());

      if (form.startDate < todayIso || form.endDate < todayIso) {
        toast.error("Leave dates cannot be in the past.");
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
                {(role === "HR" || role === "ADMIN")
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
            <p className="eyebrow">Leave policy</p>
            <ul className="leave-policy-note__list">
              <li>Sandwich leave is not allowed.</li>
              <li>Manager and HR approval are required.</li>
              <li>Apply through HRMS or official email only.</li>
            </ul>
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
              <div className="leave-balance-quarter-indicator">
                <span className="leave-balance-quarter-indicator__label">Current quarter</span>
                <strong>{currentQuarterLabel}</strong>
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

          <aside className="leave-policy-note leave-policy-note--premium">
            <p className="eyebrow">Policy snapshot</p>
            <ul className="leave-policy-note__list">
              <li>Sandwich leave is not allowed.</li>
              <li>Manager and HR approval are required.</li>
              <li>Apply through HRMS or official email only.</li>
            </ul>
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
