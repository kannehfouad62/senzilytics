import {
  ContinuityActivationStatus,
  ContinuityExerciseResult,
  ContinuityExerciseStatus,
  ContinuityImprovementStatus,
  ContinuityPlanStatus,
} from "@prisma/client";

const planTransitions: Record<ContinuityPlanStatus, readonly ContinuityPlanStatus[]> = {
  DRAFT: [ContinuityPlanStatus.IN_REVIEW, ContinuityPlanStatus.ARCHIVED],
  IN_REVIEW: [ContinuityPlanStatus.ACTIVE, ContinuityPlanStatus.REJECTED],
  ACTIVE: [ContinuityPlanStatus.ARCHIVED],
  REJECTED: [ContinuityPlanStatus.IN_REVIEW, ContinuityPlanStatus.ARCHIVED],
  ARCHIVED: [],
};

const exerciseTransitions: Record<ContinuityExerciseStatus, readonly ContinuityExerciseStatus[]> = {
  PLANNED: [ContinuityExerciseStatus.IN_PROGRESS, ContinuityExerciseStatus.CANCELLED],
  IN_PROGRESS: [ContinuityExerciseStatus.COMPLETED, ContinuityExerciseStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

const activationTransitions: Record<ContinuityActivationStatus, readonly ContinuityActivationStatus[]> = {
  ACTIVE: [ContinuityActivationStatus.RECOVERING, ContinuityActivationStatus.RESTORED],
  RECOVERING: [ContinuityActivationStatus.ACTIVE, ContinuityActivationStatus.RESTORED],
  RESTORED: [ContinuityActivationStatus.CLOSED],
  CLOSED: [],
};

const improvementTransitions: Record<ContinuityImprovementStatus, readonly ContinuityImprovementStatus[]> = {
  OPEN: [ContinuityImprovementStatus.IN_PROGRESS, ContinuityImprovementStatus.CANCELLED],
  IN_PROGRESS: [ContinuityImprovementStatus.COMPLETED, ContinuityImprovementStatus.CANCELLED],
  COMPLETED: [ContinuityImprovementStatus.IN_PROGRESS, ContinuityImprovementStatus.VERIFIED],
  VERIFIED: [],
  CANCELLED: [],
};

export function assertContinuityPlanTransition(current: ContinuityPlanStatus, next: ContinuityPlanStatus) {
  assertTransition("Continuity plan", planTransitions, current, next);
}

export function continuityPlanNextStatuses(status: ContinuityPlanStatus) {
  return [...planTransitions[status]];
}

export function assertContinuityExerciseTransition(current: ContinuityExerciseStatus, next: ContinuityExerciseStatus) {
  assertTransition("Continuity exercise", exerciseTransitions, current, next);
}

export function continuityExerciseNextStatuses(status: ContinuityExerciseStatus) {
  return [...exerciseTransitions[status]];
}

export function assertContinuityActivationTransition(current: ContinuityActivationStatus, next: ContinuityActivationStatus) {
  assertTransition("Continuity activation", activationTransitions, current, next);
}

export function continuityActivationNextStatuses(status: ContinuityActivationStatus) {
  return [...activationTransitions[status]];
}

export function assertContinuityImprovementTransition(current: ContinuityImprovementStatus, next: ContinuityImprovementStatus) {
  assertTransition("Continuity improvement", improvementTransitions, current, next);
}

export function continuityImprovementNextStatuses(status: ContinuityImprovementStatus) {
  return [...improvementTransitions[status]];
}

export function businessImpactObjectiveIssues(input: {
  maximumTolerableDowntimeHours: number;
  recoveryTimeObjectiveHours: number;
  recoveryPointObjectiveHours: number;
  minimumStaff: number;
  operationalImpact: string;
  minimumResources: string;
  recoveryStrategy: string;
  workaroundProcedure: string;
}) {
  const issues: string[] = [];
  const whole = (value: number) => Number.isInteger(value) && value >= 0;
  if (!whole(input.maximumTolerableDowntimeHours) || input.maximumTolerableDowntimeHours < 1) {
    issues.push("Maximum tolerable downtime must be at least one hour.");
  }
  if (!whole(input.recoveryTimeObjectiveHours) || input.recoveryTimeObjectiveHours > input.maximumTolerableDowntimeHours) {
    issues.push("Recovery time objective must be between zero and the maximum tolerable downtime.");
  }
  if (!whole(input.recoveryPointObjectiveHours) || input.recoveryPointObjectiveHours > input.recoveryTimeObjectiveHours) {
    issues.push("Recovery point objective must be between zero and the recovery time objective.");
  }
  if (!Number.isInteger(input.minimumStaff) || input.minimumStaff < 1) {
    issues.push("Minimum staffing must be at least one person.");
  }
  for (const [label, value] of [
    ["operational impact", input.operationalImpact],
    ["minimum resources", input.minimumResources],
    ["recovery strategy", input.recoveryStrategy],
    ["workaround procedure", input.workaroundProcedure],
  ] as const) {
    if (value.trim().length < 20) issues.push(`Document the ${label} with at least 20 characters.`);
  }
  return issues;
}

export function continuityPlanReadinessIssues(input: {
  reviewDueAt: Date;
  scope: string;
  criticalActivitiesSummary: string;
  activationCriteria: string;
  governanceStructure: string;
  communicationStrategy: string;
  alternateWorkStrategy: string;
  technologyRecoveryStrategy: string;
  manualWorkarounds: string;
  recoveryPriorities: string;
  activeAnalysisCount: number;
  highCriticalityAnalysisCount: number;
  invalidAnalysisCount: number;
}, now = new Date()) {
  const issues: string[] = [];
  if (input.reviewDueAt <= now) issues.push("The next plan review date must be in the future.");
  for (const [label, value] of [
    ["scope", input.scope],
    ["critical activities summary", input.criticalActivitiesSummary],
    ["activation criteria", input.activationCriteria],
    ["governance structure", input.governanceStructure],
    ["communication strategy", input.communicationStrategy],
    ["alternate work strategy", input.alternateWorkStrategy],
    ["technology recovery strategy", input.technologyRecoveryStrategy],
    ["manual workarounds", input.manualWorkarounds],
    ["recovery priorities", input.recoveryPriorities],
  ] as const) {
    if (value.trim().length < 20) issues.push(`Document the ${label} with at least 20 characters.`);
  }
  if (input.activeAnalysisCount < 1) issues.push("Add at least one active business impact analysis.");
  if (input.highCriticalityAnalysisCount < 1) issues.push("Identify at least one critical or high-priority process.");
  if (input.invalidAnalysisCount > 0) issues.push("Correct invalid recovery objectives in the business impact analyses.");
  return issues;
}

export function continuityExerciseCompletionIssues(input: {
  actualParticipants: number;
  result: ContinuityExerciseResult | null;
  strengths: string;
  gaps: string;
  afterActionSummary: string;
  actualRecoveryTimeHours: number | null;
  actualRecoveryPointHours: number | null;
}) {
  const issues: string[] = [];
  if (!Number.isInteger(input.actualParticipants) || input.actualParticipants < 1) {
    issues.push("Record at least one actual participant.");
  }
  if (!input.result) issues.push("Select an overall exercise result.");
  if (input.strengths.trim().length < 12) issues.push("Document demonstrated strengths.");
  if (input.gaps.trim().length < 12) issues.push("Document observed gaps or explain why none were identified.");
  if (input.afterActionSummary.trim().length < 30) issues.push("Record an after-action summary of at least 30 characters.");
  for (const [label, value] of [
    ["actual recovery time", input.actualRecoveryTimeHours],
    ["actual recovery point", input.actualRecoveryPointHours],
  ] as const) {
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 87_600)) {
      issues.push(`${label} must be between 0 and 87,600 hours.`);
    }
  }
  return issues;
}

export function continuityReadinessScore(input: {
  status: ContinuityPlanStatus;
  reviewDueAt: Date;
  activeAnalysisCount: number;
  allObjectivesValid: boolean;
  unresolvedSinglePointFailures: number;
  latestCompletedExerciseAt: Date | null;
  overdueCriticalImprovements: number;
}, now = new Date()) {
  let score = 0;
  if (input.status === ContinuityPlanStatus.ACTIVE) score += 25;
  if (input.reviewDueAt > now) score += 15;
  if (input.activeAnalysisCount > 0) score += 15;
  if (input.allObjectivesValid) score += 15;
  if (input.unresolvedSinglePointFailures === 0) score += 10;
  if (input.latestCompletedExerciseAt && now.getTime() - input.latestCompletedExerciseAt.getTime() <= 365 * 86_400_000) score += 10;
  if (input.overdueCriticalImprovements === 0) score += 10;
  return score;
}

function assertTransition<T extends string>(label: string, transitions: Record<T, readonly T[]>, current: T, next: T) {
  if (!transitions[current].includes(next)) {
    throw new Error(`${label} cannot move from ${pretty(current)} to ${pretty(next)}.`);
  }
}

function pretty(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}
