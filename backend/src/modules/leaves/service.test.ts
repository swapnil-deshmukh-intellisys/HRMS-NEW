import assert from "node:assert/strict";
import test from "node:test";
import { AttendanceStatus } from "@prisma/client";
import { AppError } from "../../utils/api.js";
import { buildApprovedLeaveAttendanceEntries, buildLeaveOverlapWhere, createLeaveRequestForEmployee, hasAttendanceConflict } from "./service.js";

test("buildLeaveOverlapWhere includes pending and approved statuses", () => {
  const where = buildLeaveOverlapWhere(1, new Date("2026-03-20"), new Date("2026-03-22"));
  assert.deepEqual(where.status, { in: ["PENDING", "APPROVED"] });
  assert.equal(where.employeeId, 1);
});

test("createLeaveRequestForEmployee rejects overlap", async () => {
  await assert.rejects(
    () =>
      createLeaveRequestForEmployee(
        {
          actor: { id: 1, role: "EMPLOYEE", employeeId: 99, email: "user@test.com" },
          leaveTypeId: 1,
          startDate: "2026-03-20",
          endDate: "2026-03-21",
          startDayDuration: "FULL_DAY",
          endDayDuration: "FULL_DAY",
          reason: "Trip",
        },
        {
          findOverlap: async () => ({ id: 1 }),
          findLeaveBalance: async () => ({ remainingDays: 10 }),
          createLeaveRequest: async () => ({ id: 10 }),
        },
      ),
    (error: unknown) => error instanceof AppError && error.message === "Overlapping leave request already exists",
  );
});

test("createLeaveRequestForEmployee converts excess days to unpaid leave", async () => {
  const created = await createLeaveRequestForEmployee(
    {
      actor: { id: 1, role: "EMPLOYEE", employeeId: 99, email: "user@test.com" },
      leaveTypeId: 1,
      startDate: "2026-03-20",
      endDate: "2026-03-25",
      startDayDuration: "FULL_DAY",
      endDayDuration: "FULL_DAY",
      reason: "Trip",
    },
    {
      findOverlap: async () => null,
      findLeaveBalance: async () => ({ remainingDays: 2 }),
      createLeaveRequest: async (payload) => payload,
    },
  );

  assert.equal((created as { totalDays: number }).totalDays, 6);
  assert.equal((created as { paidDays: number }).paidDays, 2);
  assert.equal((created as { unpaidDays: number }).unpaidDays, 4);
  assert.equal((created as { isUnpaid: boolean }).isUnpaid, true);
});

test("createLeaveRequestForEmployee creates fully unpaid leave when no balance exists", async () => {
  const created = await createLeaveRequestForEmployee(
    {
      actor: { id: 1, role: "EMPLOYEE", employeeId: 99, email: "user@test.com" },
      leaveTypeId: 1,
      startDate: "2026-03-20",
      endDate: "2026-03-21",
      startDayDuration: "FULL_DAY",
      endDayDuration: "FULL_DAY",
      reason: "Trip",
    },
    {
      findOverlap: async () => null,
      findLeaveBalance: async () => null,
      createLeaveRequest: async (payload) => payload,
    },
  );

  assert.equal((created as { paidDays: number }).paidDays, 0);
  assert.equal((created as { unpaidDays: number }).unpaidDays, 2);
  assert.equal((created as { isUnpaid: boolean }).isUnpaid, true);
});

test("createLeaveRequestForEmployee creates request when rules pass", async () => {
  const created = await createLeaveRequestForEmployee(
    {
      actor: { id: 1, role: "EMPLOYEE", employeeId: 99, email: "user@test.com" },
      leaveTypeId: 1,
      startDate: "2026-03-20",
      endDate: "2026-03-21",
      startDayDuration: "FULL_DAY",
      endDayDuration: "FULL_DAY",
      reason: "Trip",
    },
    {
      findOverlap: async () => null,
      findLeaveBalance: async () => ({ remainingDays: 10 }),
      createLeaveRequest: async (payload) => payload,
    },
  );

  assert.equal((created as { totalDays: number }).totalDays, 2);
  assert.equal((created as { paidDays: number }).paidDays, 2);
  assert.equal((created as { unpaidDays: number }).unpaidDays, 0);
  assert.equal((created as { isUnpaid: boolean }).isUnpaid, false);
});

