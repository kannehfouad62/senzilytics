import assert from "node:assert/strict";
import test from "node:test";
import {
  buildComplianceMonthGrid,
  complianceCalendarWeekdayForDay,
} from "../src/modules/compliance/compliance-calendar-grid";

test("calendar month grid aligns dates with their UTC weekdays", () => {
  const august = buildComplianceMonthGrid(
    new Date("2026-08-01T00:00:00.000Z"),
  );

  assert.equal(august.length, 42);
  assert.deepEqual(august.slice(0, 7), [null, null, null, null, null, null, 1]);
  assert.equal(complianceCalendarWeekdayForDay(
    new Date("2026-08-01T00:00:00.000Z"),
    1,
  ), "Saturday");
});

test("calendar grid does not add unnecessary weeks", () => {
  const february = buildComplianceMonthGrid(
    new Date("2026-02-01T00:00:00.000Z"),
  );

  assert.equal(february.length, 28);
  assert.equal(february[0], 1);
  assert.equal(february[27], 28);
});
