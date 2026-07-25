import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  EnterpriseAuditFindingStatus,
  NotificationType,
  PredictiveIntelligenceRunStatus,
  PredictiveSignalCategory,
  PredictiveSignalDirection,
  PredictiveSignalReviewDecision,
  PredictiveSignalStatus,
  Prisma,
  RiskLevel,
  SafetyObservationType,
  Status,
  UserRole,
} from "@prisma/client";
import {
  assertPredictiveReview,
  assessDeterioratingTrend,
  calculateAttentionScore,
  reviewDecisionStatus,
  signalSeverity,
} from "./predictive-intelligence";

const ALGORITHM_VERSION = "PRI-1.0";
const DAY = 86_400_000;

type Candidate = {
  fingerprint: string;
  category: PredictiveSignalCategory;
  severity: RiskLevel;
  direction: PredictiveSignalDirection;
  title: string;
  summary: string;
  rationale: string;
  recommendedAction: string;
  evidence: Prisma.InputJsonObject;
  currentValue: number;
  baselineValue: number;
  changePercent: number | null;
  thresholdValue: number;
  attentionScore: number;
  dataQualityScore: number;
};

export async function getPredictiveIntelligenceWorkspace(
  organizationId: string,
) {
  const [policy, signals, runs] = await Promise.all([
    getOrCreatePolicy(organizationId),
    prisma.predictiveSignal.findMany({
      where: { organizationId },
      include: {
        site: true,
        department: true,
        owner: true,
        reviewer: true,
        reviews: {
          include: { reviewer: true },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
      orderBy: [
        { conditionActive: "desc" },
        { attentionScore: "desc" },
        { lastDetectedAt: "desc" },
      ],
      take: 100,
    }),
    prisma.predictiveIntelligenceRun.findMany({
      where: { organizationId },
      include: { requestedBy: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  const active = signals.filter((signal) => signal.conditionActive);
  return {
    policy,
    signals,
    runs,
    summary: {
      active: active.length,
      critical: active.filter((signal) => signal.severity === RiskLevel.CRITICAL)
        .length,
      high: active.filter((signal) => signal.severity === RiskLevel.HIGH).length,
      awaitingReview: active.filter(
        (signal) => signal.status === PredictiveSignalStatus.OPEN,
      ).length,
      cleared: signals.filter((signal) => !signal.conditionActive).length,
      averageAttention: active.length
        ? Math.round(
            active.reduce((sum, signal) => sum + signal.attentionScore, 0) /
              active.length,
          )
        : 0,
    },
  };
}

export async function getPredictiveSignalService(
  organizationId: string,
  signalId: string,
) {
  const signal = await prisma.predictiveSignal.findFirst({
    where: { id: signalId, organizationId },
    include: {
      site: true,
      department: true,
      owner: true,
      reviewer: true,
      run: true,
      reviews: {
        include: { reviewer: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!signal) throw new Error("Predictive signal not found.");
  return signal;
}

export async function updatePredictivePolicyService(
  input: {
    organizationId: string;
    isActive: boolean;
    lookbackDays: number;
    minimumEventCount: number;
    deteriorationThresholdPercent: number;
    overdueActionThreshold: number;
    controlFailureThreshold: number;
    reviewCadenceDays: number;
  },
  actorId: string,
) {
  validatePolicy(input);
  const policy = await prisma.predictiveIntelligencePolicy.upsert({
    where: { organizationId: input.organizationId },
    create: {
      ...input,
      nextRunAt: input.isActive ? new Date() : null,
    },
    update: {
      ...input,
      nextRunAt: input.isActive ? new Date() : null,
    },
  });
  await log(input.organizationId, actorId, {
    action: ActivityAction.UPDATE,
    entityType: "PredictiveIntelligencePolicy",
    entityId: policy.id,
    title: "Predictive intelligence policy updated",
    description:
      "Leading-indicator thresholds and review cadence were updated.",
    metadata: {
      lookbackDays: policy.lookbackDays,
      minimumEventCount: policy.minimumEventCount,
      deteriorationThresholdPercent: policy.deteriorationThresholdPercent,
      isActive: policy.isActive,
    },
  });
  return policy;
}

export async function reviewPredictiveSignalService(
  input: {
    organizationId: string;
    signalId: string;
    decision: PredictiveSignalReviewDecision;
    rationale: string;
    ownerId?: string | null;
  },
  reviewerId: string,
) {
  const signal = await prisma.predictiveSignal.findFirst({
    where: { id: input.signalId, organizationId: input.organizationId },
  });
  if (!signal) throw new Error("Predictive signal not found.");
  assertPredictiveReview({
    decision: input.decision,
    rationale: input.rationale,
    conditionActive: signal.conditionActive,
  });
  if (input.ownerId) {
    const owner = await prisma.user.findFirst({
      where: {
        id: input.ownerId,
        organizationId: input.organizationId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!owner) throw new Error("Select an active user in this organization.");
  }
  const statusAfter = reviewDecisionStatus(input.decision);
  const now = new Date();
  await prisma.$transaction([
    prisma.predictiveSignal.update({
      where: { id: signal.id },
      data: {
        status: statusAfter,
        reviewerId,
        ownerId: input.ownerId || signal.ownerId,
        acknowledgedAt:
          input.decision === PredictiveSignalReviewDecision.ACKNOWLEDGE
            ? now
            : signal.acknowledgedAt,
        resolvedAt:
          input.decision === PredictiveSignalReviewDecision.RESOLVE ? now : null,
        dismissedAt:
          input.decision === PredictiveSignalReviewDecision.DISMISS ? now : null,
      },
    }),
    prisma.predictiveSignalReview.create({
      data: {
        organizationId: input.organizationId,
        signalId: signal.id,
        reviewerId,
        decision: input.decision,
        rationale: input.rationale.trim(),
        statusBefore: signal.status,
        statusAfter,
      },
    }),
    prisma.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: reviewerId,
        action: ActivityAction.STATUS_CHANGE,
        entityType: "PredictiveSignal",
        entityId: signal.id,
        title: "Predictive signal reviewed",
        description: `${signal.title}: ${input.decision.replaceAll("_", " ").toLowerCase()}.`,
        metadata: {
          decision: input.decision,
          statusBefore: signal.status,
          statusAfter,
          conditionActive: signal.conditionActive,
        },
      },
    }),
  ]);
}

export async function runPredictiveIntelligenceService(
  organizationId: string,
  requestedById: string | null = null,
) {
  const policy = await getOrCreatePolicy(organizationId);
  if (!policy.isActive && !requestedById) {
    return { skipped: true, reason: "Policy inactive" };
  }
  const now = new Date();
  const windowStart = new Date(now.getTime() - policy.lookbackDays * DAY);
  const comparisonStart = new Date(
    windowStart.getTime() - policy.lookbackDays * DAY,
  );
  const run = await prisma.predictiveIntelligenceRun.create({
    data: {
      organizationId,
      policyId: policy.id,
      requestedById,
      algorithmVersion: ALGORITHM_VERSION,
      windowStart,
      windowEnd: now,
      comparisonStart,
      comparisonEnd: windowStart,
    },
  });
  try {
    const snapshot = await collectSnapshot({
      organizationId,
      current: { gte: windowStart, lt: now },
      baseline: { gte: comparisonStart, lt: windowStart },
    });
    const dataQualityScore = calculateDataQuality(snapshot);
    const candidates = buildCandidates(snapshot, policy, dataQualityScore);
    const activeFingerprints = new Set(candidates.map((item) => item.fingerprint));
    let created = 0;
    let refreshed = 0;
    const notify: Array<{ id: string; title: string; severity: RiskLevel }> = [];

    for (const candidate of candidates) {
      const existing = await prisma.predictiveSignal.findUnique({
        where: {
          organizationId_fingerprint: {
            organizationId,
            fingerprint: candidate.fingerprint,
          },
        },
      });
      if (existing) {
        await prisma.predictiveSignal.update({
          where: { id: existing.id },
          data: {
            ...candidate,
            runId: run.id,
            conditionActive: true,
            lastDetectedAt: now,
            reviewDueAt: new Date(now.getTime() + policy.reviewCadenceDays * DAY),
            ...(existing.status === PredictiveSignalStatus.RESOLVED
              ? {
                  status: PredictiveSignalStatus.OPEN,
                  resolvedAt: null,
                  reviewerId: null,
                }
              : {}),
          },
        });
        refreshed += 1;
      } else {
        const signal = await prisma.predictiveSignal.create({
          data: {
            organizationId,
            runId: run.id,
            ...candidate,
            reviewDueAt: new Date(now.getTime() + policy.reviewCadenceDays * DAY),
          },
        });
        created += 1;
        if (
          signal.severity === RiskLevel.HIGH ||
          signal.severity === RiskLevel.CRITICAL
        ) {
          notify.push(signal);
        }
      }
    }

    const currentSignals = await prisma.predictiveSignal.findMany({
      where: { organizationId, conditionActive: true },
      select: { id: true, fingerprint: true },
    });
    const clearedIds = currentSignals
      .filter((signal) => !activeFingerprints.has(signal.fingerprint))
      .map((signal) => signal.id);
    if (clearedIds.length) {
      await prisma.predictiveSignal.updateMany({
        where: { id: { in: clearedIds } },
        data: { conditionActive: false },
      });
    }
    await prisma.$transaction([
      prisma.predictiveIntelligenceRun.update({
        where: { id: run.id },
        data: {
          status: PredictiveIntelligenceRunStatus.COMPLETED,
          completedAt: new Date(),
          dataQualityScore,
          sourceCounts: snapshot as unknown as Prisma.InputJsonObject,
          signalsDetected: created,
          signalsRefreshed: refreshed,
          conditionsCleared: clearedIds.length,
        },
      }),
      prisma.predictiveIntelligencePolicy.update({
        where: { id: policy.id },
        data: {
          lastRunAt: now,
          nextRunAt: new Date(now.getTime() + DAY),
        },
      }),
      prisma.activityLog.create({
        data: {
          organizationId,
          userId: requestedById,
          action: ActivityAction.SYSTEM,
          entityType: "PredictiveIntelligenceRun",
          entityId: run.id,
          title: "Predictive intelligence analysis completed",
          description: `${created} new, ${refreshed} refreshed, and ${clearedIds.length} cleared indicator conditions.`,
          metadata: {
            algorithmVersion: ALGORITHM_VERSION,
            dataQualityScore,
            created,
            refreshed,
            conditionsCleared: clearedIds.length,
          },
        },
      }),
    ]);
    await notifyManagers(organizationId, notify);
    return {
      skipped: false,
      runId: run.id,
      created,
      refreshed,
      conditionsCleared: clearedIds.length,
      dataQualityScore,
    };
  } catch (cause) {
    await prisma.predictiveIntelligenceRun.update({
      where: { id: run.id },
      data: {
        status: PredictiveIntelligenceRunStatus.FAILED,
        completedAt: new Date(),
        failureReason:
          cause instanceof Error ? cause.message.slice(0, 2_000) : "Unknown error",
      },
    });
    throw cause;
  }
}

export async function processPredictiveIntelligenceMonitoring() {
  const now = new Date();
  const organizations = await prisma.organization.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { predictiveIntelligencePolicy: null },
        {
          predictiveIntelligencePolicy: {
            isActive: true,
            OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
          },
        },
      ],
    },
    select: { id: true },
    take: 100,
  });
  let processed = 0;
  let failed = 0;
  for (const organization of organizations) {
    try {
      await runPredictiveIntelligenceService(organization.id);
      processed += 1;
    } catch (error) {
      console.error("Predictive intelligence monitoring failed:", error);
      failed += 1;
    }
  }
  return { organizations: organizations.length, processed, failed };
}

async function getOrCreatePolicy(organizationId: string) {
  return prisma.predictiveIntelligencePolicy.upsert({
    where: { organizationId },
    create: { organizationId, nextRunAt: new Date() },
    update: {},
  });
}

async function collectSnapshot(input: {
  organizationId: string;
  current: { gte: Date; lt: Date };
  baseline: { gte: Date; lt: Date };
}) {
  const terminalFindingStatuses = new Set<EnterpriseAuditFindingStatus>([
    EnterpriseAuditFindingStatus.CLOSED,
    EnterpriseAuditFindingStatus.VERIFIED,
    EnterpriseAuditFindingStatus.CANCELLED,
    EnterpriseAuditFindingStatus.REJECTED,
  ]);
  const openFindingStatuses = Object.values(EnterpriseAuditFindingStatus).filter(
    (status) => !terminalFindingStatuses.has(status),
  );
  const [incidentsCurrent, incidentsBaseline, observationsCurrent, observationsBaseline, overdueActions, failedControls, auditFindings, overdueTraining, sites, activeUsers] =
    await Promise.all([
      prisma.incident.count({
        where: { site: { organizationId: input.organizationId }, occurredAt: input.current },
      }),
      prisma.incident.count({
        where: { site: { organizationId: input.organizationId }, occurredAt: input.baseline },
      }),
      prisma.safetyObservation.count({
        where: {
          organizationId: input.organizationId,
          observedAt: input.current,
          type: { in: [SafetyObservationType.UNSAFE_ACT, SafetyObservationType.UNSAFE_CONDITION] },
        },
      }),
      prisma.safetyObservation.count({
        where: {
          organizationId: input.organizationId,
          observedAt: input.baseline,
          type: { in: [SafetyObservationType.UNSAFE_ACT, SafetyObservationType.UNSAFE_CONDITION] },
        },
      }),
      prisma.correctiveAction.count({
        where: {
          assignedTo: { organizationId: input.organizationId },
          dueDate: { lt: new Date() },
          status: { in: [Status.OPEN, Status.IN_PROGRESS, Status.OVERDUE] },
        },
      }),
      prisma.criticalControlVerification.count({
        where: {
          organizationId: input.organizationId,
          verifiedAt: input.current,
          result: { in: ["FAILED", "DEGRADED", "NOT_VERIFIED"] },
        },
      }),
      prisma.enterpriseAuditFinding.count({
        where: {
          organizationId: input.organizationId,
          status: { in: openFindingStatuses },
          severity: { in: ["HIGH", "CRITICAL"] },
        },
      }),
      prisma.trainingRecord.count({
        where: {
          user: { organizationId: input.organizationId, isActive: true },
          dueDate: { lt: new Date() },
          status: { in: [Status.OPEN, Status.IN_PROGRESS, Status.OVERDUE] },
        },
      }),
      prisma.site.count({ where: { organizationId: input.organizationId } }),
      prisma.user.count({ where: { organizationId: input.organizationId, isActive: true } }),
    ]);
  return {
    incidentsCurrent,
    incidentsBaseline,
    observationsCurrent,
    observationsBaseline,
    overdueActions,
    failedControls,
    auditFindings,
    overdueTraining,
    sites,
    activeUsers,
  };
}

function calculateDataQuality(snapshot: Awaited<ReturnType<typeof collectSnapshot>>) {
  let score = 60;
  if (snapshot.sites > 0) score += 15;
  if (snapshot.activeUsers > 0) score += 15;
  if (
    snapshot.incidentsCurrent +
      snapshot.incidentsBaseline +
      snapshot.observationsCurrent +
      snapshot.observationsBaseline >
    0
  )
    score += 10;
  return Math.min(score, 100);
}

function buildCandidates(
  snapshot: Awaited<ReturnType<typeof collectSnapshot>>,
  policy: Awaited<ReturnType<typeof getOrCreatePolicy>>,
  dataQualityScore: number,
): Candidate[] {
  const candidates: Candidate[] = [];
  addTrend({
    candidates,
    fingerprint: "organization:incident-trend",
    category: PredictiveSignalCategory.INCIDENT_TREND,
    title: "Incident frequency is deteriorating",
    current: snapshot.incidentsCurrent,
    baseline: snapshot.incidentsBaseline,
    minimumEventCount: policy.minimumEventCount,
    threshold: policy.deteriorationThresholdPercent,
    dataQualityScore,
    rationale:
      "Incident volume in the current comparison window increased beyond the governed deterioration threshold.",
    recommendedAction:
      "Review incident types, locations, causal themes, and control effectiveness before setting an intervention.",
  });
  addTrend({
    candidates,
    fingerprint: "organization:at-risk-observation-trend",
    category: PredictiveSignalCategory.AT_RISK_OBSERVATION_TREND,
    title: "At-risk observations are increasing",
    current: snapshot.observationsCurrent,
    baseline: snapshot.observationsBaseline,
    minimumEventCount: policy.minimumEventCount,
    threshold: policy.deteriorationThresholdPercent,
    dataQualityScore,
    rationale:
      "Unsafe-act and unsafe-condition observations increased beyond the configured comparison threshold.",
    recommendedAction:
      "Validate reporting volume, then review behavior, location, and control themes with frontline leaders.",
  });
  addThreshold({
    candidates,
    fingerprint: "organization:overdue-actions",
    category: PredictiveSignalCategory.OVERDUE_ACTION_EXPOSURE,
    title: "Overdue corrective-action exposure",
    current: snapshot.overdueActions,
    threshold: policy.overdueActionThreshold,
    dataQualityScore,
    rationale:
      "Open corrective actions have passed their due dates, increasing unresolved control exposure.",
    recommendedAction:
      "Confirm ownership, remove blockers, and escalate high-risk overdue actions through the existing CAPA workflow.",
  });
  addThreshold({
    candidates,
    fingerprint: "organization:critical-control-weakness",
    category: PredictiveSignalCategory.CRITICAL_CONTROL_WEAKNESS,
    title: "Critical-control weakness requires review",
    current: snapshot.failedControls,
    threshold: policy.controlFailureThreshold,
    dataQualityScore,
    rationale:
      "Recent critical-control verifications were failed, degraded, or not verified.",
    recommendedAction:
      "Review the affected control verifications and confirm immediate protection before changing the control standard.",
  });
  addThreshold({
    candidates,
    fingerprint: "organization:audit-finding-pressure",
    category: PredictiveSignalCategory.AUDIT_FINDING_PRESSURE,
    title: "High-severity audit finding pressure",
    current: snapshot.auditFindings,
    threshold: policy.minimumEventCount,
    dataQualityScore,
    rationale:
      "Multiple high or critical enterprise audit findings remain unresolved.",
    recommendedAction:
      "Review finding owners, due dates, repeat themes, CAPA linkage, and verification readiness in Audit Management.",
  });
  addThreshold({
    candidates,
    fingerprint: "organization:training-compliance-gap",
    category: PredictiveSignalCategory.TRAINING_COMPLIANCE_GAP,
    title: "Overdue training compliance gap",
    current: snapshot.overdueTraining,
    threshold: policy.minimumEventCount,
    dataQualityScore,
    rationale:
      "Active users have required training assignments beyond their due date.",
    recommendedAction:
      "Confirm whether assignments remain applicable, then address scheduling and competency gaps in Training.",
  });
  return candidates;
}

function addTrend(input: {
  candidates: Candidate[];
  fingerprint: string;
  category: PredictiveSignalCategory;
  title: string;
  current: number;
  baseline: number;
  minimumEventCount: number;
  threshold: number;
  dataQualityScore: number;
  rationale: string;
  recommendedAction: string;
}) {
  const assessment = assessDeterioratingTrend({
    current: input.current,
    baseline: input.baseline,
    minimumEventCount: input.minimumEventCount,
    deteriorationThresholdPercent: input.threshold,
  });
  if (!assessment.detected) return;
  const severity = signalSeverity({
    current: input.current,
    threshold: Math.max(input.minimumEventCount, 1),
    changePercent: assessment.changePercent,
  });
  input.candidates.push({
    fingerprint: input.fingerprint,
    category: input.category,
    severity,
    direction: assessment.direction,
    title: input.title,
    summary: `${input.current} records in the current window versus ${input.baseline} in the preceding equivalent window (${assessment.changePercent}% change).`,
    rationale: input.rationale,
    recommendedAction: input.recommendedAction,
    evidence: {
      currentWindowCount: input.current,
      comparisonWindowCount: input.baseline,
      governedMinimumCount: input.minimumEventCount,
      governedDeteriorationPercent: input.threshold,
      interpretation: "Prioritization indicator only; not an injury or event probability forecast.",
    },
    currentValue: input.current,
    baselineValue: input.baseline,
    changePercent: assessment.changePercent,
    thresholdValue: input.threshold,
    attentionScore: calculateAttentionScore({
      severity,
      current: input.current,
      threshold: input.minimumEventCount,
      changePercent: assessment.changePercent,
      dataQualityScore: input.dataQualityScore,
    }),
    dataQualityScore: input.dataQualityScore,
  });
}

function addThreshold(input: {
  candidates: Candidate[];
  fingerprint: string;
  category: PredictiveSignalCategory;
  title: string;
  current: number;
  threshold: number;
  dataQualityScore: number;
  rationale: string;
  recommendedAction: string;
}) {
  if (input.current < input.threshold) return;
  const severity = signalSeverity({
    current: input.current,
    threshold: Math.max(input.threshold, 1),
  });
  input.candidates.push({
    fingerprint: input.fingerprint,
    category: input.category,
    severity,
    direction: PredictiveSignalDirection.DETERIORATING,
    title: input.title,
    summary: `${input.current} open records meet the governed attention rule of ${input.threshold}.`,
    rationale: input.rationale,
    recommendedAction: input.recommendedAction,
    evidence: {
      currentCount: input.current,
      governedThreshold: input.threshold,
      interpretation: "Prioritization indicator only; source records require human review.",
    },
    currentValue: input.current,
    baselineValue: 0,
    changePercent: null,
    thresholdValue: input.threshold,
    attentionScore: calculateAttentionScore({
      severity,
      current: input.current,
      threshold: input.threshold,
      dataQualityScore: input.dataQualityScore,
    }),
    dataQualityScore: input.dataQualityScore,
  });
}

async function notifyManagers(
  organizationId: string,
  signals: Array<{ id: string; title: string; severity: RiskLevel }>,
) {
  if (!signals.length) return;
  const recipients = await prisma.user.findMany({
    where: {
      organizationId,
      isActive: true,
      role: {
        in: [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.EHS_MANAGER],
      },
    },
    select: { id: true },
  });
  for (const signal of signals) {
    for (const recipient of recipients) {
      await createNotification({
        organizationId,
        userId: recipient.id,
        type:
          signal.severity === RiskLevel.CRITICAL
            ? NotificationType.CRITICAL
            : NotificationType.WARNING,
        title: `${signal.severity} predictive indicator`,
        message: signal.title,
        link: `/intelligence/predictive/${signal.id}`,
      });
    }
  }
}

function validatePolicy(input: {
  lookbackDays: number;
  minimumEventCount: number;
  deteriorationThresholdPercent: number;
  overdueActionThreshold: number;
  controlFailureThreshold: number;
  reviewCadenceDays: number;
}) {
  if (input.lookbackDays < 30 || input.lookbackDays > 365)
    throw new Error("Lookback window must be between 30 and 365 days.");
  if (input.minimumEventCount < 1 || input.minimumEventCount > 100)
    throw new Error("Minimum event count must be between 1 and 100.");
  if (
    input.deteriorationThresholdPercent < 5 ||
    input.deteriorationThresholdPercent > 500
  )
    throw new Error("Deterioration threshold must be between 5% and 500%.");
  if (input.overdueActionThreshold < 1 || input.controlFailureThreshold < 1)
    throw new Error("Attention thresholds must be at least 1.");
  if (input.reviewCadenceDays < 1 || input.reviewCadenceDays > 90)
    throw new Error("Review cadence must be between 1 and 90 days.");
}

async function log(
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
  return prisma.activityLog.create({
    data: { organizationId, userId, ...data },
  });
}
