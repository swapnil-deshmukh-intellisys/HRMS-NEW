import { useState } from "react";
import { Cell, Label, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from "recharts";
import ChartCard from "../../../components/common/ChartCard";
import type { Attendance } from "../../../types";
import "../EmployeeSnapshotCards.css";


type EmployeeAttendanceBreakdownChartProps = {
  attendance: Attendance[];
};

const STATUS_COLORS: Record<Attendance["status"], string> = {
  PRESENT: "#10b981",  // Premium emerald green
  HALF_DAY: "#3b82f6", // Premium brand blue
  ABSENT: "#ef4444",   // Premium rose red
  LEAVE: "#f59e0b",    // Premium amber orange
};

const STATUS_LABELS: Record<Attendance["status"], string> = {
  PRESENT: "Present",
  HALF_DAY: "Half Day",
  ABSENT: "Absent",
  LEAVE: "Leave",
};

function formatStatusName(status: string) {
  const custom = STATUS_LABELS[status as Attendance["status"]];
  if (custom) return custom;
  return status
    .replace(/_/g, " ")
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;

  return (
    <g>
      {/* Outer tactile glow sector */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      {/* Subtle inner accent ring */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={innerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.3}
      />
    </g>
  );
};

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const entry = payload[0].payload;
    return (
      <div
        style={{
          background: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid var(--color-border-default)",
          padding: "8px 12px",
          borderRadius: "12px",
          boxShadow: "var(--shadow-md)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: entry.color,
            display: "inline-block",
          }}
        />
        <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--color-text-strong)" }}>
          {entry.name}: {entry.value} {entry.value === 1 ? "Day" : "Days"}
        </span>
      </div>
    );
  }
  return null;
}

export default function EmployeeAttendanceBreakdownChart({ attendance }: EmployeeAttendanceBreakdownChartProps) {
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const counts = attendance.reduce<Record<Attendance["status"], number>>(
    (accumulator, record) => {
      accumulator[record.status] += 1;
      return accumulator;
    },
    { PRESENT: 0, HALF_DAY: 0, ABSENT: 0, LEAVE: 0 },
  );

  const data = Object.entries(counts)
    .map(([status, value]) => ({
      status: status as Attendance["status"],
      name: formatStatusName(status),
      value,
      color: STATUS_COLORS[status as Attendance["status"]],
    }))
    .filter((entry) => entry.value > 0);

  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <ChartCard
      title="Attendance status split"
      subtitle="Present, half day, absent, and leave across recorded entries."
      hasData={data.length > 0}
    >
      <div className="employee-snapshot-breakdown-chart">
        <div className="employee-snapshot-breakdown-chart__visual">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={56}
                outerRadius={82}
                paddingAngle={3}
                activeIndex={activeIndex !== -1 ? activeIndex : undefined as any}
                activeShape={renderActiveShape as any}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(-1)}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} style={{ outline: "none" }} />
                ))}
                <Label
                  content={() => {
                    const isActive = activeIndex !== -1 && data[activeIndex];
                    const labelTitle = isActive ? data[activeIndex].name : "Total Days";
                    const labelValue = isActive ? `${data[activeIndex].value}` : `${total}`;
                    const labelSub = isActive
                      ? `${Math.round((data[activeIndex].value / total) * 100)}%`
                      : "Recorded";

                    return (
                      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: "none" }}>
                        <tspan
                          x="50%"
                          dy="-12"
                          fill="var(--color-text-secondary)"
                          fontSize="11"
                          fontWeight="600"
                          letterSpacing="0.05em"
                          style={{ textTransform: "uppercase" }}
                        >
                          {labelTitle}
                        </tspan>
                        <tspan
                          x="50%"
                          dy="22"
                          fill="var(--color-text-strong)"
                          fontSize="22"
                          fontWeight="700"
                        >
                          {labelValue}
                        </tspan>
                        <tspan
                          x="50%"
                          dy="16"
                          fill="var(--color-text-secondary)"
                          fontSize="11"
                          fontWeight="500"
                        >
                          {labelSub}
                        </tspan>
                      </text>
                    );
                  }}
                  position="center"
                />
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="employee-snapshot-breakdown-chart__legend" aria-label="Attendance status counts">
          {data.map((entry, index) => {
            const percentage = total > 0 ? Math.round((entry.value / total) * 100) : 0;
            const isActive = activeIndex === index;

            return (
              <div
                key={entry.name}
                className="employee-snapshot-breakdown-chart__legend-row"
                style={{
                  borderColor: isActive ? entry.color : undefined,
                  boxShadow: isActive ? "var(--shadow-md)" : undefined,
                  transform: isActive ? "translateY(-2px)" : undefined,
                  background: isActive ? "var(--color-surface-secondary)" : undefined,
                }}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(-1)}
              >
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

