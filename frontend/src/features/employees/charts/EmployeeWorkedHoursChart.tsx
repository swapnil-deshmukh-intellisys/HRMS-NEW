import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "../../../components/common/ChartCard";
import type { Attendance } from "../../../types";

type EmployeeWorkedHoursChartProps = {
  attendance: Attendance[];
};

export default function EmployeeWorkedHoursChart({ attendance }: EmployeeWorkedHoursChartProps) {
  const data = attendance
    .filter((record) => record.checkOutTime)
    .slice(0, 7)
    .reverse()
    .map((record) => ({
      label: new Date(record.attendanceDate).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      hours: record.workedMinutes / 60,
      minutes: record.workedMinutes,
    }));

  return (
    <ChartCard title="Worked hours trend" subtitle="Recent completed attendance days." hasData={data.length > 0}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#667085", fontSize: 12 }} />
          <YAxis 
            tickFormatter={(val) => {
              const h = Math.floor(val);
              const m = Math.round((val - h) * 60);
              return m > 0 ? `${h}h ${m}m` : `${h}h`;
            }}
            tickLine={false} 
            axisLine={false} 
            tick={{ fill: "#667085", fontSize: 12 }} 
          />
          <Tooltip 
            formatter={(value: number, name: string, props: any) => {
              const mins = props.payload.minutes;
              const h = Math.floor(mins / 60);
              const m = mins % 60;
              return [`${h}h ${m}m`, "Worked"];
            }}
          />
          <Line type="monotone" dataKey="hours" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
