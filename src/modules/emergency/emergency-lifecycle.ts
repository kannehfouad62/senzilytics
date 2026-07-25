import {
  EmergencyActivationStatus,
  EmergencyDrillRating,
  EmergencyDrillStatus,
  EmergencyImprovementStatus,
  EmergencyPlanStatus,
} from "@prisma/client";

const planTransitions: Record<
  EmergencyPlanStatus,
  readonly EmergencyPlanStatus[]
> = {
  [EmergencyPlanStatus.DRAFT]: [
    EmergencyPlanStatus.IN_REVIEW,
    EmergencyPlanStatus.ARCHIVED,
  ],
  [EmergencyPlanStatus.IN_REVIEW]: [
    EmergencyPlanStatus.ACTIVE,
    EmergencyPlanStatus.REJECTED,
  ],
  [EmergencyPlanStatus.ACTIVE]: [EmergencyPlanStatus.ARCHIVED],
  [EmergencyPlanStatus.REJECTED]: [
    EmergencyPlanStatus.IN_REVIEW,
    EmergencyPlanStatus.ARCHIVED,
  ],
  [EmergencyPlanStatus.ARCHIVED]: [],
};

const drillTransitions: Record<
  EmergencyDrillStatus,
  readonly EmergencyDrillStatus[]
> = {
  [EmergencyDrillStatus.PLANNED]: [
    EmergencyDrillStatus.IN_PROGRESS,
    EmergencyDrillStatus.CANCELLED,
  ],
  [EmergencyDrillStatus.IN_PROGRESS]: [
    EmergencyDrillStatus.COMPLETED,
    EmergencyDrillStatus.CANCELLED,
  ],
  [EmergencyDrillStatus.COMPLETED]: [],
  [EmergencyDrillStatus.CANCELLED]: [],
};

const activationTransitions: Record<
  EmergencyActivationStatus,
  readonly EmergencyActivationStatus[]
> = {
  [EmergencyActivationStatus.ACTIVE]: [
    EmergencyActivationStatus.STABILIZED,
    EmergencyActivationStatus.STOOD_DOWN,
  ],
  [EmergencyActivationStatus.STABILIZED]: [
    EmergencyActivationStatus.ACTIVE,
    EmergencyActivationStatus.STOOD_DOWN,
  ],
  [EmergencyActivationStatus.STOOD_DOWN]: [
    EmergencyActivationStatus.REVIEWED,
  ],
  [EmergencyActivationStatus.REVIEWED]: [],
};

const improvementTransitions: Record<
  EmergencyImprovementStatus,
  readonly EmergencyImprovementStatus[]
> = {
  [EmergencyImprovementStatus.OPEN]: [
    EmergencyImprovementStatus.IN_PROGRESS,
    EmergencyImprovementStatus.CANCELLED,
  ],
  [EmergencyImprovementStatus.IN_PROGRESS]: [
    EmergencyImprovementStatus.COMPLETED,
    EmergencyImprovementStatus.CANCELLED,
  ],
  [EmergencyImprovementStatus.COMPLETED]: [
    EmergencyImprovementStatus.IN_PROGRESS,
    EmergencyImprovementStatus.VERIFIED,
  ],
  [EmergencyImprovementStatus.VERIFIED]: [],
  [EmergencyImprovementStatus.CANCELLED]: [],
};

export function assertEmergencyPlanTransition(
  current: EmergencyPlanStatus,
  next: EmergencyPlanStatus,
) {
  assertTransition("Emergency plan", planTransitions, current, next);
}

export function emergencyPlanNextStatuses(status: EmergencyPlanStatus) {
  return [...planTransitions[status]];
}

export function assertEmergencyDrillTransition(
  current: EmergencyDrillStatus,
  next: EmergencyDrillStatus,
) {
  assertTransition("Emergency drill", drillTransitions, current, next);
}

export function emergencyDrillNextStatuses(status: EmergencyDrillStatus) {
  return [...drillTransitions[status]];
}

export function assertEmergencyActivationTransition(
  current: EmergencyActivationStatus,
  next: EmergencyActivationStatus,
) {
  assertTransition(
    "Emergency activation",
    activationTransitions,
    current,
    next,
  );
}

