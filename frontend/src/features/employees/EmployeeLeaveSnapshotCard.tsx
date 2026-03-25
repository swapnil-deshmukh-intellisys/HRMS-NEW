import "./EmployeeSnapshotCards.css";
import { useMemo, useState } from "react";
import type { LeaveBalance, LeaveRequest } from "../../types";
import { formatLeaveDays } from "../../utils/format";

type EmployeeLeaveSnapshotCardProps = {
  balances: LeaveBalance[];
  leaves: LeaveRequest[];
};

type LeaveSnapshotTab = "balance" | "requests";

function getRemainingPercentage(remainingDays: number, allocatedDays: number) {
  if (!allocatedDays) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((remainingDays / allocatedDays) * 100)));
}

export default function EmployeeLeaveSnapshotCard({ balances, leaves }: EmployeeLeaveSnapshotCardProps) {
  const [activeTab, setActiveTab] = useState<LeaveSnapshotTab>("balance");

  const totalRemainingLeave = balances.reduce((total, balance) => total + balance.remainingDays, 0);
  const totalAllocatedLeave = balances.reduce((total, balance) => total + balance.allocatedDays, 0);
  const pendingLeaves = leaves.filter((leave) => leave.status === "PENDING").length;
  const latestLeave = useMemo(() => leaves[0], [leaves]);
  const totalPaidDays = leaves.reduce((total, leave) => total + leave.paidDays, 0);
  const totalUnpaidDays = leaves.reduce((total, leave) => total + leave.unpaidDays, 0);
  const currentMonthTakenLeave = useMemo(() => {
    const now = new Date();
    return leaves.reduce((total, leave) => {
      const startDate = new Date(leave.startDate);
      if (
        startDate.getFullYear() === now.getFullYear() &&
        startDate.getMonth() === now.getMonth() &&
        leave.status === "APPROVED"
      ) {
        return total + leave.totalDays;
      }

      return total;
    }, 0);
  }, [leaves]);

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
            <span className="employee-snapshot-stat__label">Remaining leave</span>
            <strong>{formatLeaveDays(totalRemainingLeave)}</strong>
            <p className="muted">{totalAllocatedLeave ? `${Math.round((totalRemainingLeave / totalAllocatedLeave) * 100)}% of allocated leave still available` : "No leave balances assigned yet"}</p>
          </div>
          <div className="employee-snapshot-balance-list">
            {balances.length ? (
              balances.map((balance) => (
                <div key={balance.id} className="employee-snapshot-balance-row">
                  <div className="employee-snapshot-balance-row__meta">
                    <span>{balance.leaveType.code}</span>
                    <span>{`${formatLeaveDays(balance.remainingDays)} / ${formatLeaveDays(balance.allocatedDays)}`}</span>
                  </div>
                  <div className="employee-snapshot-progress__track">
                    <span
                      className="employee-snapshot-progress__fill employee-snapshot-progress__fill--leave"
                      style={{ width: `${getRemainingPercentage(balance.remainingDays, balance.allocatedDays)}%` }}
                    />
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
