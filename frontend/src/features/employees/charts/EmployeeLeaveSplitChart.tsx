import { Cell, Label, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import ChartCard from "../../../components/common/ChartCard";
import type { LeaveRequest } from "../../../types";
import { formatLeaveDays } from "../../../utils/format";

type EmployeeLeaveSplitChartProps = {
  leaves: LeaveRequest[];
};

export default function EmployeeLeaveSplitChart({ leaves }: EmployeeLeaveSplitChartProps) {
  const paidDays = leaves.reduce((total, leave) => total + leave.paidDays, 0);
  const unpaidDays = leaves.reduce((total, leave) => total + leave.unpaidDays, 0);
  const totalDays = paidDays + unpaidDays;
  const data = [
    { name: "Paid", value: paidDays, color: "#2563eb" },
    { name: "Unpaid", value: unpaidDays, color: "#dc2626" },
  ].filter((entry) => entry.value > 0);

  return (
    <ChartCard title="Paid vs unpaid leave" subtitle="Approved and requested leave split across paid and unpaid days." hasData={data.length > 0}>
      <div className="employee-leave-split-chart">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={56} outerRadius={82} paddingAngle={3}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
              <Label
                content={() => (
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                    <tspan x="50%" dy="-8" fill="#667085" fontSize="12">
                      Total leave
                    </tspan>
                    <tspan x="50%" dy="20" fill="#0f172a" fontSize="18" fontWeight="700">
                      {formatLeaveDays(totalDays)}
                    </tspan>
                  </text>
                )}
                position="center"
              />
            </Pie>
            <Tooltip formatter={(value) => formatLeaveDays(typeof value === "number" ? value : 0)} />
          </PieChart>
        </ResponsiveContainer>
        <div className="employee-leave-split-legend">
          {data.map((entry) => (
            <div key={entry.name} className="employee-leave-split-legend__item">
              <span className="employee-leave-split-legend__dot" style={{ backgroundColor: entry.color }} />
              <div className="employee-leave-split-legend__copy">
                <span>{entry.name}</span>
                <strong>{formatLeaveDays(entry.value)}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}
