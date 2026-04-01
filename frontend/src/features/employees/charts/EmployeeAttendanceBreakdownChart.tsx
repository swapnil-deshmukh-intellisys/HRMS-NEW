import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import ChartCard from "../../../components/common/ChartCard";
import type { Attendance } from "../../../types";

type EmployeeAttendanceBreakdownChartProps = {
  attendance: Attendance[];
};

const STATUS_COLORS: Record<Attendance["status"], string> = {
  PRESENT: "#16a34a",
  HALF_DAY: "#2563eb",
  ABSENT: "#ef4444",
  LEAVE: "#f59e0b",
};

export default function EmployeeAttendanceBreakdownChart({ attendance }: EmployeeAttendanceBreakdownChartProps) {
  const counts = attendance.reduce<Record<Attendance["status"], number>>(
    (accumulator, record) => {
      accumulator[record.status] += 1;
      return accumulator;
    },
    { PRESENT: 0, HALF_DAY: 0, ABSENT: 0, LEAVE: 0 },
  );

  const data = Object.entries(counts)
    .map(([status, value]) => ({ name: status.replace("_", " "), value, color: STATUS_COLORS[status as Attendance["status"]] }))
    .filter((entry) => entry.value > 0);
  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <ChartCard title="Attendance status split" subtitle="Present, half day, absent, and leave across recorded entries." hasData={data.length > 0}>
      <div className="employee-snapshot-breakdown-chart">
        <div className="employee-snapshot-breakdown-chart__visual">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={56} outerRadius={82} paddingAngle={3}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="employee-snapshot-breakdown-chart__legend" aria-label="Attendance status counts">
          {data.map((entry) => {
            const percentage = total > 0 ? Math.round((entry.value / total) * 100) : 0;

            return (
              <div key={entry.name} className="employee-snapshot-breakdown-chart__legend-row">
                <div className="employee-snapshot-breakdown-chart__legend-label">
                  <span
                    className="employee-snapshot-breakdown-chart__dot"
                    style={{ backgroundColor: entry.color }}
                    aria-hidden="true"
                  />
                  <span>{entry.name}</span>
                </div>
                <div className="employee-snapshot-breakdown-chart__legend-value">
                  <strong>{entry.value}</strong>
                  <span>{percentage}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ChartCard>
  );
}
