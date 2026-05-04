import Table from "../../components/common/Table";
import type { Attendance, CalendarException } from "../../types";
import { formatAttendanceTime, formatDateLabel, formatWeekday, isToday } from "../../utils/format";
import EmployeeAttendanceBreakdownChart from "./charts/EmployeeAttendanceBreakdownChart";
import EmployeeWorkedHoursChart from "./charts/EmployeeWorkedHoursChart";
import { useApp } from "../../context/useApp";
import { useMemo, useState } from "react";

type EmployeeAttendanceTabProps = {
  attendance: Attendance[];
  exceptions?: CalendarException[];
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

  if (record.status === "SCHEDULED") {
    return "-";
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

function getStatusClass(status: Attendance["status"] | "OFF" | "HOLIDAY" | "WORKING_SATURDAY" | "SCHEDULED") {
  const normalizedStatus = status === "WORKING_SATURDAY" ? "working-saturday" : status.toLowerCase().replace(/_/g, "-");
  return `status-pill status-pill--${normalizedStatus}`;
}

function getStatusLabel(record: Attendance | { status: string; leaveTypeCode?: string }) {
  const status = record.status;
  if (status === "WORKING_SATURDAY") return "Working Saturday";
  if (status === "OFF") return "Off Day";
  if (status === "HOLIDAY") return "Public Holiday";
  if (status === "SCHEDULED") return "Scheduled";
  
  const baseLabel = status === "HALF_DAY" ? "Half day" : status.charAt(0) + status.slice(1).toLowerCase();

  if (record.leaveTypeCode && (status === "LEAVE" || status === "HALF_DAY")) {
    return `${baseLabel} (${record.leaveTypeCode})`;
  }

  return baseLabel;
}

export default function EmployeeAttendanceTab({ attendance, exceptions }: EmployeeAttendanceTabProps) {
  const { calendarExceptions: globalExceptions } = useApp();
  const calendarExceptions = exceptions || globalExceptions;
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearsArray = [];
    for (let i = currentYear; i >= currentYear - 2; i--) {
      yearsArray.push(i);
    }
    return yearsArray;
  }, []);

  const unifiedHistory = useMemo(() => {
    const today = new Date();
    // Start of the selected month
    const startOfSelectedMonth = new Date(selectedYear, selectedMonth, 1);
    // End of the selected month (Day 0 of next month is last day of current)
    const endOfSelectedMonth = new Date(selectedYear, selectedMonth + 1, 0);
    
    // If selecting current month, only show up to today
    const limitDate = (selectedMonth === today.getMonth() && selectedYear === today.getFullYear()) 
      ? today 
      : endOfSelectedMonth;

    const dates: Date[] = [];
    const current = new Date(startOfSelectedMonth);
    while (current <= limitDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    dates.reverse();

    return dates.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      const existingRecord = attendance.find(a => a.attendanceDate.startsWith(dateStr));
      
      // Use robust local date comparison for exceptions to avoid timezone shifts
      const exception = calendarExceptions.find(ex => {
        const exDate = new Date(ex.date);
        return exDate.getFullYear() === date.getFullYear() &&
               exDate.getMonth() === date.getMonth() &&
               exDate.getDate() === date.getDate();
      });
      const dayOfWeek = date.getDay();
      
      let status: any = "ABSENT";
      let isOffDay = false;
      let label = "";

      if (exception) {
        status = exception.type;
        label = exception.name || "";
      } else if (dayOfWeek === 0 || dayOfWeek === 6) {
        status = "OFF";
        isOffDay = true;
      }

      // If it's today and there's no check-in yet, don't mark as ABSENT.
      // We'll call it "SCHEDULED" for the UI.
      const now = new Date();
      const isActuallyToday = date.getFullYear() === now.getFullYear() &&
                              date.getMonth() === now.getMonth() &&
                              date.getDate() === now.getDate();
                              
      if (isActuallyToday && status === "ABSENT" && !existingRecord) {
        status = "SCHEDULED";
      }

      // If there is an exception (Holiday/Working Saturday), it should take visual precedence 
      // over a generic "ABSENT" record.
      const finalStatus = (exception && existingRecord?.status === "ABSENT") 
        ? status 
        : (existingRecord ? existingRecord.status : status);

      return {
        date: date.toISOString(),
        record: existingRecord,
        status: finalStatus,
        isOffDay: !existingRecord && (status === "OFF" || status === "HOLIDAY"),
        isWorkingSaturday: status === "WORKING_SATURDAY",
        exceptionLabel: label
      };
    });
  }, [attendance, calendarExceptions, selectedMonth, selectedYear]);

  const { presentCount, absentCount, offCount, workingDaysCount } = useMemo(() => {
    let present = 0;
    let absent = 0;
    let off = 0;
    let working = 0;

    unifiedHistory.forEach(item => {
      const isHoliday = item.status === "HOLIDAY";
      const isOff = item.status === "OFF";

      if (isHoliday || isOff) {
        off++;
      } else {
        working++;
        if (item.record && (item.record.status === "PRESENT" || item.record.status === "HALF_DAY")) {
          present++;
        } else if (item.status === "ABSENT" || (item.record && item.record.status === "ABSENT")) {
          absent++;
        }
      }
    });

    return { presentCount: present, absentCount: absent, offCount: off, workingDaysCount: working };
  }, [unifiedHistory]);

  return (
    <div className="stack">
      <div className="card employee-profile-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <h3 style={{ margin: 0 }}>Attendance history</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="month-selector-dropdown"
              style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: '600', color: '#1e293b', background: '#f8fafc', cursor: 'pointer', outline: 'none' }}
            >
              {months.map((name, index) => (
                <option key={name} value={index}>{name}</option>
              ))}
            </select>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="month-selector-dropdown"
              style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: '600', color: '#1e293b', background: '#f8fafc', cursor: 'pointer', outline: 'none' }}
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Monthly Summary Bar */}
        <div style={{ display: 'flex', gap: '16px', padding: '12px 16px', background: '#f1f5f9', borderRadius: '10px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Working Days</span>
            <span style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>{workingDaysCount}</span>
          </div>
          <div style={{ width: '1px', background: '#cbd5e1' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Present</span>
            <span style={{ fontSize: '16px', fontWeight: '700', color: '#10b981' }}>{presentCount}</span>
          </div>
          <div style={{ width: '1px', background: '#cbd5e1' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Absent</span>
            <span style={{ fontSize: '16px', fontWeight: '700', color: '#ef4444' }}>{absentCount}</span>
          </div>
          <div style={{ width: '1px', background: '#cbd5e1' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Off Days</span>
            <span style={{ fontSize: '16px', fontWeight: '700', color: '#64748b' }}>{offCount}</span>
          </div>
        </div>

        <Table
          compact
          columns={["Date", "Check in", "Check out", "Worked duration", "Today's update", "Status"]}
          getRowClassName={(index) => {
            const item = unifiedHistory[index];
            if (item.status === "HOLIDAY") return "attendance-row--holiday";
            if (item.status === "OFF") return "attendance-row--off";
            return "";
          }}
          rows={unifiedHistory.map((item) => {
            const { date, record, status, isOffDay, isWorkingSaturday, exceptionLabel } = item;
            
            if (isOffDay) {
              return [
                <div className="table-cell-stack" key={`date-${date}`}>
                  <span className="table-cell-primary">{formatDateLabel(date)}</span>
                  <span className="table-cell-secondary">{formatWeekday(date)}</span>
                </div>,
                "-",
                "-",
                "-",
                <span key={`update-${date}`} className="muted" style={{ fontSize: '12px', fontStyle: 'italic' }}>
                  {exceptionLabel || "Weekend"}
                </span>,
                <div className="table-cell-stack" key={`status-${date}`}>
                  <span className={getStatusClass(status)}>{getStatusLabel({ status })}</span>
                </div>,
              ];
            }

            // Normal record or Working Saturday with missing record
            const displayRecord = record || ({ 
              id: 0, 
              attendanceDate: date, 
              status: status,
              checkInTime: null,
              checkOutTime: null,
              workedMinutes: 0
            } as any);

            return [
              <div className="table-cell-stack" key={`date-${date}`}>
                <span className="table-cell-primary">{isToday(date) ? "Today" : formatDateLabel(date)}</span>
                <span className="table-cell-secondary">{formatWeekday(date)}</span>
              </div>,
              displayRecord.status === "LEAVE" ? "-" : formatAttendanceTime(displayRecord.checkInTime),
              displayRecord.status === "LEAVE" ? "-" : formatAttendanceTime(displayRecord.checkOutTime),
              renderWorkedDuration(displayRecord),
              <span key={`update-${date}`} className="muted" style={{ fontSize: '12px', maxWidth: '180px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={displayRecord.todaysUpdate ?? ""}>
                {displayRecord.todaysUpdate || (isWorkingSaturday ? "Working Weekend" : "-")}
              </span>,
              <div className="table-cell-stack" key={`status-${date}`}>
                <span className={getStatusClass(status)}>
                  {getStatusLabel(record || { status })}
                </span>
              </div>,
            ];
          })}
        />
      </div>
      <div className="grid cols-2 employee-profile-chart-grid">
        <EmployeeAttendanceBreakdownChart attendance={attendance} />
        <EmployeeWorkedHoursChart attendance={attendance} />
      </div>
    </div>
  );
}
