import assert from "node:assert/strict";
import test from "node:test";
import { AttendanceStatus } from "@prisma/client";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import {
  buildApprovedLeaveWhereForAttendanceDate,
  buildAttendanceWhereForDate,
  calculateWorkedMinutes,
  combineAttendanceDateAndTime,
  finalizeAttendanceForDate,
  getRegularizedAttendanceStatus,
  parseAttendanceDateInput,
} from "./service.js";

test("parseAttendanceDateInput parses yyyy-mm-dd safely", () => {
  const parsed = parseAttendanceDateInput("2026-03-25");
  const zoned = toZonedTime(parsed, "Asia/Kolkata");

  assert.equal(zoned.getFullYear(), 2026);
  assert.equal(zoned.getMonth(), 2);
  assert.equal(zoned.getDate(), 25);
  assert.equal(zoned.getHours(), 0);
});

test("buildApprovedLeaveWhereForAttendanceDate uses approved leave overlap", () => {
  const attendanceDate = fromZonedTime("2026-03-25 12:00:00", "Asia/Kolkata");
  const where = buildApprovedLeaveWhereForAttendanceDate(attendanceDate);

  assert.equal(where.status, "APPROVED");
  assert.deepEqual(where.startDate, { lte: fromZonedTime("2026-03-25 23:59:59.999", "Asia/Kolkata") });
  assert.deepEqual(where.endDate, { gte: fromZonedTime("2026-03-25 00:00:00.000", "Asia/Kolkata") });
});

test("buildAttendanceWhereForDate covers the full local day", () => {
  const attendanceDate = fromZonedTime("2026-03-25 14:45:00", "Asia/Kolkata");
  const where = buildAttendanceWhereForDate(attendanceDate);

  assert.deepEqual(where, {
    gte: fromZonedTime("2026-03-25 00:00:00.000", "Asia/Kolkata"),
    lte: fromZonedTime("2026-03-25 23:59:59.999", "Asia/Kolkata"),
  });
});

test("combineAttendanceDateAndTime merges date and time", () => {
  const baseDate = fromZonedTime("2026-03-25 00:00:00", "Asia/Kolkata");
  const combined = combineAttendanceDateAndTime(baseDate, "09:30");
  const zoned = toZonedTime(combined!, "Asia/Kolkata");

  assert.equal(zoned.getFullYear(), 2026);
  assert.equal(zoned.getMonth(), 2);
  assert.equal(zoned.getDate(), 25);
  assert.equal(zoned.getHours(), 9);
  assert.equal(zoned.getMinutes(), 30);
});

test("attendance regularization helpers compute status and worked minutes", () => {
  const checkInTime = fromZonedTime("2026-03-25 09:00:00", "Asia/Kolkata");
  const checkOutTime = fromZonedTime("2026-03-25 17:30:00", "Asia/Kolkata");

  assert.equal(calculateWorkedMinutes(checkInTime, checkOutTime), 510);
  assert.equal(getRegularizedAttendanceStatus(checkInTime, checkOutTime), AttendanceStatus.PRESENT);
  assert.equal(getRegularizedAttendanceStatus(checkInTime, null), AttendanceStatus.HALF_DAY);
});

test("finalizeAttendanceForDate creates absent records only for eligible employees", async () => {
  const createdEntries: Array<{ employeeId: number; attendanceDate: Date; status: AttendanceStatus }> = [];

  const result = await finalizeAttendanceForDate(
    { date: "2026-03-25" },
    {
      findActiveEmployees: async () => [
        { id: 1, joiningDate: fromZonedTime("2026-03-20 00:00:00", "Asia/Kolkata") },
        { id: 2, joiningDate: fromZonedTime("2026-03-20 00:00:00", "Asia/Kolkata") },
        { id: 3, joiningDate: fromZonedTime("2026-03-26 00:00:00", "Asia/Kolkata") },
        { id: 4, joiningDate: fromZonedTime("2026-03-20 00:00:00", "Asia/Kolkata") },
      ],
      findEmployeeIdsWithAttendance: async () => [2],
      findEmployeeIdsWithApprovedLeave: async () => [4],
      createAbsentAttendances: async (entries) => {
        createdEntries.push(...entries);
        return entries.length;
      },
      updateAttendanceWithMissingCheckout: async () => 0,
    },
  );

  assert.equal(result.createdCount, 1);
  assert.equal(createdEntries.length, 1);
  assert.equal(createdEntries[0]?.employeeId, 1);
  assert.equal(createdEntries[0]?.status, AttendanceStatus.ABSENT);
});

test("finalizeAttendanceForDate skips non-working days", async () => {
  let createdCount = 0;

  const result = await finalizeAttendanceForDate(
    { date: "2026-03-29" },
    {
      findActiveEmployees: async () => [{ id: 1, joiningDate: fromZonedTime("2026-03-20 00:00:00", "Asia/Kolkata") }],
      findEmployeeIdsWithAttendance: async () => [],
      findEmployeeIdsWithApprovedLeave: async () => [],
      createAbsentAttendances: async (entries) => {
        createdCount += entries.length;
        return entries.length;
      },
      updateAttendanceWithMissingCheckout: async () => 0,
      isWorkingDay: async () => false,
    },
  );

  assert.equal(result.createdCount, 0);
  assert.equal(createdCount, 0);
});
