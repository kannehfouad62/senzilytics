import { getExecutiveReportData } from "@/core/analytics/executive-report.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  CriticalControlVerificationResult,
  ExecutiveReviewAgendaStatus,
  ExecutiveReviewAttendanceRole,
  ExecutiveReviewConclusion,
  ExecutiveReviewDecisionStatus,
  ExecutiveReviewDecisionType,
  ExecutiveReviewFrequency,
  ExecutiveReviewStatus,
  NotificationType,
  Prisma,
  RiskLevel,
  RiskStatus,
  Status,
} from "@prisma/client";
import {
  assertExecutiveReviewTransition,
  calculateExecutiveReviewReadiness,
  executiveReviewApprovalIssues,
  executiveReviewCompletionIssues,
  executiveReviewScheduleIssues,
} from "./executive-review-lifecycle";

const SNAPSHOT_VERSION = "EMR-1.0";
const terminalActionStatuses = new Set<Status>([
  Status.COMPLETED,
  Status.CLOSED,
]);
const editableReviewStatuses = new Set<ExecutiveReviewStatus>([
  ExecutiveReviewStatus.DRAFT,
  ExecutiveReviewStatus.SCHEDULED,
]);
const activeDecisionStatuses = new Set<ExecutiveReviewDecisionStatus>([
  ExecutiveReviewDecisionStatus.OPEN,
  ExecutiveReviewDecisionStatus.ACTION_LINKED,
]);
const decisionGovernanceReviewStatuses = new Set<ExecutiveReviewStatus>([
  ExecutiveReviewStatus.IN_PROGRESS,
  ExecutiveReviewStatus.COMPLETED,
]);
const overdueReviewStatuses = new Set<ExecutiveReviewStatus>([
  ExecutiveReviewStatus.DRAFT,
  ExecutiveReviewStatus.SCHEDULED,
]);
const concludedAgendaStatuses = new Set<ExecutiveReviewAgendaStatus>([
  ExecutiveReviewAgendaStatus.PRESENTED,
  ExecutiveReviewAgendaStatus.DEFERRED,
  ExecutiveReviewAgendaStatus.CLOSED,
]);
const governedDecisionStatuses = new Set<ExecutiveReviewDecisionStatus>([
  ExecutiveReviewDecisionStatus.IMPLEMENTED,
  ExecutiveReviewDecisionStatus.CLOSED,
  ExecutiveReviewDecisionStatus.CANCELLED,
]);
const snapshotReviewStatuses = new Set<ExecutiveReviewStatus>([
  ExecutiveReviewStatus.DRAFT,
]);
const scheduledSnapshotReviewStatuses = new Set<ExecutiveReviewStatus>([
  ExecutiveReviewStatus.DRAFT,
  ExecutiveReviewStatus.SCHEDULED,
]);
const attendanceReviewStatuses = new Set<ExecutiveReviewStatus>([
  ExecutiveReviewStatus.SCHEDULED,
  ExecutiveReviewStatus.IN_PROGRESS,
]);
const weakControlResults = new Set<CriticalControlVerificationResult>([
  CriticalControlVerificationResult.DEGRADED,
  CriticalControlVerificationResult.FAILED,
  CriticalControlVerificationResult.NOT_VERIFIED,
]);

type Actor = { id: string };

export type ExecutiveReviewInput = {
  organizationId: string;
  siteId: string | null;
  chairId: string;
  title: string;
  frequency: ExecutiveReviewFrequency;
  periodStart: Date;
  periodEnd: Date;
  scheduledAt: Date;
  scope: string;
  objectives: string;
};

const defaultAgenda = [
  {
    topic: "EHS performance and significant events",
    sourceModule: "INCIDENTS_OBSERVATIONS",
    sourceHref: "/dashboard",
    reviewPrompt:
      "Review significant events, leading and lagging trends, causal themes, and positive practices.",
  },
  {
    topic: "Enterprise risks and critical controls",
    sourceModule: "RISKS_CONTROLS",
    sourceHref: "/assurance",
    reviewPrompt:
      "Review elevated risk exposure, control effectiveness, overdue verification, and treatment priorities.",
  },
  {
    topic: "Compliance and regulatory change",
    sourceModule: "COMPLIANCE_REGULATORY",
    sourceHref: "/compliance/regulatory",
    reviewPrompt:
      "Review overdue obligations, legal-register status, regulatory change, and implementation exposure.",
  },
  {
    topic: "Audits, inspections, and corrective actions",
    sourceModule: "ASSURANCE_CAPA",
    sourceHref: "/assurance",
    reviewPrompt:
      "Review assurance completion, significant findings, repeat themes, overdue CAPA, and closure effectiveness.",
  },
  {
    topic: "People, competence, and operational capacity",
    sourceModule: "TRAINING_RESOURCES",
    sourceHref: "/training/dashboard",
    reviewPrompt:
      "Review training compliance, competency gaps, workload, staffing, and resource adequacy.",
  },
  {
    topic: "Emergency and business continuity readiness",
    sourceModule: "RESILIENCE",
    sourceHref: "/business-continuity",
    reviewPrompt:
      "Review emergency exercises, active improvements, recovery capability, and continuity dependencies.",
  },
  {
    topic: "Environmental, ESG, and stakeholder performance",
    sourceModule: "ENVIRONMENT_ESG",
    sourceHref: "/esg/dashboard",
    reviewPrompt:
      "Review environmental performance, ESG commitments, targets, disclosures, and stakeholder concerns.",
  },
  {
    topic: "Predictive indicators and management priorities",
    sourceModule: "PREDICTIVE_INTELLIGENCE",
    sourceHref: "/intelligence/predictive",
    reviewPrompt:
      "Challenge active leading indicators, data quality, assumptions, limitations, and recommended priorities.",
  },
] as const;

