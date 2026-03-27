import assert from "node:assert/strict";
import test from "node:test";
import { CalendarExceptionType } from "@prisma/client";
import { buildMonthCalendarDays, getCalendarDayStatus, shouldDeductSalaryForDate } from "./service.js";

test("getCalendarDayStatus marks sunday as off by default", () => {
  const result = getCalendarDayStatus(new Date(2026, 2, 29), []);

  assert.equal(result.status, "OFF");
  assert.equal(result.isWorkingDay, false);
});

test("getCalendarDayStatus marks saturday as working when overridden", () => {
  const saturday = new Date(2026, 2, 28);
  const result = getCalendarDayStatus(saturday, [
    {
      id: 1,
      date: saturday,
      type: CalendarExceptionType.WORKING_SATURDAY,
      name: "Release support",
      description: null,
    },
  ]);

  assert.equal(result.status, "WORKING_SATURDAY");
  assert.equal(result.isWorkingDay, true);
});

test("getCalendarDayStatus marks holiday as non-working paid day", () => {
  const holiday = new Date(2026, 2, 30);
  const result = getCalendarDayStatus(holiday, [
    {
      id: 2,
      date: holiday,
      type: CalendarExceptionType.HOLIDAY,
      name: "Festival",
      description: null,
    },
  ]);

  assert.equal(result.status, "HOLIDAY");
  assert.equal(result.isWorkingDay, false);
  assert.equal(result.isPaidDay, true);
});

test("buildMonthCalendarDays derives month day statuses from exceptions", () => {
  const days = buildMonthCalendarDays({
    year: 2026,
    month: 3,
    exceptions: [
      {
        id: 1,
        date: new Date(2026, 2, 14),
        type: CalendarExceptionType.WORKING_SATURDAY,
        name: "Working Saturday",
        description: null,
      },
      {
        id: 2,
        date: new Date(2026, 2, 23),
        type: CalendarExceptionType.HOLIDAY,
        name: "Special holiday",
        description: null,
      },
    ],
  });

  assert.equal(days.length, 31);
  assert.equal(days.find((day) => day.dayNumber === 14)?.status, "WORKING_SATURDAY");
  assert.equal(days.find((day) => day.dayNumber === 23)?.status, "HOLIDAY");
});

test("shouldDeductSalaryForDate only returns true for unattended working day without leave", () => {
  assert.equal(
    shouldDeductSalaryForDate({
      isWorkingDay: true,
      hasAttendance: false,
      hasApprovedLeave: false,
    }),
    true,
  );
  assert.equal(
    shouldDeductSalaryForDate({
      isWorkingDay: false,
      hasAttendance: false,
      hasApprovedLeave: false,
    }),
    false,
  );
});
