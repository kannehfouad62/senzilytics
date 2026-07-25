import assert from "node:assert/strict";
import test from "node:test";
import {
  PredictiveSignalDirection,
  PredictiveSignalReviewDecision,
  PredictiveSignalStatus,
  RiskLevel,
} from "@prisma/client";
import {
  assertPredictiveReview,
  assessDeterioratingTrend,
  calculateAttentionScore,
  reviewDecisionStatus,
} from "../src/modules/intelligence/predictive-intelligence";

test("trend detection requires governed evidence count and deterioration", () => {
  const detected = assessDeterioratingTrend({
    current: 8,
    baseline: 4,
    minimumEventCount: 3,
    deteriorationThresholdPercent: 20,
  });
  assert.equal(detected.detected, true);
  assert.equal(detected.direction, PredictiveSignalDirection.DETERIORATING);
  assert.equal(detected.changePercent, 100);

  const tooLittleEvidence = assessDeterioratingTrend({
    current: 2,
    baseline: 1,
    minimumEventCount: 3,
    deteriorationThresholdPercent: 20,
  });
  assert.equal(tooLittleEvidence.detected, false);
});

test("zero baseline is handled without an infinite trend", () => {
  const trend = assessDeterioratingTrend({
    current: 4,
    baseline: 0,
    minimumEventCount: 3,
    deteriorationThresholdPercent: 20,
  });
  assert.equal(trend.changePercent, 100);
  assert.equal(trend.detected, true);
});

test("attention score is bounded and severity sensitive", () => {
  const high = calculateAttentionScore({
    severity: RiskLevel.CRITICAL,
    current: 10,
    threshold: 3,
    changePercent: 180,
    dataQualityScore: 100,
  });
  const medium = calculateAttentionScore({
    severity: RiskLevel.MEDIUM,
    current: 3,
    threshold: 3,
    changePercent: 20,
    dataQualityScore: 70,
  });
  assert.ok(high <= 100);
  assert.ok(high > medium);
});

test("reviews require a rationale and cannot resolve an active condition", () => {
  assert.throws(
    () =>
      assertPredictiveReview({
        decision: PredictiveSignalReviewDecision.ACKNOWLEDGE,
        rationale: "short",
        conditionActive: true,
      }),
    /at least 10 characters/,
  );
  assert.throws(
    () =>
      assertPredictiveReview({
        decision: PredictiveSignalReviewDecision.RESOLVE,
        rationale: "Reviewed source records and confirmed closure.",
        conditionActive: true,
      }),
    /still active/,
  );
  assert.doesNotThrow(() =>
    assertPredictiveReview({
      decision: PredictiveSignalReviewDecision.RESOLVE,
      rationale: "Reviewed source records and confirmed closure.",
      conditionActive: false,
    }),
  );
});

test("review decisions map to controlled statuses", () => {
  assert.equal(
    reviewDecisionStatus(PredictiveSignalReviewDecision.MONITOR),
    PredictiveSignalStatus.MONITORING,
  );
  assert.equal(
    reviewDecisionStatus(PredictiveSignalReviewDecision.DISMISS),
    PredictiveSignalStatus.DISMISSED,
  );
});
