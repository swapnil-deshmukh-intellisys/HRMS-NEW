import "./EmployeeSnapshotCards.css";
import { useMemo, useState } from "react";
import type { Attendance } from "../../types";
import { formatAttendanceTime } from "../../utils/format";

type EmployeeAttendanceSnapshotCardProps = {
  attendance: Attendance[];
};

type AttendanceSnapshotTab = "today" | "week";

function formatWorkedDuration(workedMinutes?: number) {
  if (!workedMinutes || workedMinutes <= 0) {
    return "0m";
  }

  const hours = Math.floor(workedMinutes / 60);
  const minutes = workedMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

function getProgressPercentage(workedMinutes?: number) {
  if (!workedMinutes || workedMinutes <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((workedMinutes / 480) * 100));
}

export default function EmployeeAttendanceSnapshotCard({ attendance }: EmployeeAttendanceSnapshotCardProps) {
  const [activeTab, setActiveTab] = useState<AttendanceSnapshotTab>("today");

  const todayRecord = attendance.find((record) => {
    const date = new Date(record.attendanceDate);
    const today = new Date();
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  });

  const weeklyRecords = useMemo(() => attendance.slice(0, 7), [attendance]);
  const weeklyPresentDays = weeklyRecords.filter((record) => record.status === "PRESENT").length;
  const completedWeeklyRecords = weeklyRecords.filter((record) => record.checkOutTime);
  const averageWeeklyMinutes = completedWeeklyRecords.length
    ? Math.round(completedWeeklyRecords.reduce((total, record) => total + record.workedMinutes, 0) / completedWeeklyRecords.length)
    : 0;

  return (
    <article className="card employee-snapshot-card">
      <div className="employee-snapshot-card__header">
        <div>
          <p className="eyebrow">Attendance snapshot</p>
          <h3>Daily attendance</h3>
        </div>
        <div className="employee-snapshot-tabs">
          <button
            type="button"
            className={activeTab === "today" ? "employee-snapshot-tab active" : "employee-snapshot-tab"}
            onClick={() => setActiveTab("today")}
          >
            Today
          </button>
          <button
            type="button"
            className={activeTab === "week" ? "employee-snapshot-tab active" : "employee-snapshot-tab"}
            onClick={() => setActiveTab("week")}
          >
            Week
          </button>
        </div>
      </div>

      {activeTab === "today" ? (
        <div className="employee-snapshot-card__body">
          <div className="employee-snapshot-stat">
            <span className="employee-snapshot-stat__label">Worked today</span>
            <strong>{todayRecord?.checkOutTime ? formatWorkedDuration(todayRecord.workedMinutes) : todayRecord?.checkInTime ? "In progress" : "Not marked"}</strong>
            <p className="muted">
              {todayRecord?.checkOutTime
                ? `Checked out ${formatAttendanceTime(todayRecord.checkOutTime)}`
                : todayRecord?.checkInTime
                  ? `Checked in ${formatAttendanceTime(todayRecord.checkInTime)}`
                  : "No attendance recorded for today"}
            </p>
          </div>
          <div className="employee-snapshot-progress">
            <div className="employee-snapshot-progress__meta">
              <span>Shift target</span>
              <span>{todayRecord?.checkOutTime ? `${getProgressPercentage(todayRecord.workedMinutes)}% of 8h` : "0% of 8h"}</span>
            </div>
            <div className="employee-snapshot-progress__track">
              <span
                className="employee-snapshot-progress__fill employee-snapshot-progress__fill--attendance"
                style={{ width: `${todayRecord?.checkOutTime ? getProgressPercentage(todayRecord.workedMinutes) : 0}%` }}
              />
            </div>
          </div>
          <div className="employee-snapshot-mini-grid">
            <div className="employee-snapshot-mini-card">
              <span className="employee-snapshot-mini-card__label">Status</span>
              <strong>{todayRecord?.status ?? "PENDING"}</strong>
            </div>
            <div className="employee-snapshot-mini-card">
              <span className="employee-snapshot-mini-card__label">Check in</span>
              <strong>{todayRecord?.checkInTime ? formatAttendanceTime(todayRecord.checkInTime) : "-"}</strong>
            </div>
          </div>
        </div>
      ) : (
        <div className="employee-snapshot-card__body">
          <div className="employee-snapshot-mini-grid">
            <div className="employee-snapshot-mini-card">
              <span className="employee-snapshot-mini-card__label">Present days</span>
              <strong>{weeklyPresentDays}</strong>
            </div>
            <div className="employee-snapshot-mini-card">
              <span className="employee-snapshot-mini-card__label">Average hours</span>
              <strong>{formatWorkedDuration(averageWeeklyMinutes)}</strong>
            </div>
          </div>
          <div className="employee-snapshot-week-bars">
            {weeklyRecords.length ? (
              weeklyRecords
                .slice()
                .reverse()
                .map((record) => {
                  const height = record.checkOutTime ? Math.max(20, Math.min(100, Math.round((record.workedMinutes / 480) * 100))) : 14;
                  return (
                    <div key={record.id} className="employee-snapshot-week-bar">
                      <span
                        className={`employee-snapshot-week-bar__fill employee-snapshot-week-bar__fill--${record.status.toLowerCase().replace(/_/g, "-")}`}
                        style={{ height: `${height}%` }}
                      />
                      <small>{new Date(record.attendanceDate).toLocaleDateString(undefined, { weekday: "short" })}</small>
                    </div>
                  );
                })
            ) : (
              <p className="muted">No recent attendance trend available yet.</p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
