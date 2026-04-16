import Table from "../../components/common/Table";
import type { LeaveBalance, LeaveRequest, Role } from "../../types";
import { formatLeaveDays } from "../../utils/format";
import LeaveTable from "../leaves/LeaveTable";
import EmployeeLeaveBalanceChart from "./charts/EmployeeLeaveBalanceChart";
import EmployeeLeaveSplitChart from "./charts/EmployeeLeaveSplitChart";

type EmployeeLeavesTabProps = {
  balances: LeaveBalance[];
  leaves: LeaveRequest[];
  role: Role;
  viewerEmployeeId: number | null;
};

export default function EmployeeLeavesTab({ balances, leaves, role, viewerEmployeeId }: EmployeeLeavesTabProps) {
  const visibleBalances = balances.filter((balance) => !balance.leaveType.deductFullQuotaOnApproval);

  return (
    <div className="stack">
      <div className="grid cols-2 employee-profile-chart-grid">
        <EmployeeLeaveBalanceChart balances={visibleBalances} />
        <EmployeeLeaveSplitChart leaves={leaves} />
      </div>
      <div className="card employee-profile-section">
        <h3>Leave balances</h3>
        <Table
          compact
          columns={["Type", "Available now"]}
          rows={visibleBalances.map((balance) => [
            balance.leaveType.name,
            formatLeaveDays(balance.visibleDays ?? balance.remainingDays),
          ])}
        />
      </div>
      <LeaveTable leaves={leaves} role={role} currentEmployeeId={viewerEmployeeId} onCancel={() => undefined} />
    </div>
  );
}
