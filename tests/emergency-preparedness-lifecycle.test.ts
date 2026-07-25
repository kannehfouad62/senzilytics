import assert from "node:assert/strict";
import test from "node:test";
import {
  EmergencyActivationStatus,
  EmergencyDrillRating,
  EmergencyDrillStatus,
  EmergencyImprovementStatus,
  EmergencyPlanStatus,
} from "@prisma/client";
import {
  assertEmergencyActivationTransition,
  assertEmergencyDrillTransition,
  assertEmergencyImprovementTransition,
  assertEmergencyPlanTransition,
  emergencyActivationNextStatuses,
  emergencyDrillCompletionIssues,
  emergencyPlanReadinessIssues,
  emergencyReadinessScore,
} from "../src/modules/emergency/emergency-lifecycle";

const now = new Date("2026-07-25T12:00:00.000Z");

test("emergency plans use a controlled approval lifecycle", () => {
  assert.doesNotThrow(() =>
    assertEmergencyPlanTransition(
      EmergencyPlanStatus.DRAFT,
      EmergencyPlanStatus.IN_REVIEW,
    ),
  );
  assert.doesNotThrow(() =>
    assertEmergencyPlanTransition(
      EmergencyPlanStatus.IN_REVIEW,
      EmergencyPlanStatus.ACTIVE,
    ),
  );
  assert.throws(() =>
    assertEmergencyPlanTransition(
      EmergencyPlanStatus.DRAFT,
      EmergencyPlanStatus.ACTIVE,
    ),
  );
  assert.throws(() =>
    assertEmergencyPlanTransition(
      EmergencyPlanStatus.ARCHIVED,
      EmergencyPlanStatus.ACTIVE,
    ),
  );
});

test("plan approval readiness requires credible content, scenarios, contacts, and future review", () => {
  const valid = {
    reviewDueAt: new Date("2027-07-25T12:00:00.000Z"),
    scope: "All personnel, contractors, and occupied operating areas.",
    hazardProfile: "Credible fire, medical, severe weather, and release scenarios.",
    commandStructure: "The incident commander directs accountable response roles.",
    communicationProcedure: "Approved alarms, radios, and external call trees are used.",
    evacuationProcedure: "Personnel follow marked routes to assigned muster locations.",
    accountabilityProcedure: "Supervisors reconcile rosters and report missing personnel.",
    recoveryCriteria: "Command documents stabilization before controlled stand-down.",
    activeScenarioCount: 2,
    activeContactCount: 3,
  };
  assert.deepEqual(emergencyPlanReadinessIssues(valid, now), []);
  const issues = emergencyPlanReadinessIssues({
    ...valid,
    reviewDueAt: now,
    activeScenarioCount: 0,
    activeContactCount: 1,
  }, now);
  assert.equal(issues.some((issue) => issue.includes("future")), true);
  assert.equal(issues.some((issue) => issue.includes("scenario")), true);
  assert.equal(issues.some((issue) => issue.includes("two active")), true);
});

test("drills and live activations reject lifecycle shortcuts", () => {
  assert.doesNotThrow(() =>
    assertEmergencyDrillTransition(
      EmergencyDrillStatus.PLANNED,
      EmergencyDrillStatus.IN_PROGRESS,
    ),
  );
  assert.throws(() =>
    assertEmergencyDrillTransition(
      EmergencyDrillStatus.PLANNED,
      EmergencyDrillStatus.COMPLETED,
    ),
  );
  assert.deepEqual(
    emergencyActivationNextStatuses(EmergencyActivationStatus.ACTIVE),
    [
      EmergencyActivationStatus.STABILIZED,
      EmergencyActivationStatus.STOOD_DOWN,
    ],
  );
  assert.doesNotThrow(() =>
    assertEmergencyActivationTransition(
      EmergencyActivationStatus.STOOD_DOWN,
      EmergencyActivationStatus.REVIEWED,
    ),
  );
  assert.throws(() =>
    assertEmergencyActivationTransition(
      EmergencyActivationStatus.ACTIVE,
      EmergencyActivationStatus.REVIEWED,
    ),
  );
});

test("exercise completion requires measurable and reviewable evidence", () => {
  const issues = emergencyDrillCompletionIssues({
    actualParticipants: 0,
    rating: null,
    strengths: "Too short",
    gaps: "",
    afterActionSummary: "Incomplete",
    alarmActivationSeconds: -1,
    evacuationSeconds: null,
    accountabilitySeconds: 90_000,
  });
  assert.ok(issues.length >= 6);
  assert.deepEqual(
    emergencyDrillCompletionIssues({
      actualParticipants: 12,
      rating: EmergencyDrillRating.EFFECTIVE,
      strengths: "Alarm recognition and accountability were prompt.",
      gaps: "Radio coverage requires improvement in the warehouse.",
      afterActionSummary: "The exercise met its core objectives and produced one tracked improvement.",
      alarmActivationSeconds: 20,
      evacuationSeconds: 310,
      accountabilitySeconds: 420,
    }),
    [],
  );
});

test("improvements require completion before independent verification", () => {
  assert.doesNotThrow(() =>
    assertEmergencyImprovementTransition(
      EmergencyImprovementStatus.IN_PROGRESS,
      EmergencyImprovementStatus.COMPLETED,
    ),
  );
  assert.throws(() =>
    assertEmergencyImprovementTransition(
      EmergencyImprovementStatus.OPEN,
      EmergencyImprovementStatus.VERIFIED,
    ),
  );
});

test("readiness score is transparent and bounded", () => {
  assert.equal(
    emergencyReadinessScore({
      status: EmergencyPlanStatus.ACTIVE,
      reviewDueAt: new Date("2027-07-25T12:00:00.000Z"),
      activeScenarioCount: 2,
      activeContactCount: 3,
      latestCompletedDrillAt: new Date("2026-06-01T12:00:00.000Z"),
      openCriticalImprovements: 0,
    }, now),
    100,
  );
  assert.equal(
    emergencyReadinessScore({
      status: EmergencyPlanStatus.DRAFT,
      reviewDueAt: new Date("2026-01-01T12:00:00.000Z"),
      activeScenarioCount: 0,
      activeContactCount: 0,
      latestCompletedDrillAt: null,
      openCriticalImprovements: 2,
    }, now),
    0,
  );
});
