import "./LeavesPage.css";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import MessageCard from "../../components/common/MessageCard";
import Modal from "../../components/common/Modal";
import Table from "../../components/common/Table";
import { apiRequest } from "../../services/api";
import type { Employee, LeaveBalance, LeaveRequest, LeaveType, Role } from "../../types";
import { formatLeaveDays } from "../../utils/format";
import LeaveForm, { type LeaveFormValues } from "./LeaveForm";
import LeaveTable from "./LeaveTable";

type LeavesPageProps = {
  token: string | null;
  role: Role;
  currentEmployeeId: number | null;
  currentEmployee: Employee | null;
};

const initialLeaveForm = (): LeaveFormValues => ({
  leaveTypeId: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  startDayDuration: "FULL_DAY",
  endDayDuration: "FULL_DAY",
  reason: "",
});

export default function LeavesPage({ token, role, currentEmployeeId, currentEmployee }: LeavesPageProps) {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState<LeaveFormValues>(initialLeaveForm);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewingLeaveId, setReviewingLeaveId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [leaveFormOpen, setLeaveFormOpen] = useState(false);
  const [leaveBalancesOpen, setLeaveBalancesOpen] = useState(false);
  const [teamLeadScopeIds, setTeamLeadScopeIds] = useState<number[]>([]);
  const totalAllocated = balances.reduce((sum, balance) => sum + balance.allocatedDays, 0);
  const totalUsed = balances.reduce((sum, balance) => sum + balance.usedDays, 0);
  const totalRemaining = balances.reduce((sum, balance) => sum + balance.remainingDays, 0);
  const isTeamLead = Boolean(currentEmployee?.capabilities?.some((capability) => capability.capability === "TEAM_LEAD"));

  const reloadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [typesResponse, balancesResponse, leavesResponse] = await Promise.all([
        apiRequest<LeaveType[]>("/leave-types", { token }),
        apiRequest<LeaveBalance[]>("/leave-balances/me", { token }),
        apiRequest<LeaveRequest[]>("/leaves", { token }),
      ]);

      setLeaveTypes(typesResponse.data);
      setBalances(balancesResponse.data);
      setLeaves(leavesResponse.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load leave information.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  useEffect(() => {
    if (role !== "EMPLOYEE" || !isTeamLead || !currentEmployeeId) {
      setTeamLeadScopeIds([]);
      return;
    }

    apiRequest<Employee>(`/employees/${currentEmployeeId}`, { token })
      .then((response) => {
        setTeamLeadScopeIds(response.data.scopedTeamMembers?.map((item) => item.employee.id) ?? []);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Failed to load scoped team members.");
      });
  }, [currentEmployeeId, isTeamLead, role, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setError("");
      setMessage("");
      if (form.startDate === form.endDate && form.startDayDuration !== form.endDayDuration) {
        setError("For a single-date leave, duration must match on both start and end.");
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

      setMessage("Leave request submitted.");
      setForm(initialLeaveForm());
      setAttachmentFile(null);
      setLeaveFormOpen(false);
      await reloadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to submit leave request.");
    }
  }

  async function reviewLeave(id: number, action: "approve" | "reject") {
    if (action === "reject") {
      setReviewingLeaveId(id);
      setRejectionReason("");
      return;
    }

    try {
      setError("");
      setMessage("");
      await apiRequest(`/leaves/${id}/${action}`, {
        method: "PUT",
        token,
      });

      setMessage("Leave approved successfully.");
      await reloadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to review leave request.");
    }
  }

  async function submitRejection() {
    if (!reviewingLeaveId) {
      return;
    }

    try {
      setError("");
      setMessage("");
      await apiRequest(`/leaves/${reviewingLeaveId}/reject`, {
        method: "PUT",
        token,
        body: { rejectionReason },
      });

      setMessage("Leave rejected successfully.");
      setReviewingLeaveId(null);
      setRejectionReason("");
      await reloadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to reject leave request.");
    }
  }

  async function cancelLeave(id: number) {
    try {
      setError("");
      setMessage("");
      await apiRequest(`/leaves/${id}/cancel`, {
        method: "PUT",
        token,
      });

      setMessage("Leave request cancelled.");
      await reloadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to cancel leave request.");
    }
  }

  return (
    <section className="stack">
      {error ? <MessageCard title="Leave issue" tone="error" message={error} /> : null}
      {message ? <p className="success-text">{message}</p> : null}
      {loading ? (
        <article className="card skeleton-card skeleton-card--table">
          <span className="skeleton-line skeleton-line--title" />
          <span className="skeleton-line skeleton-line--long" />
          <span className="skeleton-line skeleton-line--long" />
          <span className="skeleton-line skeleton-line--long" />
        </article>
      ) : (
        <div className="card dense-table-card">
          <div className="action-row leaves-page-header">
            <div>
              <h3>Leave requests</h3>
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
          <LeaveTable
            leaves={leaves}
            role={role}
            currentEmployeeId={currentEmployeeId}
            teamLeadScopeIds={teamLeadScopeIds}
            onReview={reviewLeave}
            onCancel={cancelLeave}
          />
        </div>
      )}
      <Modal open={leaveFormOpen} title="Apply leave" className="leave-modal-surface" onClose={() => setLeaveFormOpen(false)}>
        <LeaveForm
          form={form}
          attachmentName={attachmentFile?.name}
          leaveTypes={leaveTypes}
          onChange={setForm}
          onAttachmentChange={setAttachmentFile}
          onSubmit={handleSubmit}
        />
      </Modal>
      <Modal open={leaveBalancesOpen} title="Leave balances" className="leave-modal-surface" onClose={() => setLeaveBalancesOpen(false)}>
        <div className="leave-balance-modal-summary">
          <div className="leave-balance-modal-stat">
            <span>Allocated</span>
            <strong>{formatLeaveDays(totalAllocated)}</strong>
          </div>
          <div className="leave-balance-modal-stat">
            <span>Used</span>
            <strong>{formatLeaveDays(totalUsed)}</strong>
          </div>
          <div className="leave-balance-modal-stat">
            <span>Remaining</span>
            <strong>{formatLeaveDays(totalRemaining)}</strong>
          </div>
        </div>
        <div className="card compact-table-card leave-balance-card leave-balance-modal-card">
          <Table
            compact
            columns={["Type", "Allocated", "Used", "Remaining"]}
            rows={balances.map((balance) => [
              balance.leaveType.name,
              formatLeaveDays(balance.allocatedDays),
              formatLeaveDays(balance.usedDays),
              formatLeaveDays(balance.remainingDays),
            ])}
          />
        </div>
      </Modal>
      <Modal open={reviewingLeaveId !== null} title="Reject leave request">
        <div className="stack leave-review-modal">
          <p className="muted">Add a clear reason so the employee understands why this request was rejected.</p>
          <label>
            Rejection reason
            <textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={4} minLength={3} />
          </label>
          <div className="button-row">
            <button type="button" className="secondary" onClick={() => setReviewingLeaveId(null)}>
              Close
            </button>
            <button type="button" onClick={submitRejection} disabled={rejectionReason.trim().length < 3}>
              Reject leave
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