export async function listExecutiveReviewsService(organizationId: string) {
  const reviews = await prisma.executiveManagementReview.findMany({
    where: { organizationId },
    include: {
      site: true,
      chair: true,
      approvedBy: true,
      _count: {
        select: { agendaItems: true, attendees: true, decisions: true },
      },
      decisions: {
        where: { status: { in: [...activeDecisionStatuses] } },
        select: { id: true },
      },
    },
    orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  const now = new Date();
  return {
    reviews,
    summary: {
      total: reviews.length,
      upcoming: reviews.filter(
        (review) =>
          review.status === ExecutiveReviewStatus.SCHEDULED &&
          review.scheduledAt >= now,
      ).length,
      overdue: reviews.filter(
        (review) =>
          overdueReviewStatuses.has(review.status) &&
          review.scheduledAt < now,
      ).length,
      awaitingApproval: reviews.filter(
        (review) => review.status === ExecutiveReviewStatus.COMPLETED,
      ).length,
      published: reviews.filter(
        (review) => review.status === ExecutiveReviewStatus.PUBLISHED,
      ).length,
      openDecisions: reviews.reduce(
        (sum, review) => sum + review.decisions.length,
        0,
      ),
    },
  };
}

export async function getExecutiveReviewService(
  organizationId: string,
  reviewId: string,
) {
  const review = await prisma.executiveManagementReview.findFirst({
    where: { id: reviewId, organizationId },
    include: {
      organization: { select: { name: true } },
      site: true,
      chair: true,
      createdBy: true,
      completedBy: true,
      approvedBy: true,
      publishedBy: true,
      agendaItems: {
        include: {
          owner: true,
          decisions: {
            include: { owner: true, correctiveAction: true },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { position: "asc" },
      },
      attendees: {
        include: { user: true },
        orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
      },
      decisions: {
        include: {
          owner: true,
          closedBy: true,
          correctiveAction: true,
          agendaItem: true,
        },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!review) throw new Error("Executive management review not found.");
  const concludedAgendaCount = review.agendaItems.filter((item) =>
    concludedAgendaStatuses.has(item.status),
  ).length;
  const attendedCount = review.attendees.filter(
    (attendee) => attendee.attended,
  ).length;
  const governedDecisionCount = review.decisions.filter(
    (decision) =>
      decision.correctiveActionId ||
      governedDecisionStatuses.has(decision.status),
  ).length;
  const narrativesComplete = [
    review.executiveSummary,
    review.performanceConclusion,
    review.riskControlConclusion,
    review.complianceConclusion,
    review.resourceAdequacy,
    review.decisionsSummary,
  ].every((value) => (value?.trim().length ?? 0) >= 20);
  return {
    review,
    readiness: calculateExecutiveReviewReadiness({
      agendaCount: review.agendaItems.length,
      concludedAgendaCount,
      attendeeCount: review.attendees.length,
      attendedCount,
      hasSnapshot: Boolean(review.evidenceSnapshot),
      dataQualityScore: review.dataQualityScore,
      narrativesComplete,
      governedDecisionCount,
      decisionCount: review.decisions.length,
    }),
    counts: {
      concludedAgendaCount,
      attendedCount,
      governedDecisionCount,
    },
  };
}

export async function createExecutiveReviewService(
  input: ExecutiveReviewInput,
  actor: Actor,
) {
  const scope = await validateReviewScope(input, actor.id);
  validateReviewDates(input);
  const reference = `EMR-${input.scheduledAt.getUTCFullYear()}-${Date.now()
    .toString(36)
    .toUpperCase()}`;
  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.executiveManagementReview.create({
      data: {
        organizationId: input.organizationId,
        siteId: scope.site?.id ?? null,
        chairId: scope.chair.id,
        createdById: actor.id,
        reference,
        title: boundedRequired(input.title, 200, "Review title"),
        frequency: input.frequency,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        scheduledAt: input.scheduledAt,
        scope: boundedRequired(input.scope, 4_000, "Review scope"),
        objectives: boundedRequired(input.objectives, 4_000, "Review objectives"),
        sourceModules: [...new Set(defaultAgenda.map((item) => item.sourceModule))],
      },
    });
    await tx.executiveReviewAgendaItem.createMany({
      data: defaultAgenda.map((item, index) => ({
        organizationId: input.organizationId,
        reviewId: created.id,
        ownerId: scope.chair.id,
        position: index + 1,
        ...item,
      })),
    });
    await tx.executiveReviewAttendee.create({
      data: {
        organizationId: input.organizationId,
        reviewId: created.id,
        userId: scope.chair.id,
        role: ExecutiveReviewAttendanceRole.CHAIR,
      },
    });
    await tx.activityLog.create({
      data: activity(input.organizationId, actor.id, {
        action: ActivityAction.CREATE,
        entityType: "ExecutiveManagementReview",
        entityId: created.id,
        title: "Executive management review created",
        description: `${created.reference} — ${created.title}`,
        metadata: {
          siteId: created.siteId,
          periodStart: created.periodStart,
          periodEnd: created.periodEnd,
          scheduledAt: created.scheduledAt,
          frequency: created.frequency,
        },
      }),
    });
    return created;
  });
  if (scope.chair.id !== actor.id) {
    await createNotification({
      organizationId: input.organizationId,
      userId: scope.chair.id,
      type: NotificationType.ASSIGNMENT,
      title: "Executive review chair assigned",
      message: `${review.reference} — ${review.title} is scheduled for ${review.scheduledAt.toLocaleDateString("en-US")}.`,
      link: `/management-reviews/${review.id}`,
    }).catch(() => undefined);
  }
  return review;
}

export async function addExecutiveAgendaItemService(
  input: {
    organizationId: string;
    reviewId: string;
    topic: string;
    sourceModule: string;
    sourceHref: string | null;
    reviewPrompt: string;
    ownerId: string | null;
  },
  actor: Actor,
) {
  const review = await requireEditableReview(
    input.organizationId,
    input.reviewId,
  );
  const owner = input.ownerId
    ? await requireTenantUser(input.organizationId, input.ownerId)
    : null;
  const last = await prisma.executiveReviewAgendaItem.aggregate({
    where: { reviewId: review.id },
    _max: { position: true },
  });
  const sourceHref = safeInternalHref(input.sourceHref);
  const created = await prisma.$transaction(async (tx) => {
    const item = await tx.executiveReviewAgendaItem.create({
      data: {
        organizationId: input.organizationId,
        reviewId: review.id,
        ownerId: owner?.id ?? null,
        position: (last._max.position ?? 0) + 1,
        topic: boundedRequired(input.topic, 200, "Agenda topic"),
        sourceModule: boundedRequired(
          input.sourceModule,
          80,
          "Source module",
        ),
        sourceHref,
        reviewPrompt: boundedRequired(
          input.reviewPrompt,
          2_000,
          "Review prompt",
        ),
      },
    });
    await tx.executiveManagementReview.update({
      where: { id: review.id },
      data: {
        sourceModules: [
          ...new Set([...review.sourceModules, item.sourceModule]),
        ],
      },
    });
    await tx.activityLog.create({
      data: activity(input.organizationId, actor.id, {
        action: ActivityAction.CREATE,
        entityType: "ExecutiveReviewAgendaItem",
        entityId: item.id,
        title: "Executive-review agenda item added",
        description: `${review.reference} — ${item.topic}`,
        metadata: {
          reviewId: review.id,
          sourceModule: item.sourceModule,
          ownerId: item.ownerId,
        },
      }),
    });
    return item;
  });
  return created;
}

export async function upsertExecutiveAttendeeService(
  input: {
    organizationId: string;
    reviewId: string;
    userId: string;
    role: ExecutiveReviewAttendanceRole;
  },
  actor: Actor,
) {
  const [review, attendee] = await Promise.all([
    requireEditableReview(input.organizationId, input.reviewId),
    requireTenantUser(input.organizationId, input.userId),
  ]);
  const record = await prisma.executiveReviewAttendee.upsert({
    where: { reviewId_userId: { reviewId: review.id, userId: attendee.id } },
    create: {
      organizationId: input.organizationId,
      reviewId: review.id,
      userId: attendee.id,
      role: input.role,
    },
    update: { role: input.role },
  });
  await prisma.activityLog.create({
    data: activity(input.organizationId, actor.id, {
      action: ActivityAction.ASSIGN,
      entityType: "ExecutiveReviewAttendee",
      entityId: record.id,
      title: "Executive-review participant assigned",
      description: `${attendee.name} was assigned as ${label(input.role)} for ${review.reference}.`,
      metadata: {
        reviewId: review.id,
        attendeeId: attendee.id,
        role: input.role,
      },
    }),
  });
  if (attendee.id !== actor.id) {
    await createNotification({
      organizationId: input.organizationId,
      userId: attendee.id,
      type: NotificationType.ASSIGNMENT,
      title: "Executive review invitation",
      message: `${review.reference} — ${review.title} is scheduled for ${review.scheduledAt.toLocaleDateString("en-US")}.`,
      link: `/management-reviews/${review.id}`,
    }).catch(() => undefined);
  }
  return record;
}

export async function scheduleExecutiveReviewService(
  organizationId: string,
  reviewId: string,
  actor: Actor,
) {
  const review = await prisma.executiveManagementReview.findFirst({
    where: { id: reviewId, organizationId },
    include: { _count: { select: { agendaItems: true, attendees: true } } },
  });
  if (!review) throw new Error("Executive management review not found.");
  assertExecutiveReviewTransition(
    review.status,
    ExecutiveReviewStatus.SCHEDULED,
  );
  const issues = executiveReviewScheduleIssues({
    periodStart: review.periodStart,
    periodEnd: review.periodEnd,
    scheduledAt: review.scheduledAt,
    agendaCount: review._count.agendaItems,
    attendeeCount: review._count.attendees,
  });
  if (issues.length) throw new Error(issues.join(" "));
  await updateReviewStatus({
    review,
    next: ExecutiveReviewStatus.SCHEDULED,
    actorId: actor.id,
    title: "Executive management review scheduled",
  });
}

export async function startExecutiveReviewService(
  organizationId: string,
  reviewId: string,
  actor: Actor,
) {
  const review = await requireReview(organizationId, reviewId);
  assertExecutiveReviewTransition(
    review.status,
    ExecutiveReviewStatus.IN_PROGRESS,
  );
  await captureExecutiveReviewSnapshotService(
    organizationId,
    reviewId,
    actor,
    true,
  );
  await updateReviewStatus({
    review,
    next: ExecutiveReviewStatus.IN_PROGRESS,
    actorId: actor.id,
    title: "Executive management review started",
    extra: { startedAt: new Date() },
  });
}

export async function captureExecutiveReviewSnapshotService(
  organizationId: string,
  reviewId: string,
  actor: Actor,
  allowScheduled = false,
) {
  const review = await requireReview(organizationId, reviewId);
  const allowed = allowScheduled
    ? scheduledSnapshotReviewStatuses
    : snapshotReviewStatuses;
  if (!allowed.has(review.status)) {
    throw new Error(
      "Evidence snapshots can only be refreshed before the review is completed.",
    );
  }
  const report = await getExecutiveReportData({
    organizationId,
    userId: actor.id,
    from: review.periodStart,
    to: review.periodEnd,
    siteId: review.siteId,
    recordActivity: false,
  });
  const siteFilter = review.siteId ? { siteId: review.siteId } : {};
  const [
    elevatedRisks,
    overdueRiskReviews,
    predictiveSignals,
    openRegulatoryChanges,
    criticalControls,
    observationCounts,
    performanceIndicators,
    approvedMeasurements,
    activeEmergencyPlans,
    activeContinuityPlans,
  ] = await Promise.all([
    prisma.risk.count({
      where: {
        organizationId,
        ...siteFilter,
        currentRiskLevel: { in: [RiskLevel.HIGH, RiskLevel.CRITICAL] },
        status: { notIn: [RiskStatus.CLOSED, RiskStatus.ARCHIVED] },
      },
    }),
    prisma.risk.count({
      where: {
        organizationId,
        ...siteFilter,
        nextReviewDate: { lt: new Date() },
        status: { notIn: [RiskStatus.CLOSED, RiskStatus.ARCHIVED] },
      },
    }),
    prisma.predictiveSignal.findMany({
      where: {
        organizationId,
        conditionActive: true,
        ...(review.siteId
          ? { OR: [{ siteId: review.siteId }, { siteId: null }] }
          : {}),
      },
      select: {
        id: true,
        title: true,
        category: true,
        severity: true,
        attentionScore: true,
        dataQualityScore: true,
        status: true,
      },
      orderBy: { attentionScore: "desc" },
      take: 20,
    }),
    prisma.regulatoryChange.count({
      where: {
        organizationId,
        status: {
          in: [
            "DETECTED",
            "UNDER_REVIEW",
            "IMPACT_ASSESSMENT",
            "ACTION_REQUIRED",
          ],
        },
      },
    }),
    prisma.criticalControlStandard.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(review.siteId
          ? { OR: [{ siteId: review.siteId }, { siteId: null }] }
          : {}),
      },
      select: {
        id: true,
        nextVerificationDueAt: true,
        verifications: {
          select: { result: true },
          orderBy: { verifiedAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.safetyObservation.groupBy({
      by: ["type"],
      where: {
        organizationId,
        ...siteFilter,
        observedAt: { gte: review.periodStart, lte: review.periodEnd },
      },
      _count: { _all: true },
    }),
    prisma.performanceIndicatorDefinition.count({
      where: { organizationId, isActive: true },
    }),
    prisma.performanceIndicatorMeasurement.count({
      where: {
        organizationId,
        status: "APPROVED",
        periodEnd: { gte: review.periodStart, lte: review.periodEnd },
        ...(review.siteId
          ? { OR: [{ siteId: review.siteId }, { siteId: null }] }
          : {}),
      },
    }),
    prisma.emergencyPlan.count({
      where: {
        organizationId,
        status: "ACTIVE",
        ...(review.siteId ? { siteId: review.siteId } : {}),
      },
    }),
    prisma.businessContinuityPlan.count({
      where: {
        organizationId,
        status: "ACTIVE",
        ...(review.siteId
          ? { OR: [{ siteId: review.siteId }, { siteId: null }] }
          : {}),
      },
    }),
  ]);
  const now = new Date();
  const weakCriticalControls = criticalControls.filter(
    (control) =>
      control.nextVerificationDueAt < now ||
      weakControlResults.has(
        control.verifications[0]?.result ??
          CriticalControlVerificationResult.NOT_VERIFIED,
      ),
  ).length;
  const moduleCoverage = [
    report.summary.totalIncidents +
      report.summary.totalAudits +
      report.summary.totalInspections >
      0,
    report.summary.totalCorrectiveActions > 0,
    report.summary.totalComplianceItems > 0,
    report.summary.totalTrainingRecords > 0,
    elevatedRisks + overdueRiskReviews > 0,
    criticalControls.length > 0,
    performanceIndicators > 0,
    predictiveSignals.length > 0,
  ];
  const dataQualityScore = Math.min(
    100,
    20 + moduleCoverage.filter(Boolean).length * 10,
  );
  const snapshot: Prisma.InputJsonObject = {
    version: SNAPSHOT_VERSION,
    generatedAt: now.toISOString(),
    scope: {
      siteId: review.siteId,
      siteName: report.filters.siteName,
      periodStart: review.periodStart.toISOString(),
      periodEnd: review.periodEnd.toISOString(),
    },
    executiveReport: {
      summary: report.summary,
      sitePerformance: report.sitePerformance,
      managementAttention: report.managementAttention.map((item) => ({
        ...item,
        dueDate: item.dueDate?.toISOString() ?? null,
      })),
    },
    riskAndControl: {
      elevatedRisks,
      overdueRiskReviews,
      criticalControls: criticalControls.length,
      weakCriticalControls,
    },
    predictiveIntelligence: {
      activeSignals: predictiveSignals.length,
      signals: predictiveSignals,
    },
    complianceAndRegulatory: {
      openRegulatoryChanges,
      overdueComplianceItems: report.summary.overdueComplianceItems,
    },
    peopleAndPerformance: {
      trainingCompletionRate: report.summary.trainingCompletionRate,
      performanceIndicators,
      approvedMeasurements,
    },
    observations: observationCounts.map((row) => ({
      type: row.type,
      count: row._count._all,
    })),
    resilience: { activeEmergencyPlans, activeContinuityPlans },
    provenance: {
      snapshotVersion: SNAPSHOT_VERSION,
      deterministic: true,
      dataQualityScore,
      limitation:
        "This snapshot preserves decision-support evidence. It does not establish causation or replace qualified source-record review.",
    },
  };
  await prisma.$transaction([
    prisma.executiveManagementReview.update({
      where: { id: review.id },
      data: {
        evidenceSnapshot: snapshot,
        snapshotVersion: SNAPSHOT_VERSION,
        snapshotGeneratedAt: now,
        dataQualityScore,
      },
    }),
    prisma.activityLog.create({
      data: activity(organizationId, actor.id, {
        action: ActivityAction.SYSTEM,
        entityType: "ExecutiveManagementReview",
        entityId: review.id,
        title: "Executive-review evidence snapshot captured",
        description: `${review.reference} captured ${SNAPSHOT_VERSION} evidence with ${dataQualityScore}% data coverage.`,
        metadata: {
          snapshotVersion: SNAPSHOT_VERSION,
          dataQualityScore,
          siteId: review.siteId,
          periodStart: review.periodStart,
          periodEnd: review.periodEnd,
        },
      }),
    }),
  ]);
  return { snapshot, dataQualityScore };
}

export async function recordExecutiveAttendanceService(
  input: {
    organizationId: string;
    reviewId: string;
    attendeeId: string;
    attended: boolean;
    attendanceNote: string | null;
  },
  actor: Actor,
) {
  const review = await requireReview(input.organizationId, input.reviewId);
  if (!attendanceReviewStatuses.has(review.status)) {
    throw new Error(
      "Attendance can only be recorded for a scheduled or active review.",
    );
  }
  const attendee = await prisma.executiveReviewAttendee.findFirst({
    where: {
      id: input.attendeeId,
      reviewId: review.id,
      organizationId: input.organizationId,
    },
    include: { user: true },
  });
  if (!attendee) throw new Error("Review attendee not found.");
  await prisma.$transaction([
    prisma.executiveReviewAttendee.update({
      where: { id: attendee.id },
      data: {
        attended: input.attended,
        attendedAt: input.attended ? new Date() : null,
        attendanceNote: bounded(
          input.attendanceNote,
          1_000,
          "Attendance note",
        ),
      },
    }),
    prisma.activityLog.create({
      data: activity(input.organizationId, actor.id, {
        action: ActivityAction.UPDATE,
        entityType: "ExecutiveReviewAttendee",
        entityId: attendee.id,
        title: "Executive-review attendance updated",
        description: `${attendee.user.name} was marked ${input.attended ? "present" : "not present"} for ${review.reference}.`,
        metadata: {
          reviewId: review.id,
          userId: attendee.userId,
          attended: input.attended,
        },
      }),
    }),
  ]);
}

export async function recordExecutiveAgendaOutcomeService(
  input: {
    organizationId: string;
    reviewId: string;
    agendaItemId: string;
    status: ExecutiveReviewAgendaStatus;
    discussion: string;
    conclusion: string;
  },
  actor: Actor,
) {
  const review = await requireReview(input.organizationId, input.reviewId);
  if (review.status !== ExecutiveReviewStatus.IN_PROGRESS) {
    throw new Error("Start the management review before recording agenda outcomes.");
  }
  if (!concludedAgendaStatuses.has(input.status)) {
    throw new Error("Select presented, deferred, or closed as the agenda outcome.");
  }
  const agenda = await prisma.executiveReviewAgendaItem.findFirst({
    where: {
      id: input.agendaItemId,
      reviewId: review.id,
      organizationId: input.organizationId,
    },
  });
  if (!agenda) throw new Error("Executive-review agenda item not found.");
  const discussion = boundedRequired(input.discussion, 10_000, "Discussion");
  const conclusion = boundedRequired(input.conclusion, 4_000, "Conclusion");
  if (discussion.length < 20 || conclusion.length < 10) {
    throw new Error(
      "Record a substantive discussion and conclusion for this agenda item.",
    );
  }
  await prisma.$transaction([
    prisma.executiveReviewAgendaItem.update({
      where: { id: agenda.id },
      data: {
        status: input.status,
        discussion,
        conclusion,
        presentedAt: new Date(),
        evidenceSnapshot: {
          sourceModule: agenda.sourceModule,
          sourceHref: agenda.sourceHref,
          reviewSnapshotVersion: review.snapshotVersion,
          reviewSnapshotGeneratedAt:
            review.snapshotGeneratedAt?.toISOString() ?? null,
        },
      },
    }),
    prisma.activityLog.create({
      data: activity(input.organizationId, actor.id, {
        action: ActivityAction.UPDATE,
        entityType: "ExecutiveReviewAgendaItem",
        entityId: agenda.id,
        title: "Executive-review agenda outcome recorded",
        description: `${review.reference} — ${agenda.topic}: ${label(input.status)}.`,
        metadata: {
          reviewId: review.id,
          sourceModule: agenda.sourceModule,
          status: input.status,
        },
      }),
    }),
  ]);
}

export async function createExecutiveDecisionService(
  input: {
    organizationId: string;
    reviewId: string;
    agendaItemId: string | null;
    ownerId: string | null;
    type: ExecutiveReviewDecisionType;
    title: string;
    rationale: string;
    expectedOutcome: string | null;
    priority: RiskLevel;
    dueAt: Date | null;
  },
  actor: Actor,
) {
  const review = await requireReview(input.organizationId, input.reviewId);
  if (review.status !== ExecutiveReviewStatus.IN_PROGRESS) {
    throw new Error("Decisions can only be recorded during an active review.");
  }
  const [agenda, owner] = await Promise.all([
    input.agendaItemId
      ? prisma.executiveReviewAgendaItem.findFirst({
          where: {
            id: input.agendaItemId,
            reviewId: review.id,
            organizationId: input.organizationId,
          },
        })
      : null,
    input.ownerId
      ? requireTenantUser(input.organizationId, input.ownerId)
      : null,
  ]);
  if (input.agendaItemId && !agenda)
    throw new Error("Select an agenda item from this review.");
  if (
    input.type !== ExecutiveReviewDecisionType.NOTE &&
    (!owner || !input.dueAt)
  ) {
    throw new Error("Assign an owner and due date for an actionable decision.");
  }
  if (input.dueAt && input.dueAt <= new Date()) {
    throw new Error("Decision due date must be in the future.");
  }
  const decision = await prisma.$transaction(async (tx) => {
    const created = await tx.executiveReviewDecision.create({
      data: {
        organizationId: input.organizationId,
        reviewId: review.id,
        agendaItemId: agenda?.id ?? null,
        ownerId: owner?.id ?? null,
        type: input.type,
        title: boundedRequired(input.title, 200, "Decision title"),
        rationale: boundedRequired(input.rationale, 4_000, "Decision rationale"),
        expectedOutcome: bounded(
          input.expectedOutcome,
          2_000,
          "Expected outcome",
        ),
        priority: input.priority,
        dueAt: input.dueAt,
      },
    });
    await tx.activityLog.create({
      data: activity(input.organizationId, actor.id, {
        action: ActivityAction.CREATE,
        entityType: "ExecutiveReviewDecision",
        entityId: created.id,
        title: "Executive management decision recorded",
        description: `${review.reference} — ${created.title}`,
        metadata: {
          reviewId: review.id,
          agendaItemId: created.agendaItemId,
          type: created.type,
          priority: created.priority,
          ownerId: created.ownerId,
          dueAt: created.dueAt,
        },
      }),
    });
    return created;
  });
  if (owner && owner.id !== actor.id) {
    await createNotification({
      organizationId: input.organizationId,
      userId: owner.id,
      type: NotificationType.ASSIGNMENT,
      title: "Executive decision assigned",
      message: `${review.reference} — ${decision.title}${decision.dueAt ? ` is due ${decision.dueAt.toLocaleDateString("en-US")}` : ""}.`,
      link: `/management-reviews/${review.id}`,
    }).catch(() => undefined);
  }
  return decision;
}

export async function createCapaFromExecutiveDecisionService(
  input: {
    organizationId: string;
    reviewId: string;
    decisionId: string;
    assignedToId: string;
    dueDate: Date;
    title: string;
    description: string | null;
  },
  actor: Actor,
) {
  const [review, decision, assignee] = await Promise.all([
    requireReview(input.organizationId, input.reviewId),
    prisma.executiveReviewDecision.findFirst({
      where: {
        id: input.decisionId,
        reviewId: input.reviewId,
        organizationId: input.organizationId,
      },
    }),
    requireTenantUser(input.organizationId, input.assignedToId),
  ]);
  if (!decision) throw new Error("Executive management decision not found.");
  if (!decisionGovernanceReviewStatuses.has(review.status)) {
    throw new Error(
      "Decision corrective actions can only be created while the review is in progress or awaiting approval.",
    );
  }
  if (decision.correctiveActionId) {
    throw new Error("This decision already has a linked corrective action.");
  }
  if (input.dueDate <= new Date()) {
    throw new Error("Corrective-action due date must be in the future.");
  }
  const action = await prisma.$transaction(async (tx) => {
    const created = await tx.correctiveAction.create({
      data: {
        title: boundedRequired(input.title, 200, "Corrective-action title"),
        description: bounded(
          input.description,
          4_000,
          "Corrective-action description",
        ),
        status: Status.OPEN,
        riskLevel: decision.priority,
        dueDate: input.dueDate,
        assignedToId: assignee.id,
      },
    });
    await tx.executiveReviewDecision.update({
      where: { id: decision.id },
      data: {
        correctiveActionId: created.id,
        status: ExecutiveReviewDecisionStatus.ACTION_LINKED,
        ownerId: assignee.id,
        dueAt: created.dueDate,
      },
    });
    await tx.activityLog.create({
      data: activity(input.organizationId, actor.id, {
        action: ActivityAction.CREATE,
        entityType: "CorrectiveAction",
        entityId: created.id,
        title: "Executive-review CAPA created",
        description: `${review.reference} — ${created.title}`,
        metadata: {
          reviewId: review.id,
          decisionId: decision.id,
          assignedToId: assignee.id,
          dueDate: created.dueDate,
        },
      }),
    });
    return created;
  });
  await createNotification({
    organizationId: input.organizationId,
    userId: assignee.id,
    type: NotificationType.ASSIGNMENT,
    title: "Executive-review corrective action assigned",
    message: `${review.reference} — ${action.title} is due ${action.dueDate.toLocaleDateString("en-US")}.`,
    link: `/actions/${action.id}`,
  }).catch(() => undefined);
  return action;
}

export async function closeExecutiveDecisionService(
  input: {
    organizationId: string;
    reviewId: string;
    decisionId: string;
    closureEvidence: string;
  },
  actor: Actor,
) {
  const decision = await prisma.executiveReviewDecision.findFirst({
    where: {
      id: input.decisionId,
      reviewId: input.reviewId,
      organizationId: input.organizationId,
    },
    include: { correctiveAction: true, review: true },
  });
  if (!decision) throw new Error("Executive management decision not found.");
  if (!decisionGovernanceReviewStatuses.has(decision.review.status)) {
    throw new Error(
      "Decisions can only be closed while the review is in progress or awaiting approval.",
    );
  }
  if (!activeDecisionStatuses.has(decision.status)) {
    throw new Error("Only an open or action-linked decision can be closed.");
  }
  if (
    decision.correctiveAction &&
    !terminalActionStatuses.has(decision.correctiveAction.status)
  ) {
    throw new Error(
      "Complete or close the linked corrective action before closing this decision.",
    );
  }
  const evidence = boundedRequired(
    input.closureEvidence,
    4_000,
    "Closure evidence",
  );
  if (evidence.length < 20) {
    throw new Error("Record substantive decision closure evidence.");
  }
  await prisma.$transaction([
    prisma.executiveReviewDecision.update({
      where: { id: decision.id },
      data: {
        status: ExecutiveReviewDecisionStatus.CLOSED,
        implementedAt: new Date(),
        closedAt: new Date(),
        closedById: actor.id,
        closureEvidence: evidence,
      },
    }),
    prisma.activityLog.create({
      data: activity(input.organizationId, actor.id, {
        action: ActivityAction.STATUS_CHANGE,
        entityType: "ExecutiveReviewDecision",
        entityId: decision.id,
        title: "Executive management decision closed",
        description: `${decision.review.reference} — ${decision.title}`,
        metadata: {
          reviewId: decision.reviewId,
          correctiveActionId: decision.correctiveActionId,
        },
      }),
    }),
  ]);
}

export async function completeExecutiveReviewService(
  input: {
    organizationId: string;
    reviewId: string;
    executiveSummary: string;
    performanceConclusion: string;
    riskControlConclusion: string;
    complianceConclusion: string;
    resourceAdequacy: string;
    significantChanges: string | null;
    decisionsSummary: string;
    overallConclusion: ExecutiveReviewConclusion;
    nextReviewAt: Date | null;
  },
  actor: Actor,
) {
  const workspace = await getExecutiveReviewService(
    input.organizationId,
    input.reviewId,
  );
  const review = workspace.review;
  assertExecutiveReviewTransition(
    review.status,
    ExecutiveReviewStatus.COMPLETED,
  );
  const narratives = {
    executiveSummary: boundedRequired(
      input.executiveSummary,
      10_000,
      "Executive summary",
    ),
    performanceConclusion: boundedRequired(
      input.performanceConclusion,
      4_000,
      "Performance conclusion",
    ),
    riskControlConclusion: boundedRequired(
      input.riskControlConclusion,
      4_000,
      "Risk and control conclusion",
    ),
    complianceConclusion: boundedRequired(
      input.complianceConclusion,
      4_000,
      "Compliance conclusion",
    ),
    resourceAdequacy: boundedRequired(
      input.resourceAdequacy,
      4_000,
      "Resource adequacy",
    ),
    significantChanges: bounded(
      input.significantChanges,
      4_000,
      "Significant changes",
    ),
    decisionsSummary: boundedRequired(
      input.decisionsSummary,
      4_000,
      "Decisions summary",
    ),
  };
  const issues = executiveReviewCompletionIssues({
    agendaStatuses: review.agendaItems.map((item) => item.status),
    attendedCount: workspace.counts.attendedCount,
    hasSnapshot: Boolean(review.evidenceSnapshot),
    dataQualityScore: review.dataQualityScore,
    ...narratives,
    nextReviewAt: input.nextReviewAt,
    frequency: review.frequency,
  });
  if (issues.length) throw new Error(issues.join(" "));
  await prisma.$transaction([
    prisma.executiveManagementReview.update({
      where: { id: review.id },
      data: {
        status: ExecutiveReviewStatus.COMPLETED,
        ...narratives,
        overallConclusion: input.overallConclusion,
        nextReviewAt: input.nextReviewAt,
        completedById: actor.id,
        completedAt: new Date(),
      },
    }),
    prisma.activityLog.create({
      data: activity(input.organizationId, actor.id, {
        action: ActivityAction.STATUS_CHANGE,
        entityType: "ExecutiveManagementReview",
        entityId: review.id,
        title: "Executive management review completed",
        description: `${review.reference} recorded a ${label(input.overallConclusion)} conclusion.`,
        metadata: {
          conclusion: input.overallConclusion,
          readinessScore: workspace.readiness,
          dataQualityScore: review.dataQualityScore,
          nextReviewAt: input.nextReviewAt,
        },
      }),
    }),
  ]);
}

export async function approveExecutiveReviewService(
  organizationId: string,
  reviewId: string,
  actor: Actor,
) {
  const review = await prisma.executiveManagementReview.findFirst({
    where: { id: reviewId, organizationId },
    include: { decisions: true, chair: true },
  });
  if (!review) throw new Error("Executive management review not found.");
  assertExecutiveReviewTransition(
    review.status,
    ExecutiveReviewStatus.APPROVED,
  );
  const issues = executiveReviewApprovalIssues(review.decisions);
  if (issues.length) throw new Error(issues.join(" "));
  await updateReviewStatus({
    review,
    next: ExecutiveReviewStatus.APPROVED,
    actorId: actor.id,
    title: "Executive management review approved",
    extra: {
      approvedBy: { connect: { id: actor.id } },
      approvedAt: new Date(),
    },
  });
  if (review.chairId !== actor.id) {
    await createNotification({
      organizationId,
      userId: review.chairId,
      type: NotificationType.SUCCESS,
      title: "Executive review approved",
      message: `${review.reference} — ${review.title} was approved.`,
      link: `/management-reviews/${review.id}`,
    }).catch(() => undefined);
  }
}

export async function publishExecutiveReviewService(
  organizationId: string,
  reviewId: string,
  actor: Actor,
) {
  const review = await requireReview(organizationId, reviewId);
  assertExecutiveReviewTransition(
    review.status,
    ExecutiveReviewStatus.PUBLISHED,
  );
  await updateReviewStatus({
    review,
    next: ExecutiveReviewStatus.PUBLISHED,
    actorId: actor.id,
    title: "Executive board pack published",
    extra: {
      publishedBy: { connect: { id: actor.id } },
      publishedAt: new Date(),
    },
  });
}

export async function archiveExecutiveReviewService(
  organizationId: string,
  reviewId: string,
  actor: Actor,
) {
  const review = await requireReview(organizationId, reviewId);
  assertExecutiveReviewTransition(
    review.status,
    ExecutiveReviewStatus.ARCHIVED,
  );
  await updateReviewStatus({
    review,
    next: ExecutiveReviewStatus.ARCHIVED,
    actorId: actor.id,
    title: "Executive management review archived",
    extra: { archivedAt: new Date() },
  });
}

export async function cancelExecutiveReviewService(
  organizationId: string,
  reviewId: string,
  actor: Actor,
) {
  const review = await requireReview(organizationId, reviewId);
  assertExecutiveReviewTransition(
    review.status,
    ExecutiveReviewStatus.CANCELLED,
  );
  await updateReviewStatus({
    review,
    next: ExecutiveReviewStatus.CANCELLED,
    actorId: actor.id,
    title: "Executive management review cancelled",
    extra: { cancelledAt: new Date() },
  });
}

export async function processExecutiveReviewMonitoring(now = new Date()) {
  const horizon = new Date(now.getTime() + 14 * 86_400_000);
  const reviews = await prisma.executiveManagementReview.findMany({
    where: {
      OR: [
        {
          status: {
            in: [
              ExecutiveReviewStatus.DRAFT,
              ExecutiveReviewStatus.SCHEDULED,
            ],
          },
          scheduledAt: { lte: horizon },
        },
        {
          status: {
            in: [
              ExecutiveReviewStatus.APPROVED,
              ExecutiveReviewStatus.PUBLISHED,
            ],
          },
          nextReviewAt: { lte: horizon },
        },
      ],
    },
    include: { chair: true },
    take: 200,
  });
  const result = { checked: reviews.length, remindersSent: 0, overdue: 0 };
  for (const review of reviews) {
    const dueAt =
      review.status === ExecutiveReviewStatus.DRAFT ||
      review.status === ExecutiveReviewStatus.SCHEDULED
        ? review.scheduledAt
        : review.nextReviewAt!;
    const overdue = dueAt < now;
    if (overdue) result.overdue += 1;
    if (
      (overdue && review.overdueNotifiedAt) ||
      (!overdue && review.reminderSentAt)
    ) {
      continue;
    }
    const notification = await createNotification({
      organizationId: review.organizationId,
      userId: review.chairId,
      type: overdue ? NotificationType.CRITICAL : NotificationType.DUE_DATE,
      title: overdue
        ? "Executive management review overdue"
        : "Executive management review approaching",
      message: `${review.reference} — ${review.title} ${overdue ? "was due" : "is due"} ${dueAt.toLocaleDateString("en-US")}.`,
      link: `/management-reviews/${review.id}`,
    }).catch(() => null);
    if (!notification) continue;
    await prisma.executiveManagementReview.update({
      where: { id: review.id },
      data: overdue
        ? { overdueNotifiedAt: now }
        : { reminderSentAt: now },
    });
    result.remindersSent += 1;
  }
  return result;
}

async function requireReview(organizationId: string, reviewId: string) {
  const review = await prisma.executiveManagementReview.findFirst({
    where: { id: reviewId, organizationId },
  });
  if (!review) throw new Error("Executive management review not found.");
  return review;
}

async function requireEditableReview(
  organizationId: string,
  reviewId: string,
) {
  const review = await requireReview(organizationId, reviewId);
  if (!editableReviewStatuses.has(review.status)) {
    throw new Error(
      "This executive review can no longer be structurally edited.",
    );
  }
  return review;
}

async function requireTenantUser(organizationId: string, userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId, isActive: true },
    select: { id: true, name: true },
  });
  if (!user) throw new Error("Select an active user in this organization.");
  return user;
}

async function validateReviewScope(input: ExecutiveReviewInput, actorId: string) {
  const [actor, chair, site] = await Promise.all([
    requireTenantUser(input.organizationId, actorId),
    requireTenantUser(input.organizationId, input.chairId),
    input.siteId
      ? prisma.site.findFirst({
          where: { id: input.siteId, organizationId: input.organizationId },
          select: { id: true },
        })
      : null,
  ]);
  if (input.siteId && !site)
    throw new Error("Select a site in this organization.");
  return { actor, chair, site };
}

function validateReviewDates(input: ExecutiveReviewInput) {
  if (
    [input.periodStart, input.periodEnd, input.scheduledAt].some((date) =>
      Number.isNaN(date.getTime()),
    )
  ) {
    throw new Error("Enter valid executive-review dates.");
  }
  const issues = executiveReviewScheduleIssues({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    scheduledAt: input.scheduledAt,
    agendaCount: defaultAgenda.length,
    attendeeCount: 1,
  });
  if (issues.length) throw new Error(issues.join(" "));
}

async function updateReviewStatus(input: {
  review: {
    id: string;
    organizationId: string;
    reference: string;
    title: string;
    status: ExecutiveReviewStatus;
  };
  next: ExecutiveReviewStatus;
  actorId: string;
  title: string;
  extra?: Prisma.ExecutiveManagementReviewUpdateInput;
}) {
  await prisma.$transaction([
    prisma.executiveManagementReview.update({
      where: { id: input.review.id },
      data: { status: input.next, ...input.extra },
    }),
    prisma.activityLog.create({
      data: activity(input.review.organizationId, input.actorId, {
        action: ActivityAction.STATUS_CHANGE,
        entityType: "ExecutiveManagementReview",
        entityId: input.review.id,
        title: input.title,
        description: `${input.review.reference} moved from ${label(input.review.status)} to ${label(input.next)}.`,
        metadata: { statusBefore: input.review.status, statusAfter: input.next },
      }),
    }),
  ]);
}

function activity(
  organizationId: string,
  userId: string,
  data: {
    action: ActivityAction;
    entityType: string;
    entityId: string;
    title: string;
    description?: string;
    metadata?: Prisma.InputJsonObject;
  },
) {
  return { organizationId, userId, ...data };
}

function boundedRequired(value: string, max: number, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required.`);
  if (normalized.length > max)
    throw new Error(`${field} must be ${max} characters or fewer.`);
  return normalized;
}

function bounded(
  value: string | null | undefined,
  max: number,
  field: string,
) {
  const normalized = value?.trim() || null;
  if (normalized && normalized.length > max)
    throw new Error(`${field} must be ${max} characters or fewer.`);
  return normalized;
}

function safeInternalHref(value: string | null) {
  const href = value?.trim() || null;
  if (!href) return null;
  if (
    !href.startsWith("/") ||
    href.startsWith("//") ||
    /[\u0000-\u001F\u007F\\]/.test(href) ||
    href.length > 500
  ) {
    throw new Error("Source link must be a safe internal application path.");
  }
  return href;
}

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}
