import "./EmployeeSnapshotCards.css";
import { useMemo, useState } from "react";
import type { LeaveBalance, LeaveRequest } from "../../types";
import { formatLeaveDays } from "../../utils/format";

type EmployeeLeaveSnapshotCardProps = {
  balances: LeaveBalance[];
  leaves: LeaveRequest[];
};

type LeaveSnapshotTab = "balance" | "requests";

export default function EmployeeLeaveSnapshotCard({ balances, leaves }: EmployeeLeaveSnapshotCardProps) {
  const [activeTab, setActiveTab] = useState<LeaveSnapshotTab>("balance");
  const approvedLeaves = useMemo(() => leaves.filter((leave) => leave.status === "APPROVED"), [leaves]);
  const summaryBalances = useMemo(
    () => balances.filter((balance) => !balance.leaveType.deductFullQuotaOnApproval),
    [balances],
  );

  const totalUsableLeave = summaryBalances.reduce((total, balance) => total + (balance.visibleDays ?? balance.remainingDays), 0);
  const pendingLeaves = leaves.filter((leave) => leave.status === "PENDING").length;
  const latestLeave = useMemo(() => leaves[0], [leaves]);
  const totalPaidDays = approvedLeaves.reduce((total, leave) => total + leave.paidDays, 0);
  const totalUnpaidDays = approvedLeaves.reduce((total, leave) => total + leave.unpaidDays, 0);
  const currentMonthTakenLeave = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return approvedLeaves.reduce((total, leave) => {
      const startDate = new Date(leave.startDate);
      const endDate = new Date(leave.endDate);

      if (startDate <= monthEnd && endDate >= monthStart) {
        return total + leave.totalDays;
      }

      return total;
    }, 0);
  }, [approvedLeaves]);

  return (
    <article className="card employee-snapshot-card">
      <div className="employee-snapshot-card__header">
        <div>
          <p className="eyebrow">Leave snapshot</p>
          <h3>Leave allocation</h3>
        </div>
        <div className="employee-snapshot-tabs">
          <button
            type="button"
            className={activeTab === "balance" ? "employee-snapshot-tab active" : "employee-snapshot-tab"}
            onClick={() => setActiveTab("balance")}
          >
            Balance
          </button>
          <button
            type="button"
            className={activeTab === "requests" ? "employee-snapshot-tab active" : "employee-snapshot-tab"}
            onClick={() => setActiveTab("requests")}
          >
            Requests
          </button>
        </div>
      </div>

      {activeTab === "balance" ? (
        <div className="employee-snapshot-card__body">
          <div className="employee-snapshot-stat">
            <span className="employee-snapshot-stat__label">Available now</span>
            <strong>{formatLeaveDays(totalUsableLeave)}</strong>
            <p className="muted">
              {summaryBalances.length
                ? "Current leave available across visible leave types."
                : "No leave balances assigned yet"}
            </p>
          </div>
          <div className="employee-snapshot-balance-list">
            {summaryBalances.length ? (
              summaryBalances.map((balance) => (
                <div key={balance.id} className="employee-snapshot-balance-row">
                  <div className="employee-snapshot-balance-row__meta">
                    <span>{balance.leaveType.name}</span>
                    <strong>{formatLeaveDays(balance.visibleDays ?? balance.remainingDays)}</strong>
                  </div>
                  <div className="employee-snapshot-balance-row__details">
                    <span>Available to apply right now.</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">No leave balances available yet.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="employee-snapshot-card__body">
          <div className="employee-snapshot-mini-grid">
            <div className="employee-snapshot-mini-card">
              <span className="employee-snapshot-mini-card__label">Pending</span>
              <strong>{pendingLeaves}</strong>
            </div>
            <div className="employee-snapshot-mini-card">
              <span className="employee-snapshot-mini-card__label">Taken this month</span>
              <strong>{formatLeaveDays(currentMonthTakenLeave)}</strong>
            </div>
          </div>
          <div className="employee-snapshot-breakdown">
            <div className="employee-snapshot-breakdown__row">
              <span>Paid leave days</span>
              <strong>{formatLeaveDays(totalPaidDays)}</strong>
            </div>
            <div className="employee-snapshot-breakdown__row">
              <span>Unpaid leave days</span>
              <strong>{formatLeaveDays(totalUnpaidDays)}</strong>
            </div>
          </div>
          <p className="muted">
            {latestLeave
              ? `Latest request: ${latestLeave.leaveType.name}, ${formatLeaveDays(latestLeave.totalDays)}, ${latestLeave.status.toLowerCase()}.`
              : "No leave requests submitted yet."}
          </p>
        </div>
      )}
    </article>
  );
}
