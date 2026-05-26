import { useState } from "react";
import { Cell, Label, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from "recharts";
import ChartCard from "../../../components/common/ChartCard";
import type { LeaveBalance, LeaveRequest } from "../../../types";
import { formatLeaveDays } from "../../../utils/format";
import "../EmployeeProfilePage.css";

type EmployeeLeaveOverviewProps = {
  balances: LeaveBalance[];
  leaves: LeaveRequest[];
};

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
          {entry.name}: {formatLeaveDays(entry.value)}
        </span>
      </div>
    );
  }
  return null;
}

function getLeaveTypeMeta(code: string) {
  const c = code.toUpperCase();
  if (c === "SL" || c.includes("SICK")) {
    return {
      color: "#10b981",
      classSuffix: "sl",
    };
  }
  if (c === "CL" || c.includes("CASUAL")) {
    return {
      color: "#3b82f6",
      classSuffix: "cl",
    };
  }
  if (c === "PL" || c === "AL" || c.includes("PRIVILEGE") || c.includes("ANNUAL") || c.includes("PAID")) {
    return {
      color: "#8b5cf6",
      classSuffix: "pl",
    };
  }
  return {
    color: "#f59e0b",
    classSuffix: "default",
  };
}

export default function EmployeeLeaveOverview({ balances, leaves }: EmployeeLeaveOverviewProps) {
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  // Helper helpers for financial quarter
  const getFinancialQuarterForDate = (date: Date) => {
    const month = date.getMonth();
    if (month >= 3 && month <= 5) return 1;
    if (month >= 6 && month <= 8) return 2;
    if (month >= 9 && month <= 11) return 3;
    return 4;
  };

  const getFinancialYearForDate = (date: Date) => {
    return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  };

  const currentDate = new Date();
  const currentQuarter = getFinancialQuarterForDate(currentDate);
  const currentFinYear = getFinancialYearForDate(currentDate);

  // 1. Calculations for visual donut split (strictly quarterly-focused)
  const availableDays = balances.reduce((total, b) => total + (b.visibleDays ?? b.remainingDays), 0);

  const usedPaidDays = balances.reduce((total, b) => {
    const isQuarterly = b.leaveType.allocationMode === "QUARTERLY" || b.leaveType.quarterlyAllocationDays != null;
    if (isQuarterly) {
      const quarterlyQuota = (b.leaveType.quarterlyAllocationDays ?? 0) + (b.carryForwardDays ?? 0);
      const remaining = b.visibleDays ?? b.remainingDays;
      return total + Math.max(0, quarterlyQuota - remaining);
    } else {
      return total + b.usedDays;
    }
  }, 0);

  const usedUnpaidDays = leaves.reduce((total, leave) => {
    if (!leave.startDate) return total;
    const leaveDate = new Date(leave.startDate);
    const leaveQuarter = getFinancialQuarterForDate(leaveDate);
    const leaveFinYear = getFinancialYearForDate(leaveDate);

    // Only count unpaid days for the current quarter and financial year
    if (leaveQuarter === currentQuarter && leaveFinYear === currentFinYear) {
      return total + (leave.unpaidDays ?? 0);
    }
    return total;
  }, 0);

  const totalQuota = availableDays + usedPaidDays;

  const chartData = [
    { name: "Available now", value: availableDays, color: "#10b981" },
    { name: "Paid leave used", value: usedPaidDays, color: "#3b82f6" },
    { name: "Unpaid leave used", value: usedUnpaidDays, color: "#ef4444" },
  ].filter((entry) => entry.value > 0);

  const hasChartData = chartData.length > 0;

  return (
    <ChartCard
      title="Leave Overview & Balances"
      subtitle="Unified summary of quarterly leave allocation, consumption, and category details."
      hasData={balances.length > 0 || leaves.length > 0}
    >
      <div className="employee-leave-overview">
        {/* Left Column: Visual Donut Chart */}
        <div className="employee-leave-overview__visual">
          {hasChartData ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={56}
                  outerRadius={82}
                  paddingAngle={3}
                  {...({
                    activeIndex: activeIndex !== -1 ? activeIndex : undefined,
                    activeShape: renderActiveShape,
                  } as any)}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(-1)}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} style={{ outline: "none" }} />
                  ))}
                  <Label
                    content={() => {
                      const isActive = activeIndex !== -1 && chartData[activeIndex];
                      const labelTitle = isActive ? chartData[activeIndex].name : "Total Quota";
                      const labelValue = isActive
                        ? formatLeaveDays(chartData[activeIndex].value)
                        : formatLeaveDays(totalQuota);
                      const labelSub = isActive
                        ? chartData[activeIndex].name === "Unpaid leave used"
                          ? "Unpaid Days"
                          : `${totalQuota > 0 ? Math.round((chartData[activeIndex].value / totalQuota) * 100) : 0}% of Quota`
                        : "Paid / Quarter";

                      return (
                        <text
                          x="50%"
                          y="50%"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          style={{ pointerEvents: "none" }}
                        >
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
          ) : (
            <div className="muted" style={{ fontSize: "13px", padding: "40px 0" }}>
              No leave records found
            </div>
          )}
        </div>

        {/* Right Column: Progressive Leave Category Details */}
        <div className="employee-leave-overview__details">
          {balances.map((balance) => {
            const meta = getLeaveTypeMeta(balance.leaveType.code);
            const remaining = balance.visibleDays ?? balance.remainingDays;
            
            const isQuarterly = balance.leaveType.allocationMode === "QUARTERLY" || balance.leaveType.quarterlyAllocationDays != null;
            const quota = isQuarterly
              ? (balance.leaveType.quarterlyAllocationDays ?? 0) + (balance.carryForwardDays ?? 0)
              : balance.allocatedDays;
            const used = isQuarterly
              ? Math.max(0, quota - remaining)
              : balance.usedDays;
            
            const percentUsed = quota > 0 ? Math.min(100, Math.max(0, (used / quota) * 100)) : 0;

            return (
              <div key={balance.id} className="employee-leave-progress-card">
                <div className="employee-leave-progress-card__header">
                  <div className="employee-leave-progress-card__title-row">
                    <span className="employee-leave-progress-card__name">
                      {balance.leaveType.name}
                    </span>
                    <span className={`employee-leave-progress-card__badge employee-leave-progress-card__badge--${meta.classSuffix}`}>
                      {balance.leaveType.code}
                    </span>
                  </div>
                  <span className="employee-leave-progress-card__usage">
                    {formatLeaveDays(used)} <span>/ {formatLeaveDays(quota)} Used</span>
                  </span>
                </div>

                <div className="employee-leave-progress-card__track">
                  <span
                    className="employee-leave-progress-card__fill"
                    style={{
                      width: `${percentUsed}%`,
                      backgroundColor: meta.color,
                    }}
                  />
                </div>

                <div className="employee-leave-progress-card__available-row">
                  <span className="employee-leave-progress-card__available-val">{formatLeaveDays(remaining)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ChartCard>
  );
}
