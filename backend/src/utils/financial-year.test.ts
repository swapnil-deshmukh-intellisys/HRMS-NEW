import assert from "node:assert/strict";
import test from "node:test";
import { getFinancialQuarterForDate, getFinancialYearBounds, getFinancialYearForDate } from "./financial-year.js";

test("getFinancialYearForDate maps Jan to Mar into previous financial year", () => {
  assert.equal(getFinancialYearForDate(new Date("2027-01-15")), 2026);
  assert.equal(getFinancialYearForDate(new Date("2027-03-31")), 2026);
  assert.equal(getFinancialYearForDate(new Date("2027-04-01")), 2027);
});

test("getFinancialQuarterForDate uses Apr to Mar quarter boundaries", () => {
  assert.equal(getFinancialQuarterForDate(new Date("2026-04-01")), 1);
  assert.equal(getFinancialQuarterForDate(new Date("2026-08-10")), 2);
  assert.equal(getFinancialQuarterForDate(new Date("2026-11-05")), 3);
  assert.equal(getFinancialQuarterForDate(new Date("2027-02-14")), 4);
});

test("getFinancialYearBounds returns Apr 1 to next Apr 1", () => {
  const bounds = getFinancialYearBounds(2026);

  assert.equal(bounds.start.toISOString(), "2026-04-01T00:00:00.000Z");
  assert.equal(bounds.endExclusive.toISOString(), "2027-04-01T00:00:00.000Z");
});