test("createLeaveRequestForEmployee creates half-day leave for a single date", async () => {
  const created = await createLeaveRequestForEmployee(
    {
      actor: { id: 1, role: "EMPLOYEE", employeeId: 99, email: "user@test.com" },
      leaveTypeId: 1,
      startDate: "2026-03-20",
      endDate: "2026-03-20",
      startDayDuration: "HALF_DAY",
      endDayDuration: "HALF_DAY",
      reason: "Doctor visit",
    },
    {
      findOverlap: async () => null,
      findLeaveBalance: async () => ({ remainingDays: 10 }),
      createLeaveRequest: async (payload) => payload,
    },
  );

  assert.equal((created as { totalDays: number }).totalDays, 0.5);
  assert.equal((created as { paidDays: number }).paidDays, 0.5);
  assert.equal((created as { unpaidDays: number }).unpaidDays, 0);
});

test("createLeaveRequestForEmployee supports start and end day half leave for ranges", async () => {
  const created = await createLeaveRequestForEmployee(
    {
      actor: { id: 1, role: "EMPLOYEE", employeeId: 99, email: "user@test.com" },
      leaveTypeId: 1,
      startDate: "2026-03-20",
      endDate: "2026-03-22",
      startDayDuration: "HALF_DAY",
      endDayDuration: "HALF_DAY",
      reason: "Doctor visit",
    },
    {
      findOverlap: async () => null,
      findLeaveBalance: async () => ({ remainingDays: 10 }),
      createLeaveRequest: async (payload) => payload,
    },
  );

  assert.equal((created as { totalDays: number }).totalDays, 2);
});

test("createLeaveRequestForEmployee rejects mismatched single-date day durations", async () => {
  await assert.rejects(
    () =>
      createLeaveRequestForEmployee(
        {
          actor: { id: 1, role: "EMPLOYEE", employeeId: 99, email: "user@test.com" },
          leaveTypeId: 1,
          startDate: "2026-03-20",
          endDate: "2026-03-20",
          startDayDuration: "FULL_DAY",
          endDayDuration: "HALF_DAY",
          reason: "Doctor visit",
        },
        {
          findOverlap: async () => null,
          findLeaveBalance: async () => ({ remainingDays: 10 }),
          createLeaveRequest: async (payload) => payload,
        },
      ),
    (error: unknown) => error instanceof AppError && error.message === "For a single-date leave, start and end day duration must match",
  );
});

test("buildApprovedLeaveAttendanceEntries maps single full-day leave to LEAVE", () => {
  const entries = buildApprovedLeaveAttendanceEntries({
    startDate: new Date("2026-03-20"),
    endDate: new Date("2026-03-20"),
    startDayDuration: "FULL_DAY",
    endDayDuration: "FULL_DAY",
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.status, AttendanceStatus.LEAVE);
});

test("buildApprovedLeaveAttendanceEntries maps range endpoints to HALF_DAY when needed", () => {
  const entries = buildApprovedLeaveAttendanceEntries({
    startDate: new Date("2026-03-20"),
    endDate: new Date("2026-03-22"),
    startDayDuration: "HALF_DAY",
    endDayDuration: "HALF_DAY",
  });

  assert.equal(entries.length, 3);
  assert.equal(entries[0]?.status, AttendanceStatus.HALF_DAY);
  assert.equal(entries[1]?.status, AttendanceStatus.LEAVE);
  assert.equal(entries[2]?.status, AttendanceStatus.HALF_DAY);
});

test("hasAttendanceConflict detects worked attendance", () => {
  assert.equal(hasAttendanceConflict({ workedMinutes: 10 }), true);
  assert.equal(hasAttendanceConflict({ checkInTime: new Date(), workedMinutes: 0 }), true);
  assert.equal(hasAttendanceConflict({ checkOutTime: new Date(), workedMinutes: 0 }), true);
  assert.equal(hasAttendanceConflict({ workedMinutes: 0 }), false);
  assert.equal(hasAttendanceConflict(null), false);
});
