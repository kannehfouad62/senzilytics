import {
  ExecutiveReviewAgendaStatus,
  ExecutiveReviewDecisionStatus,
  ExecutiveReviewDecisionType,
  ExecutiveReviewFrequency,
  ExecutiveReviewStatus,
} from "@prisma/client";

const transitions: Record<
  ExecutiveReviewStatus,
  readonly ExecutiveReviewStatus[]
> = {
  DRAFT: [ExecutiveReviewStatus.SCHEDULED, ExecutiveReviewStatus.CANCELLED],
  SCHEDULED: [
    ExecutiveReviewStatus.IN_PROGRESS,
    ExecutiveReviewStatus.CANCELLED,
  ],
  IN_PROGRESS: [ExecutiveReviewStatus.COMPLETED],
  COMPLETED: [ExecutiveReviewStatus.APPROVED],
  APPROVED: [ExecutiveReviewStatus.PUBLISHED],
  PUBLISHED: [ExecutiveReviewStatus.ARCHIVED],
  CANCELLED: [],
  ARCHIVED: [],
};

export function assertExecutiveReviewTransition(
  current: ExecutiveReviewStatus,
  next: ExecutiveReviewStatus,
) {
  if (!transitions[current].includes(next)) {
    throw new Error(
      `Executive review cannot move from ${label(current)} to ${label(next)}.`,
    );
  }
}

export function executiveReviewScheduleIssues(input: {
  periodStart: Date;
  periodEnd: Date;
  scheduledAt: Date;
  agendaCount: number;
  attendeeCount: number;
}) {
  return [
    ...(input.periodEnd < input.periodStart
      ? ["The reporting period end cannot precede its start."]
      : []),
    ...(input.periodEnd > input.scheduledAt
      ? ["The review meeting cannot precede the end of its reporting period."]
      : []),
    ...(input.agendaCount < 1
      ? ["Add at least one management-review agenda item."]
      : []),
    ...(input.attendeeCount < 1
      ? ["Assign at least one management-review attendee."]
      : []),
  ];
}

export function executiveReviewCompletionIssues(input: {
  agendaStatuses: ExecutiveReviewAgendaStatus[];
  attendedCount: number;
  hasSnapshot: boolean;
  dataQualityScore: number | null;
  executiveSummary: string | null;
  performanceConclusion: string | null;
  riskControlConclusion: string | null;
  complianceConclusion: string | null;
  resourceAdequacy: string | null;
  decisionsSummary: string | null;
  nextReviewAt: Date | null;
  frequency: ExecutiveReviewFrequency;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const unfinishedAgenda = input.agendaStatuses.filter(
    (status) =>
      status === ExecutiveReviewAgendaStatus.PENDING ||
      status === ExecutiveReviewAgendaStatus.READY,
  ).length;
  return [
    ...(!input.hasSnapshot
      ? ["Capture the cross-module evidence snapshot before completion."]
      : []),
    ...(input.dataQualityScore === null || input.dataQualityScore < 40
      ? ["The evidence snapshot does not meet the minimum data-quality floor."]
      : []),
    ...(input.attendedCount < 1
      ? ["Record attendance for at least one participant."]
      : []),
    ...(unfinishedAgenda
      ? [`Conclude or defer ${unfinishedAgenda} unfinished agenda item${unfinishedAgenda === 1 ? "" : "s"}.`]
      : []),
    ...requiredNarrative(
      input.executiveSummary,
      "Record a substantive executive summary.",
    ),
    ...requiredNarrative(
      input.performanceConclusion,
      "Record the performance conclusion.",
    ),
    ...requiredNarrative(
      input.riskControlConclusion,
      "Record the risk and control conclusion.",
    ),
    ...requiredNarrative(
      input.complianceConclusion,
      "Record the compliance conclusion.",
    ),
    ...requiredNarrative(
      input.resourceAdequacy,
      "Record the resource-adequacy conclusion.",
    ),
    ...requiredNarrative(
      input.decisionsSummary,
      "Summarize the management decisions.",
    ),
    ...(input.frequency !== ExecutiveReviewFrequency.AD_HOC &&
    (!input.nextReviewAt || input.nextReviewAt <= now)
      ? ["Set the next recurring management-review date in the future."]
      : []),
  ];
}

export function executiveReviewApprovalIssues(
  decisions: Array<{
    type: ExecutiveReviewDecisionType;
    status: ExecutiveReviewDecisionStatus;
    correctiveActionId: string | null;
  }>,
) {
  const terminalStatuses = new Set<ExecutiveReviewDecisionStatus>([
    ExecutiveReviewDecisionStatus.IMPLEMENTED,
    ExecutiveReviewDecisionStatus.CLOSED,
    ExecutiveReviewDecisionStatus.CANCELLED,
  ]);
  const ungoverned = decisions.filter(
    (decision) =>
      decision.type === ExecutiveReviewDecisionType.ACTION_REQUIRED &&
      !decision.correctiveActionId &&
      !terminalStatuses.has(decision.status),
  ).length;
  return ungoverned
    ? [
        `Link ${ungoverned} required decision${ungoverned === 1 ? "" : "s"} to CAPA or record implementation before approval.`,
      ]
    : [];
}

export function calculateExecutiveReviewReadiness(input: {
  agendaCount: number;
  concludedAgendaCount: number;
  attendeeCount: number;
  attendedCount: number;
  hasSnapshot: boolean;
  dataQualityScore: number | null;
  narrativesComplete: boolean;
  governedDecisionCount: number;
  decisionCount: number;
}) {
  const agenda =
    input.agendaCount > 0
      ? Math.round((input.concludedAgendaCount / input.agendaCount) * 25)
      : 0;
  const attendance =
    input.attendeeCount > 0
      ? Math.round((input.attendedCount / input.attendeeCount) * 15)
      : 0;
  const evidence = input.hasSnapshot
    ? Math.round(Math.min(input.dataQualityScore ?? 0, 100) * 0.25)
    : 0;
  const narrative = input.narrativesComplete ? 20 : 0;
  const decisions =
    input.decisionCount === 0
      ? 15
      : Math.round(
          (input.governedDecisionCount / input.decisionCount) * 15,
        );
  return Math.min(100, agenda + attendance + evidence + narrative + decisions);
}

export function nextExecutiveReviewDate(
  frequency: ExecutiveReviewFrequency,
  from: Date,
) {
  const next = new Date(from);
  switch (frequency) {
    case ExecutiveReviewFrequency.MONTHLY:
      return addUtcMonthsClamped(next, 1);
    case ExecutiveReviewFrequency.QUARTERLY:
      return addUtcMonthsClamped(next, 3);
    case ExecutiveReviewFrequency.SEMIANNUAL:
      return addUtcMonthsClamped(next, 6);
    case ExecutiveReviewFrequency.ANNUAL:
      return addUtcMonthsClamped(next, 12);
    case ExecutiveReviewFrequency.AD_HOC:
      return null;
  }
}

function addUtcMonthsClamped(value: Date, months: number) {
  const next = new Date(value);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
  ).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

function requiredNarrative(value: string | null, message: string) {
  return (value?.trim().length ?? 0) >= 20 ? [] : [message];
}

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}
