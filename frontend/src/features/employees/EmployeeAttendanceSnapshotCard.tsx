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

function getStartOfWorkWeek(referenceDate: Date) {
  const start = new Date(referenceDate);
  const day = start.getDay();
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + offsetToMonday);
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getAttendanceStatusLabel(record: Attendance) {
  if (record.status === "HALF_DAY" && record.leaveTypeCode) {
    return `Half day (${record.leaveTypeCode})`;
  }

  if (record.status === "LEAVE" && record.leaveTypeCode) {
    return `Leave (${record.leaveTypeCode})`;
  }

  if (record.status === "HALF_DAY") {
    return "Half day";
  }

  return record.status.charAt(0) + record.status.slice(1).toLowerCase();
}

export default function EmployeeAttendanceSnapshotCard({ attendance }: EmployeeAttendanceSnapshotCardProps) {
  const [activeTab, setActiveTab] = useState<AttendanceSnapshotTab>("today");

  const sortedAttendance = useMemo(
    () =>
      [...attendance].sort(
        (left, right) => new Date(right.attendanceDate).getTime() - new Date(left.attendanceDate).getTime(),
      ),
    [attendance],
  );

  const todayRecord = sortedAttendance.find((record) => {
    const date = new Date(record.attendanceDate);
    const today = new Date();
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  });

  const weeklyRecords = useMemo(() => {
    const referenceDate = sortedAttendance.length ? new Date(sortedAttendance[0].attendanceDate) : new Date();
    const startOfWeek = getStartOfWorkWeek(referenceDate);
    const saturday = new Date(startOfWeek);
    saturday.setDate(startOfWeek.getDate() + 5);

    const recordsByDate = new Map(
      sortedAttendance.map((record) => [formatDateKey(new Date(record.attendanceDate)), record]),
    );

    const weekDates = Array.from({ length: 5 }, (_, index) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + index);
      return date;
    });

    const saturdayKey = formatDateKey(saturday);
    if (recordsByDate.has(saturdayKey)) {
      weekDates.push(saturday);
    }

    return weekDates
      .map((date) => recordsByDate.get(formatDateKey(date)))
      .filter((record): record is Attendance => Boolean(record));
  }, [sortedAttendance]);
  const weeklyPresentDays = weeklyRecords.filter((record) => record.status === "PRESENT").length;
  const weeklyHalfDays = weeklyRecords.filter((record) => record.status === "HALF_DAY").length;
  const weeklyLeaveDays = weeklyRecords.filter((record) => record.status === "LEAVE").length;
  const weeklyAbsentDays = weeklyRecords.filter((record) => record.status === "ABSENT").length;
  const completedWeeklyRecords = weeklyRecords.filter((record) => record.checkOutTime);
  const averageWeeklyMinutes = completedWeeklyRecords.length
    ? Math.round(completedWeeklyRecords.reduce((total, record) => total + record.workedMinutes, 0) / completedWeeklyRecords.length)
    : 0;
  const todayStatusLabel =
    todayRecord?.status === "HALF_DAY" && todayRecord.leaveTypeCode
      ? `Half day (${todayRecord.leaveTypeCode})`
      : todayRecord?.status === "LEAVE" && todayRecord.leaveTypeCode
        ? `Leave (${todayRecord.leaveTypeCode})`
        : todayRecord?.status ?? "PENDING";

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
              <strong>{todayStatusLabel}</strong>
            </div>
            <div className="employee-snapshot-mini-card">
              <span className="employee-snapshot-mini-card__label">Check in</span>
              <strong>{todayRecord?.checkInTime ? formatAttendanceTime(todayRecord.checkInTime) : "-"}</strong>
            </div>
          </div>
        </div>
      ) : (
        <div className="employee-snapshot-card__body">
          <div className="employee-snapshot-week-summary">
            <div className="employee-snapshot-breakdown">
              <div className="employee-snapshot-breakdown__row">
                <span>Present days</span>
                <strong>{weeklyPresentDays}</strong>
              </div>
              <div className="employee-snapshot-breakdown__row">
                <span>Half days</span>
                <strong>{weeklyHalfDays}</strong>
              </div>
              <div className="employee-snapshot-breakdown__row">
                <span>Leave days</span>
                <strong>{weeklyLeaveDays}</strong>
              </div>
              <div className="employee-snapshot-breakdown__row">
                <span>Absent days</span>
                <strong>{weeklyAbsentDays}</strong>
              </div>
            </div>
            <div className="employee-snapshot-week-highlight">
              <span className="employee-snapshot-mini-card__label">Average working time</span>
              <strong>{formatWorkedDuration(averageWeeklyMinutes)}</strong>
              <span className="muted">
                {completedWeeklyRecords.length
                  ? `Across ${completedWeeklyRecords.length} completed day${completedWeeklyRecords.length === 1 ? "" : "s"}`
                  : "No completed workdays yet"}
              </span>
            </div>
          </div>
          <div className="employee-snapshot-week-list">
            {weeklyRecords.length ? (
              weeklyRecords
                .slice()
                .reverse()
                .map((record) => {
                  const workedLabel =
                    record.status === "PRESENT" || record.status === "HALF_DAY"
                      ? formatWorkedDuration(record.workedMinutes)
                      : getAttendanceStatusLabel(record);

                  return (
                    <div key={record.id} className="employee-snapshot-week-list__row">
                      <div className="employee-snapshot-week-list__day">
                        <strong>{new Date(record.attendanceDate).toLocaleDateString(undefined, { weekday: "short" })}</strong>
                        <span>{new Date(record.attendanceDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                      </div>
                      <div className="employee-snapshot-week-list__meta">
                        <strong>{workedLabel}</strong>
                        {(record.status === "PRESENT" || record.status === "HALF_DAY") && record.checkInTime ? (
                          <span>
                            {formatAttendanceTime(record.checkInTime)}
                            {record.checkOutTime ? ` to ${formatAttendanceTime(record.checkOutTime)}` : ""}
                          </span>
                        ) : null}
                      </div>
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
