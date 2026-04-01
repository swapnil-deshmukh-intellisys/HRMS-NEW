import Table from "../../components/common/Table";
import type { Attendance } from "../../types";
import { formatAttendanceTime, formatDateLabel, formatWeekday, isToday } from "../../utils/format";
import EmployeeAttendanceBreakdownChart from "./charts/EmployeeAttendanceBreakdownChart";
import EmployeeWorkedHoursChart from "./charts/EmployeeWorkedHoursChart";

type EmployeeAttendanceTabProps = {
  attendance: Attendance[];
};

function formatWorkedDuration(workedMinutes: number, checkOutTime?: string | null) {
  if (!checkOutTime) {
    return "-";
  }

  if (!workedMinutes || workedMinutes <= 0) {
    return "-";
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

function getWorkedDurationLabel(record: Attendance) {
  if (record.status === "LEAVE") {
    return "-";
  }

  if (record.status === "ABSENT") {
    return "Absent";
  }

  if (record.status === "HALF_DAY" && !record.checkInTime && !record.checkOutTime) {
    return "Half day";
  }

  if (record.checkOutTime) {
    return formatWorkedDuration(record.workedMinutes, record.checkOutTime);
  }

  return isToday(record.attendanceDate) ? "In progress" : "Checkout missing";
}

function renderWorkedDuration(record: Attendance) {
  const label = getWorkedDurationLabel(record);

  if (label === "Checkout missing") {
    return <span className="attendance-warning-text">{label}</span>;
  }

  return label;
}

function getStatusClass(status: Attendance["status"]) {
  return `status-pill status-pill--${status.toLowerCase().replace(/_/g, "-")}`;
}

function getStatusLabel(record: Attendance) {
  const baseLabel = record.status === "HALF_DAY" ? "Half day" : record.status.charAt(0) + record.status.slice(1).toLowerCase();

  if (record.leaveTypeCode && (record.status === "LEAVE" || record.status === "HALF_DAY")) {
    return `${baseLabel} (${record.leaveTypeCode})`;
  }

  return baseLabel;
}

export default function EmployeeAttendanceTab({ attendance }: EmployeeAttendanceTabProps) {
  return (
    <div className="stack">
      <div className="grid cols-2 employee-profile-chart-grid">
        <EmployeeAttendanceBreakdownChart attendance={attendance} />
        <EmployeeWorkedHoursChart attendance={attendance} />
      </div>
      <div className="card employee-profile-section">
        <h3>Attendance history</h3>
        <Table
          compact
          columns={["Date", "Check in", "Check out", "Worked duration", "Status"]}
          rows={attendance.map((record) => [
            <div className="table-cell-stack" key={`date-${record.id}`}>
              <span className="table-cell-primary">{isToday(record.attendanceDate) ? "Today" : formatDateLabel(record.attendanceDate)}</span>
              <span className="table-cell-secondary">
                {isToday(record.attendanceDate) ? formatDateLabel(record.attendanceDate) : formatWeekday(record.attendanceDate)}
              </span>
            </div>,
            record.status === "LEAVE" ? "-" : formatAttendanceTime(record.checkInTime),
            record.status === "LEAVE" ? "-" : formatAttendanceTime(record.checkOutTime),
            renderWorkedDuration(record),
            <div className="table-cell-stack" key={`status-${record.id}`}>
              <span className={getStatusClass(record.status)}>{getStatusLabel(record)}</span>
            </div>,
          ])}
        />
      </div>
    </div>
  );
}
