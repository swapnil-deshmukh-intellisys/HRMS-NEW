import { CalendarExceptionType } from "@prisma/client";
import { endOfDay, startOfDay } from "../../utils/dates.js";

export type CalendarExceptionRecord = {
  id: number;
  date: Date;
  type: CalendarExceptionType;
  name?: string | null;
  description?: string | null;
};

export type CalendarDayStatus = "WORKING" | "OFF" | "HOLIDAY" | "WORKING_SATURDAY";

export function isSunday(date: Date) {
  return startOfDay(date).getDay() === 0;
}

export function isSaturday(date: Date) {
  return startOfDay(date).getDay() === 6;
}

export function getCalendarExceptionForDate(date: Date, exceptions: CalendarExceptionRecord[]) {
  const target = startOfDay(date).getTime();
  return exceptions.find((exception) => startOfDay(exception.date).getTime() === target) ?? null;
}

export function getCalendarDayStatus(date: Date, exceptions: CalendarExceptionRecord[]) {
  const normalizedDate = startOfDay(date);
  const calendarException = getCalendarExceptionForDate(normalizedDate, exceptions);

  if (calendarException?.type === CalendarExceptionType.HOLIDAY) {
    return {
      status: "HOLIDAY" as const,
      exception: calendarException,
      isWorkingDay: false,
      isPaidDay: true,
    };
  }

  if (isSaturday(normalizedDate) && calendarException?.type === CalendarExceptionType.WORKING_SATURDAY) {
    return {
      status: "WORKING_SATURDAY" as const,
      exception: calendarException,
      isWorkingDay: true,
      isPaidDay: true,
    };
  }

  if (isSunday(normalizedDate) || isSaturday(normalizedDate)) {
    return {
      status: "OFF" as const,
      exception: null,
      isWorkingDay: false,
      isPaidDay: true,
    };
  }

  return {
    status: "WORKING" as const,
    exception: null,
    isWorkingDay: true,
    isPaidDay: true,
  };
}

export type CalendarLeaveRecord = {
  id: number;
  employeeId: number;
  employee: { firstName: string; lastName: string };
  startDate: Date;
  endDate: Date;
};

export function buildMonthCalendarDays(params: {
  year: number;
  month: number;
  exceptions: CalendarExceptionRecord[];
  leaves?: CalendarLeaveRecord[];
}) {
  const { year, month, exceptions, leaves = [] } = params;
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = endOfDay(new Date(year, month, 0));
  const days: Array<{
    date: Date;
    dayNumber: number;
    weekday: number;
    status: CalendarDayStatus;
    isWorkingDay: boolean;
    isPaidDay: boolean;
    exception: CalendarExceptionRecord | null;
    leaves: CalendarLeaveRecord[];
  }> = [];

  const cursor = startOfDay(firstDay);

  while (cursor <= lastDay) {
    const result = getCalendarDayStatus(cursor, exceptions);
    
    // Find leaves that overlap with this date
    const dayLeaves = leaves.filter(leave => {
      const leaveStart = startOfDay(leave.startDate);
      const leaveEnd = startOfDay(leave.endDate);
      return cursor >= leaveStart && cursor <= leaveEnd;
    });

    days.push({
      date: new Date(cursor),
      dayNumber: cursor.getDate(),
      weekday: cursor.getDay(),
      status: result.status,
      isWorkingDay: result.isWorkingDay,
      isPaidDay: result.isPaidDay,
      exception: result.exception,
      leaves: dayLeaves,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

export function shouldDeductSalaryForDate(input: {
  isWorkingDay: boolean;
  hasAttendance: boolean;
  hasApprovedLeave: boolean;
}) {
  return input.isWorkingDay && !input.hasAttendance && !input.hasApprovedLeave;
}
