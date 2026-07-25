import {
  PredictiveSignalDirection,
  PredictiveSignalReviewDecision,
  PredictiveSignalStatus,
  RiskLevel,
} from "@prisma/client";

export type TrendAssessmentInput = {
  current: number;
  baseline: number;
  minimumEventCount: number;
  deteriorationThresholdPercent: number;
};

export function assessDeterioratingTrend(input: TrendAssessmentInput) {
  const changePercent =
    input.baseline === 0
      ? input.current > 0
        ? 100
        : 0
      : ((input.current - input.baseline) / input.baseline) * 100;
  const direction =
    changePercent >= input.deteriorationThresholdPercent
      ? PredictiveSignalDirection.DETERIORATING
      : changePercent <= -input.deteriorationThresholdPercent
        ? PredictiveSignalDirection.IMPROVING
        : PredictiveSignalDirection.STABLE;

  return {
    changePercent: round(changePercent),
    direction,
    detected:
      input.current >= input.minimumEventCount &&
      direction === PredictiveSignalDirection.DETERIORATING,
  };
}

export function calculateAttentionScore(input: {
  severity: RiskLevel;
  current: number;
  threshold: number;
  changePercent?: number | null;
  dataQualityScore: number;
}) {
  const severityWeight: Record<RiskLevel, number> = {
    LOW: 20,
    MEDIUM: 40,
    HIGH: 65,
    CRITICAL: 80,
  };
  const thresholdRatio =
    input.threshold > 0 ? Math.min(input.current / input.threshold, 2) : 1;
  const trendWeight = Math.min(Math.max(input.changePercent ?? 0, 0) / 100, 1);
  return round(
    Math.min(
      100,
      severityWeight[input.severity] +
        thresholdRatio * 8 +
        trendWeight * 7 +
        Math.max(0, Math.min(input.dataQualityScore, 100)) * 0.05,
    ),
  );
}

export function reviewDecisionStatus(
  decision: PredictiveSignalReviewDecision,
): PredictiveSignalStatus {
  const statuses: Record<
    PredictiveSignalReviewDecision,
    PredictiveSignalStatus
  > = {
    ACKNOWLEDGE: PredictiveSignalStatus.ACKNOWLEDGED,
    MONITOR: PredictiveSignalStatus.MONITORING,
    RESOLVE: PredictiveSignalStatus.RESOLVED,
    DISMISS: PredictiveSignalStatus.DISMISSED,
  };
  return statuses[decision];
}

export function assertPredictiveReview(input: {
  decision: PredictiveSignalReviewDecision;
  rationale: string;
  conditionActive: boolean;
}) {
  if (input.rationale.trim().length < 10) {
    throw new Error("Enter a review rationale of at least 10 characters.");
  }
  if (
    input.decision === PredictiveSignalReviewDecision.RESOLVE &&
    input.conditionActive
  ) {
    throw new Error(
      "The underlying indicator is still active. Select monitor, acknowledge, or dismiss with a documented rationale.",
    );
  }
}

export function signalSeverity(input: {
  current: number;
  threshold: number;
  changePercent?: number | null;
}) {
  const ratio = input.threshold > 0 ? input.current / input.threshold : 1;
  if (ratio >= 2 || (input.changePercent ?? 0) >= 100) return RiskLevel.CRITICAL;
  if (ratio >= 1.5 || (input.changePercent ?? 0) >= 50) return RiskLevel.HIGH;
  return RiskLevel.MEDIUM;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
