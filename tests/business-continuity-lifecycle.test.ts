import assert from "node:assert/strict";
import test from "node:test";
import {
  ContinuityActivationStatus,
  ContinuityCriticality,
  ContinuityExerciseResult,
  ContinuityExerciseStatus,
  ContinuityImprovementStatus,
  ContinuityPlanStatus,
} from "@prisma/client";
import {
  assertContinuityActivationTransition,
  assertContinuityExerciseTransition,
  assertContinuityImprovementTransition,
  assertContinuityPlanTransition,
  businessImpactObjectiveIssues,
  continuityExerciseCompletionIssues,
  continuityPlanReadinessIssues,
  continuityReadinessScore,
} from "../src/modules/continuity/continuity-lifecycle";

test("continuity plan governance prevents approval bypass", () => {
  assert.doesNotThrow(() => assertContinuityPlanTransition(ContinuityPlanStatus.DRAFT, ContinuityPlanStatus.IN_REVIEW));
  assert.doesNotThrow(() => assertContinuityPlanTransition(ContinuityPlanStatus.IN_REVIEW, ContinuityPlanStatus.ACTIVE));
  assert.throws(() => assertContinuityPlanTransition(ContinuityPlanStatus.DRAFT, ContinuityPlanStatus.ACTIVE), /cannot move/);
});

test("BIA recovery objectives must nest inside MTPD and RTO", () => {
  const valid = businessImpactObjectiveIssues({
    maximumTolerableDowntimeHours: 24,
    recoveryTimeObjectiveHours: 8,
    recoveryPointObjectiveHours: 2,
    minimumStaff: 3,
    operationalImpact: "Operations stop and customer commitments cannot be fulfilled.",
    minimumResources: "Three trained staff, the ERP platform, alternate workspace and phones.",
    recoveryStrategy: "Fail over technology and transfer the team to the alternate workspace.",
    workaroundProcedure: "Use the approved manual register while the primary platform is restored.",
  });
  assert.deepEqual(valid, []);
  const invalid = businessImpactObjectiveIssues({
    maximumTolerableDowntimeHours: 8,
    recoveryTimeObjectiveHours: 12,
    recoveryPointObjectiveHours: 14,
    minimumStaff: 0,
    operationalImpact: "Short",
    minimumResources: "Short",
    recoveryStrategy: "Short",
    workaroundProcedure: "Short",
  });
  assert.ok(invalid.length >= 7);
});

test("plan readiness requires a current, substantive plan and high-priority BIA", () => {
  const text = "A documented controlled recovery procedure with accountable ownership.";
  assert.deepEqual(continuityPlanReadinessIssues({
    reviewDueAt: new Date("2030-01-01T00:00:00Z"),
    scope: text,
    criticalActivitiesSummary: text,
    activationCriteria: text,
    governanceStructure: text,
    communicationStrategy: text,
    alternateWorkStrategy: text,
    technologyRecoveryStrategy: text,
    manualWorkarounds: text,
    recoveryPriorities: text,
    activeAnalysisCount: 1,
    highCriticalityAnalysisCount: 1,
    invalidAnalysisCount: 0,
  }, new Date("2029-01-01T00:00:00Z")), []);
  const issues = continuityPlanReadinessIssues({
    reviewDueAt: new Date("2028-01-01T00:00:00Z"),
    scope: "",
    criticalActivitiesSummary: "",
    activationCriteria: "",
    governanceStructure: "",
    communicationStrategy: "",
    alternateWorkStrategy: "",
    technologyRecoveryStrategy: "",
    manualWorkarounds: "",
    recoveryPriorities: "",
    activeAnalysisCount: 0,
    highCriticalityAnalysisCount: 0,
    invalidAnalysisCount: 1,
  }, new Date("2029-01-01T00:00:00Z"));
  assert.ok(issues.length >= 13);
});

test("exercise, activation and improvement lifecycles reject skipped controls", () => {
  assert.doesNotThrow(() => assertContinuityExerciseTransition(ContinuityExerciseStatus.PLANNED, ContinuityExerciseStatus.IN_PROGRESS));
  assert.throws(() => assertContinuityExerciseTransition(ContinuityExerciseStatus.PLANNED, ContinuityExerciseStatus.COMPLETED), /cannot move/);
  assert.deepEqual(continuityExerciseCompletionIssues({
    actualParticipants: 4,
    result: ContinuityExerciseResult.MET_OBJECTIVES,
    strengths: "Recovery roles were clear.",
    gaps: "Supplier escalation needs a backup.",
    afterActionSummary: "The exercise met objectives and identified one supplier escalation gap.",
    actualRecoveryTimeHours: 4,
    actualRecoveryPointHours: 1,
  }), []);
  assert.doesNotThrow(() => assertContinuityActivationTransition(ContinuityActivationStatus.ACTIVE, ContinuityActivationStatus.RESTORED));
  assert.throws(() => assertContinuityActivationTransition(ContinuityActivationStatus.ACTIVE, ContinuityActivationStatus.CLOSED), /cannot move/);
  assert.doesNotThrow(() => assertContinuityImprovementTransition(ContinuityImprovementStatus.COMPLETED, ContinuityImprovementStatus.VERIFIED));
  assert.throws(() => assertContinuityImprovementTransition(ContinuityImprovementStatus.OPEN, ContinuityImprovementStatus.VERIFIED), /cannot move/);
});

test("readiness score rewards governed, tested recovery capability", () => {
  assert.equal(continuityReadinessScore({
    status: ContinuityPlanStatus.ACTIVE,
    reviewDueAt: new Date("2030-01-01T00:00:00Z"),
    activeAnalysisCount: 2,
    allObjectivesValid: true,
    unresolvedSinglePointFailures: 0,
    latestCompletedExerciseAt: new Date("2029-06-01T00:00:00Z"),
    overdueCriticalImprovements: 0,
  }, new Date("2029-07-01T00:00:00Z")), 100);
  assert.equal(ContinuityCriticality.TIER_0_CRITICAL, "TIER_0_CRITICAL");
});
