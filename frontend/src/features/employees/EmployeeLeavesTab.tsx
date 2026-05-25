import type { LeaveBalance, LeaveRequest, Role } from "../../types";
import LeaveTable from "../leaves/LeaveTable";
import EmployeeLeaveOverview from "./charts/EmployeeLeaveOverview";

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
      <EmployeeLeaveOverview balances={visibleBalances} leaves={leaves} />
      <LeaveTable leaves={leaves} role={role} currentEmployeeId={viewerEmployeeId} onCancel={() => undefined} />
    </div>
  );
}