export function emergencyActivationNextStatuses(
  status: EmergencyActivationStatus,
) {
  return [...activationTransitions[status]];
}

export function assertEmergencyImprovementTransition(
  current: EmergencyImprovementStatus,
  next: EmergencyImprovementStatus,
) {
  assertTransition(
    "Emergency improvement",
    improvementTransitions,
    current,
    next,
  );
}

export function emergencyImprovementNextStatuses(
  status: EmergencyImprovementStatus,
) {
  return [...improvementTransitions[status]];
}

export function emergencyPlanReadinessIssues(input: {
  reviewDueAt: Date;
  scope: string;
  hazardProfile: string;
  commandStructure: string;
  communicationProcedure: string;
  evacuationProcedure: string;
  accountabilityProcedure: string;
  recoveryCriteria: string;
  activeScenarioCount: number;
  activeContactCount: number;
}, now = new Date()) {
  const issues: string[] = [];
  if (input.reviewDueAt <= now) issues.push("The next plan review date must be in the future.");
  const narratives: Array<[string, string]> = [
    ["scope", input.scope],
    ["hazard profile", input.hazardProfile],
    ["command structure", input.commandStructure],
    ["communication procedure", input.communicationProcedure],
    ["evacuation procedure", input.evacuationProcedure],
    ["accountability procedure", input.accountabilityProcedure],
    ["recovery criteria", input.recoveryCriteria],
  ];
  for (const [label, value] of narratives) {
    if (value.trim().length < 20) {
      issues.push(`Document the ${label} with at least 20 characters.`);
    }
  }
  if (input.activeScenarioCount < 1) {
    issues.push("Add at least one active emergency scenario.");
  }
  if (input.activeContactCount < 2) {
    issues.push("Add at least two active emergency contacts.");
  }
  return issues;
}

export function emergencyDrillCompletionIssues(input: {
  actualParticipants: number;
  rating: EmergencyDrillRating | null;
  strengths: string;
  gaps: string;
  afterActionSummary: string;
  alarmActivationSeconds: number | null;
  evacuationSeconds: number | null;
  accountabilitySeconds: number | null;
}) {
  const issues: string[] = [];
  if (!Number.isInteger(input.actualParticipants) || input.actualParticipants < 1) {
    issues.push("Record at least one actual participant.");
  }
  if (!input.rating) issues.push("Select an overall drill effectiveness rating.");
  if (input.strengths.trim().length < 12) {
    issues.push("Document demonstrated strengths.");
  }
  if (input.gaps.trim().length < 12) {
    issues.push("Document observed gaps or explain why none were identified.");
  }
  if (input.afterActionSummary.trim().length < 30) {
    issues.push("Record an after-action summary of at least 30 characters.");
  }
  for (const [label, value] of [
    ["alarm activation", input.alarmActivationSeconds],
    ["evacuation", input.evacuationSeconds],
    ["accountability", input.accountabilitySeconds],
  ] as const) {
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 86_400)) {
      issues.push(`${label} time must be between 0 and 86,400 seconds.`);
    }
  }
  return issues;
}

export function emergencyReadinessScore(input: {
  status: EmergencyPlanStatus;
  reviewDueAt: Date;
  activeScenarioCount: number;
  activeContactCount: number;
  latestCompletedDrillAt: Date | null;
  openCriticalImprovements: number;
}, now = new Date()) {
  let score = 0;
  if (input.status === EmergencyPlanStatus.ACTIVE) score += 30;
  if (input.reviewDueAt > now) score += 15;
  if (input.activeScenarioCount > 0) score += 15;
  if (input.activeContactCount >= 2) score += 15;
  if (
    input.latestCompletedDrillAt &&
    now.getTime() - input.latestCompletedDrillAt.getTime() <=
      365 * 24 * 60 * 60 * 1_000
  ) {
    score += 15;
  }
  if (input.openCriticalImprovements === 0) score += 10;
  return score;
}

function assertTransition<T extends string>(
  label: string,
  transitions: Record<T, readonly T[]>,
  current: T,
  next: T,
) {
  if (!transitions[current].includes(next)) {
    throw new Error(
      `${label} cannot move from ${pretty(current)} to ${pretty(next)}.`,
    );
  }
}

function pretty(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}
