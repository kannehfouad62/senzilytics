import {
  AuditExternalAccessStatus,
  AuditExternalDecisionType,
  AuditExternalFindingReviewStatus,
  AuditInformationRequestStatus,
  AuditServiceDeliverableStatus,
  AuditServiceEngagementStatus,
  AuditServicePlanningStatus,
  AuditServiceRiskRating,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const terminalEngagements = new Set<AuditServiceEngagementStatus>([
  AuditServiceEngagementStatus.COMPLETED,
  AuditServiceEngagementStatus.CANCELLED,
]);
const terminalRequests = new Set<AuditInformationRequestStatus>([
  AuditInformationRequestStatus.ACCEPTED,
  AuditInformationRequestStatus.CLOSED,
  AuditInformationRequestStatus.CANCELLED,
]);
const label = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const distribution = (values: string[]) => {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts].map(([name, value]) => ({ label: label(name), value }));
};

export async function getAuditServiceAnalytics(
  organizationId: string,
  days = 365,
) {
  const now = new Date();
  const from = new Date(
    now.getTime() - Math.min(365, Math.max(30, days)) * 86_400_000,
  );
  const [
    engagements,
    requests,
    accesses,
    findingResponses,
    deliverables,
    downloads,
  ] = await Promise.all([
    prisma.auditServiceEngagement.findMany({
      where: { organizationId },
      select: {
        id: true,
        reference: true,
        title: true,
        kind: true,
        status: true,
        planningStatus: true,
        riskRating: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
        _count: { select: { audits: true, deliverables: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.auditServiceInformationRequest.findMany({
      where: { organizationId },
      select: { status: true, dueDate: true, createdAt: true },
    }),
    prisma.auditServiceExternalAccess.findMany({
      where: { organizationId },
      select: {
        status: true,
        expiresAt: true,
        verifiedAt: true,
        createdAt: true,
        decision: { select: { decision: true, decidedAt: true } },
      },
    }),
    prisma.auditServiceExternalFindingResponse.findMany({
      where: { organizationId },
      select: { reviewStatus: true, submittedAt: true },
    }),
    prisma.auditServiceDeliverable.findMany({
      where: { organizationId },
      select: { status: true, type: true, releasedAt: true, createdAt: true },
    }),
    prisma.auditServiceDeliverableDownload.findMany({
      where: { organizationId, downloadedAt: { gte: from } },
      select: { downloadedAt: true, accessId: true },
    }),
  ]);

  const openEngagements = engagements.filter(
    (item) => !terminalEngagements.has(item.status),
  );
  const overdueEngagements = openEngagements.filter(
    (item) => item.dueDate && item.dueDate < now,
  );
  const completedWithDueDate = engagements.filter(
    (item) => item.completedAt && item.dueDate,
  );
  const onTime = completedWithDueDate.filter(
    (item) => item.completedAt! <= item.dueDate!,
  );
  const openRequests = requests.filter(
    (item) => !terminalRequests.has(item.status),
  );
  const overdueRequests = openRequests.filter(
    (item) => item.dueDate && item.dueDate < now,
  );
  const activeAccesses = accesses.filter(
    (item) =>
      item.status === AuditExternalAccessStatus.ACTIVE && item.expiresAt > now,
  );
  const decisions = accesses.flatMap((item) =>
    item.decision ? [item.decision] : [],
  );
  const acceptedDecisions = decisions.filter(
    (item) =>
      item.decision === AuditExternalDecisionType.APPROVED ||
      item.decision === AuditExternalDecisionType.ACKNOWLEDGED,
  );
  const reviewQueue = deliverables.filter(
    (item) =>
      item.status === AuditServiceDeliverableStatus.UNDER_REVIEW ||
      item.status === AuditServiceDeliverableStatus.CHANGES_REQUESTED,
  );
  const months = Array.from(
    { length: 12 },
    (_, index) => new Date(now.getFullYear(), now.getMonth() - 11 + index, 1),
  );
  const trend = months.map((month) => {
    const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const within = (date: Date | null) =>
      Boolean(date && date >= month && date < next);
    return {
      month: month.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      started: engagements.filter((item) => within(item.createdAt)).length,
      completed: engagements.filter((item) => within(item.completedAt)).length,
      released: deliverables.filter((item) => within(item.releasedAt)).length,
      decisions: decisions.filter((item) => within(item.decidedAt)).length,
    };
  });
  const clientMap = new Map<
    string,
    { id: string; name: string; total: number; open: number; overdue: number }
  >();
  engagements.forEach((engagement) => {
    if (!engagement.client) return;
    const row = clientMap.get(engagement.client.id) ?? {
      id: engagement.client.id,
      name: engagement.client.name,
      total: 0,
      open: 0,
      overdue: 0,
    };
    row.total += 1;
    if (!terminalEngagements.has(engagement.status)) row.open += 1;
    if (
      engagement.dueDate &&
      engagement.dueDate < now &&
      !terminalEngagements.has(engagement.status)
    )
      row.overdue += 1;
    clientMap.set(row.id, row);
  });

  return {
    generatedAt: now,
    summary: {
      totalEngagements: engagements.length,
      openEngagements: openEngagements.length,
      externalEngagements: engagements.filter(
        (item) => item.kind === "EXTERNAL",
      ).length,
      overdueEngagements: overdueEngagements.length,
      highRiskEngagements: openEngagements.filter(
        (item) =>
          item.riskRating === AuditServiceRiskRating.HIGH ||
          item.riskRating === AuditServiceRiskRating.CRITICAL,
      ).length,
      planningExceptions: openEngagements.filter(
        (item) => item.planningStatus !== AuditServicePlanningStatus.APPROVED,
      ).length,
      onTimeCompletionRate: completedWithDueDate.length
        ? Math.round((onTime.length / completedWithDueDate.length) * 100)
        : 100,
      openRequests: openRequests.length,
      overdueRequests: overdueRequests.length,
      activeExternalAccesses: activeAccesses.length,
      pendingClientDecisions: activeAccesses.filter((item) => !item.decision)
        .length,
      clientAcceptanceRate: decisions.length
        ? Math.round((acceptedDecisions.length / decisions.length) * 100)
        : null,
      pendingFindingResponses: findingResponses.filter(
        (item) =>
          item.reviewStatus === AuditExternalFindingReviewStatus.PENDING ||
          item.reviewStatus ===
            AuditExternalFindingReviewStatus.CHANGES_REQUESTED,
      ).length,
      deliverableReviewQueue: reviewQueue.length,
      releasedDeliverables: deliverables.filter(
        (item) => item.status === AuditServiceDeliverableStatus.RELEASED,
      ).length,
      recentDownloads: downloads.length,
      externalDownloads: downloads.filter((item) => item.accessId).length,
    },
    statusDistribution: distribution(engagements.map((item) => item.status)),
    riskDistribution: distribution(engagements.map((item) => item.riskRating)),
    deliverableDistribution: distribution(
      deliverables.map((item) => item.status),
    ),
    decisionDistribution: distribution(decisions.map((item) => item.decision)),
    trend,
    clients: [...clientMap.values()]
      .sort((a, b) => b.overdue - a.overdue || b.open - a.open)
      .slice(0, 10),
    attention: overdueEngagements
      .slice(0, 10)
      .map((item) => ({
        id: item.id,
        reference: item.reference,
        title: item.title,
        clientName: item.client?.name ?? "Internal",
        dueDate: item.dueDate!,
      })),
  };
}

export type AuditServiceAnalytics = Awaited<
  ReturnType<typeof getAuditServiceAnalytics>
>;
