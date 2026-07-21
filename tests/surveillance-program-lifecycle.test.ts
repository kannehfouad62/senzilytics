import assert from "node:assert/strict";
import test from "node:test";
import { SurveillanceProgramStatus } from "@prisma/client";
import { getSurveillanceProgramNextStatuses, isSurveillanceProgramTransitionAllowed } from "../src/modules/occupational-health/surveillance-program-lifecycle";

test("surveillance programs follow a governed lifecycle", () => {
  assert.deepEqual(getSurveillanceProgramNextStatuses(SurveillanceProgramStatus.DRAFT), [SurveillanceProgramStatus.ACTIVE, SurveillanceProgramStatus.ARCHIVED]);
  assert.equal(isSurveillanceProgramTransitionAllowed(SurveillanceProgramStatus.ACTIVE, SurveillanceProgramStatus.PAUSED), true);
  assert.equal(isSurveillanceProgramTransitionAllowed(SurveillanceProgramStatus.PAUSED, SurveillanceProgramStatus.ACTIVE), true);
});

test("archived surveillance programs are terminal", () => {
  assert.deepEqual(getSurveillanceProgramNextStatuses(SurveillanceProgramStatus.ARCHIVED), []);
  assert.equal(isSurveillanceProgramTransitionAllowed(SurveillanceProgramStatus.ARCHIVED, SurveillanceProgramStatus.ACTIVE), false);
});
