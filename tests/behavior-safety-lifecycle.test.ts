import assert from "node:assert/strict";
import test from "node:test";
import { BehaviorObservationOutcome, BehaviorProgramStatus } from "@prisma/client";
import { canTransitionBehaviorProgram, summarizeBehaviorResults } from "../src/modules/behavior-safety/behavior-safety-lifecycle";

test("behavior programs use a controlled lifecycle", () => {
  assert.equal(canTransitionBehaviorProgram(BehaviorProgramStatus.DRAFT, BehaviorProgramStatus.ACTIVE), true);
  assert.equal(canTransitionBehaviorProgram(BehaviorProgramStatus.ACTIVE, BehaviorProgramStatus.ACTIVE), false);
  assert.equal(canTransitionBehaviorProgram(BehaviorProgramStatus.ACTIVE, BehaviorProgramStatus.DRAFT), false);
  assert.equal(canTransitionBehaviorProgram(BehaviorProgramStatus.ARCHIVED, BehaviorProgramStatus.ACTIVE), false);
});

test("at-risk and critical behavior summaries are deterministic", () => {
  assert.deepEqual(summarizeBehaviorResults([
    { outcome: BehaviorObservationOutcome.SAFE, isCritical: false },
    { outcome: BehaviorObservationOutcome.AT_RISK, isCritical: true },
    { outcome: BehaviorObservationOutcome.NOT_OBSERVED, isCritical: false },
  ]), { safeCount: 1, atRiskCount: 1, criticalAtRiskCount: 1, overallOutcome: BehaviorObservationOutcome.AT_RISK });
});

test("sessions with only safe results remain positive leading indicators", () => {
  assert.equal(summarizeBehaviorResults([{ outcome: BehaviorObservationOutcome.SAFE, isCritical: true }]).overallOutcome, BehaviorObservationOutcome.SAFE);
});
