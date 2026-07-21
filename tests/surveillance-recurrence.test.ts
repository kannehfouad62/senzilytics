import assert from "node:assert/strict";
import test from "node:test";
import { addSurveillanceMonths } from "../src/modules/occupational-health/surveillance-recurrence";

test("surveillance recurrence preserves ordinary UTC calendar dates", () => {
  assert.equal(addSurveillanceMonths(new Date("2026-07-15T12:00:00.000Z"), 12).toISOString(), "2027-07-15T12:00:00.000Z");
});

test("surveillance recurrence clamps month-end dates", () => {
  assert.equal(addSurveillanceMonths(new Date("2026-01-31T12:00:00.000Z"), 1).toISOString(), "2026-02-28T12:00:00.000Z");
  assert.equal(addSurveillanceMonths(new Date("2027-01-31T12:00:00.000Z"), 13).toISOString(), "2028-02-29T12:00:00.000Z");
});
