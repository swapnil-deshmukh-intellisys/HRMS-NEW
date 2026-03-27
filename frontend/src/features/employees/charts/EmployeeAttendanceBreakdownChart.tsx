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

  return (
    <ChartCard title="Attendance breakdown" subtitle="Distribution across recorded attendance statuses." hasData={data.length > 0}>
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
    </ChartCard>
  );
}
