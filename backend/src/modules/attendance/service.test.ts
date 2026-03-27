import assert from "node:assert/strict";
import test from "node:test";
import { AttendanceStatus } from "@prisma/client";
import {
  buildApprovedLeaveWhereForAttendanceDate,
  calculateWorkedMinutes,
  combineAttendanceDateAndTime,
  finalizeAttendanceForDate,
  getRegularizedAttendanceStatus,
  parseAttendanceDateInput,
} from "./service.js";

test("parseAttendanceDateInput parses yyyy-mm-dd safely", () => {
  const parsed = parseAttendanceDateInput("2026-03-25");

  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 2);
  assert.equal(parsed.getDate(), 25);
  assert.equal(parsed.getHours(), 0);
});

test("buildApprovedLeaveWhereForAttendanceDate uses approved leave overlap", () => {
  const attendanceDate = new Date(2026, 2, 25);
  const where = buildApprovedLeaveWhereForAttendanceDate(attendanceDate);

  assert.equal(where.status, "APPROVED");
  assert.deepEqual(where.startDate, { lte: new Date(2026, 2, 25, 23, 59, 59, 999) });
  assert.deepEqual(where.endDate, { gte: new Date(2026, 2, 25, 0, 0, 0, 0) });
});

test("combineAttendanceDateAndTime merges date and time", () => {
  const combined = combineAttendanceDateAndTime(new Date(2026, 2, 25), "09:30");

  assert.equal(combined?.getFullYear(), 2026);
  assert.equal(combined?.getMonth(), 2);
  assert.equal(combined?.getDate(), 25);
  assert.equal(combined?.getHours(), 9);
  assert.equal(combined?.getMinutes(), 30);
});

test("attendance regularization helpers compute status and worked minutes", () => {
  const checkInTime = new Date(2026, 2, 25, 9, 0);
  const checkOutTime = new Date(2026, 2, 25, 17, 30);

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
        { id: 1, joiningDate: new Date(2026, 2, 20) },
        { id: 2, joiningDate: new Date(2026, 2, 20) },
        { id: 3, joiningDate: new Date(2026, 2, 26) },
        { id: 4, joiningDate: new Date(2026, 2, 20) },
      ],
      findEmployeeIdsWithAttendance: async () => [2],
      findEmployeeIdsWithApprovedLeave: async () => [4],
      createAbsentAttendances: async (entries) => {
        createdEntries.push(...entries);
        return entries.length;
      },
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
      findActiveEmployees: async () => [{ id: 1, joiningDate: new Date(2026, 2, 20) }],
      findEmployeeIdsWithAttendance: async () => [],
      findEmployeeIdsWithApprovedLeave: async () => [],
      createAbsentAttendances: async (entries) => {
        createdCount += entries.length;
        return entries.length;
      },
      isWorkingDay: async () => false,
    },
  );

  assert.equal(result.createdCount, 0);
  assert.equal(createdCount, 0);
});
