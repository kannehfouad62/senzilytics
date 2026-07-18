import assert from "node:assert/strict";
import test from "node:test";
import { EnterpriseAuditFrequency } from "@prisma/client";
import {
  advanceAuditScheduleDate,
  calculateInitialNextRunAt,
} from "../src/modules/audit/audit-schedule-recurrence";

test("monthly recurrence clamps to the final day of a shorter month", () => {
  const result = advanceAuditScheduleDate(
    new Date(2028, 0, 31, 12),
    EnterpriseAuditFrequency.MONTHLY,
    1
  );

  assert.equal(result?.getFullYear(), 2028);
  assert.equal(result?.getMonth(), 1);
  assert.equal(result?.getDate(), 29);
});

test("one-time schedules do not recur", () => {
  assert.equal(
    advanceAuditScheduleDate(
      new Date(2028, 0, 1),
      EnterpriseAuditFrequency.ONE_TIME,
      1
    ),
    null
  );
});

test("initial next run advances past elapsed occurrences", () => {
  const result = calculateInitialNextRunAt({
    startDate: new Date(2028, 0, 1, 12),
    frequency: EnterpriseAuditFrequency.MONTHLY,
    intervalValue: 1,
    now: new Date(2028, 2, 15, 12),
  });

  assert.equal(result?.getFullYear(), 2028);
  assert.equal(result?.getMonth(), 3);
  assert.equal(result?.getDate(), 1);
});

test("initial next run respects the schedule end date", () => {
  const result = calculateInitialNextRunAt({
    startDate: new Date(2028, 0, 1, 12),
    endDate: new Date(2028, 1, 1, 12),
    frequency: EnterpriseAuditFrequency.MONTHLY,
    intervalValue: 1,
    now: new Date(2028, 2, 15, 12),
  });

  assert.equal(result, null);
});
