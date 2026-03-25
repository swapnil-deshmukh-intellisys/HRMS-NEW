import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "../../../components/common/ChartCard";
import type { LeaveBalance } from "../../../types";

type EmployeeLeaveBalanceChartProps = {
  balances: LeaveBalance[];
};

export default function EmployeeLeaveBalanceChart({ balances }: EmployeeLeaveBalanceChartProps) {
  const data = balances.map((balance) => ({
    type: balance.leaveType.code,
    remaining: balance.remainingDays,
    used: balance.usedDays,
  }));

  return (
    <ChartCard title="Leave balance by type" subtitle="Remaining and used leave days for each active leave type." hasData={data.length > 0}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="type" tickLine={false} axisLine={false} tick={{ fill: "#667085", fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#667085", fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="remaining" fill="#16a34a" radius={[6, 6, 0, 0]} />
          <Bar dataKey="used" fill="#2563eb" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
