import { useState } from "react";
import { Cell, Label, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from "recharts";
import ChartCard from "../../../components/common/ChartCard";
import type { Attendance } from "../../../types";
import "../EmployeeSnapshotCards.css";


type EmployeeAttendanceBreakdownChartProps = {
  attendance: Attendance[];
  monthlyAttendance: Array<{ status: Attendance["status"] }>;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export default function EmployeeAttendanceBreakdownChart({ attendance, monthlyAttendance }: EmployeeAttendanceBreakdownChartProps) {
  const [activeTab, setActiveTab] = useState<"all" | "month">("all");
  const [activeStatus, setActiveStatus] = useState<Attendance["status"] | null>(null);

  const currentData = activeTab === "all" ? attendance : monthlyAttendance;

  const counts = currentData.reduce<Record<Attendance["status"], number>>(
    (accumulator, record) => {
      if (accumulator[record.status] !== undefined) {
        accumulator[record.status] += 1;
      }
      return accumulator;
    },
    { PRESENT: 0, HALF_DAY: 0, ABSENT: 0, LEAVE: 0 },
  );

  const allStatuses = Object.entries(counts).map(([status, value]) => ({
    status: status as Attendance["status"],
    name: formatStatusName(status),
    value,
    color: STATUS_COLORS[status as Attendance["status"]],
  }));

  const data = allStatuses.filter((entry) => entry.value > 0);

  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  const pieActiveIndex = activeStatus ? data.findIndex(d => d.status === activeStatus) : -1;

  return (
    <ChartCard
      title="Attendance status split"
      subtitle="Present, half day, absent, and leave across recorded entries."
      hasData={true}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <div className="employee-snapshot-tabs">
          <button
            type="button"
            className={activeTab === "all" ? "employee-snapshot-tab active" : "employee-snapshot-tab"}
            onClick={() => {
              setActiveTab("all");
              setActiveStatus(null);
            }}
          >
            All-time
          </button>
          <button
            type="button"
            className={activeTab === "month" ? "employee-snapshot-tab active" : "employee-snapshot-tab"}
            onClick={() => {
              setActiveTab("month");
              setActiveStatus(null);
            }}
          >
            Selected Month
          </button>
        </div>
      </div>

      {currentData.length > 0 ? (
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
                  {...({
                    activeIndex: pieActiveIndex !== -1 ? pieActiveIndex : undefined,
                    activeShape: renderActiveShape,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  } as any)}
                  onMouseEnter={(_, index) => setActiveStatus(data[index]?.status || null)}
                  onMouseLeave={() => setActiveStatus(null)}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} style={{ outline: "none" }} />
                  ))}
                  <Label
                    content={() => {
                      const activeItem = data.find(d => d.status === activeStatus);
                      const labelTitle = activeItem ? activeItem.name : "Total Days";
                      const labelValue = activeItem ? `${activeItem.value}` : `${total}`;
                      const labelSub = activeItem
                        ? `${Math.round((activeItem.value / total) * 100)}%`
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
            {allStatuses.map((entry) => {
              const percentage = total > 0 ? Math.round((entry.value / total) * 100) : 0;
              const isActive = activeStatus === entry.status;

              return (
                <div
                  key={entry.name}
                  className="employee-snapshot-breakdown-chart__legend-row"
                  style={{
                    borderColor: isActive ? entry.color : undefined,
                    boxShadow: isActive ? "var(--shadow-md)" : undefined,
                    transform: isActive ? "translateY(-2px)" : undefined,
                    background: isActive ? "var(--color-surface-secondary)" : undefined,
                    opacity: entry.value === 0 ? 0.65 : 1,
                  }}
                  onMouseEnter={() => {
                    if (entry.value > 0) {
                      setActiveStatus(entry.status);
                    }
                  }}
                  onMouseLeave={() => setActiveStatus(null)}
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
      ) : (
        <div className="chart-card__empty" style={{ minHeight: '220px' }}>
          No data available for the selected month.
        </div>
      )}
    </ChartCard>
  );
}

