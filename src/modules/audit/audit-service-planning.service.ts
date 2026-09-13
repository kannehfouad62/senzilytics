import { logActivity } from "@/core/activity-log/activity-log.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  AuditIndependenceDecision,
  AuditServicePlanningStatus,
  AuditServiceRiskRating,
} from "@prisma/client";

export function auditPlanningReadiness(input: {
  purpose: string;
  scope: string;
  criteria: string | null;
  managerId: string | null;
  leadAuditorId: string | null;
  plannedStartDate: Date | null;
  dueDate: Date | null;
  teamUserIds: string[];
  declarations: { userId: string; decision: AuditIndependenceDecision }[];
}) {
  const controls = [
    {
      key: "scope",
      passed: Boolean(
        input.purpose.trim() && input.scope.trim() && input.criteria?.trim(),
      ),
    },
    {
      key: "leadership",
      passed: Boolean(input.managerId && input.leadAuditorId),
    },
    {
      key: "schedule",
      passed: Boolean(input.plannedStartDate && input.dueDate),
    },
    { key: "team", passed: input.teamUserIds.length > 0 },
    {
      key: "independence",
      passed:
        input.teamUserIds.length > 0 &&
        input.teamUserIds.every((userId) =>
          input.declarations.some(
            (item) =>
              item.userId === userId &&
              (item.decision === AuditIndependenceDecision.CLEARED ||
                item.decision === AuditIndependenceDecision.MITIGATED),
          ),
        ),
    },
  ];
  return {
    controls,
    ready: controls.every((item) => item.passed),
    percentage: Math.round(
      (controls.filter((item) => item.passed).length / controls.length) * 100,
    ),
  };
}

export async function declareAuditServiceIndependence(input: {
  organizationId: string;
  actorId: string;
  engagementId: string;
  userId: string;
  conflictDeclared: boolean;
  declaration: string;
  safeguards?: string | null;
}) {
  const member = await prisma.auditServiceEngagementTeamMember.findFirst({
    where: {
      engagementId: input.engagementId,
      userId: input.userId,
      engagement: { organizationId: input.organizationId },
    },
  });
  if (!member)
    throw new Error(
      "Only an assigned engagement team member may submit this declaration.",
    );
  if (input.actorId !== input.userId)
    throw new Error(
      "Independence declarations must be submitted by the declarant.",
    );
  if (!input.declaration.trim())
    throw new Error("An independence declaration is required.");
  if (input.conflictDeclared && !input.safeguards?.trim())
    throw new Error("Describe proposed safeguards for the declared conflict.");
  const record = await prisma.auditServiceIndependenceDeclaration.upsert({
    where: {
      engagementId_userId: {
        engagementId: input.engagementId,
        userId: input.userId,
      },
    },
    create: {
      organizationId: input.organizationId,
      engagementId: input.engagementId,
      userId: input.userId,
      conflictDeclared: input.conflictDeclared,
      declaration: input.declaration.trim(),
      safeguards: input.safeguards?.trim() || null,
    },
    update: {
      conflictDeclared: input.conflictDeclared,
      declaration: input.declaration.trim(),
      safeguards: input.safeguards?.trim() || null,
      decision: AuditIndependenceDecision.PENDING,
      reviewedById: null,
      reviewedAt: null,
      reviewNotes: null,
    },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.actorId,
    action: ActivityAction.CREATE,
    entityType: "AuditServiceIndependenceDeclaration",
    entityId: record.id,
    title: "Auditor independence declared",
    metadata: {
      engagementId: input.engagementId,
      conflictDeclared: input.conflictDeclared,
    },
  });
}

export async function reviewAuditServiceIndependence(input: {
  organizationId: string;
  reviewerId: string;
  declarationId: string;
  decision: AuditIndependenceDecision;
  notes?: string | null;
}) {
  const declaration =
    await prisma.auditServiceIndependenceDeclaration.findFirst({
      where: { id: input.declarationId, organizationId: input.organizationId },
    });
  if (!declaration) throw new Error("Independence declaration not found.");
  if (declaration.userId === input.reviewerId)
    throw new Error(
      "A declarant cannot review their own independence declaration.",
    );
  if (input.decision === AuditIndependenceDecision.PENDING)
    throw new Error("Select a final review decision.");
  if (
    declaration.conflictDeclared &&
    input.decision === AuditIndependenceDecision.CLEARED
  )
    throw new Error("A declared conflict must be mitigated or rejected.");
  await prisma.auditServiceIndependenceDeclaration.update({
    where: { id: declaration.id },
    data: {
      decision: input.decision,
      reviewNotes: input.notes?.trim() || null,
      reviewedById: input.reviewerId,
      reviewedAt: new Date(),
    },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.reviewerId,
    action: ActivityAction.STATUS_CHANGE,
    entityType: "AuditServiceIndependenceDeclaration",
    entityId: declaration.id,
    title: "Auditor independence reviewed",
    metadata: { decision: input.decision },
  });
}

export async function submitAuditServicePlan(input: {
  organizationId: string;
  userId: string;
  engagementId: string;
  riskRating: AuditServiceRiskRating;
  riskRationale: string;
  planningNotes?: string | null;
}) {
  const engagement = await prisma.auditServiceEngagement.findFirst({
    where: { id: input.engagementId, organizationId: input.organizationId },
    include: { teamMembers: true, independenceDeclarations: true },
  });
  if (!engagement) throw new Error("Audit engagement not found.");
  if (
    engagement.planningStatus !== AuditServicePlanningStatus.DRAFT &&
    engagement.planningStatus !== AuditServicePlanningStatus.CHANGES_REQUESTED
  )
    throw new Error(
      "This audit plan cannot be submitted from its current status.",
    );
  if (!input.riskRationale.trim())
    throw new Error("Risk rationale is required.");
  const readiness = auditPlanningReadiness({
    ...engagement,
    teamUserIds: engagement.teamMembers.map((item) => item.userId),
    declarations: engagement.independenceDeclarations,
  });
  if (!readiness.ready)
    throw new Error(`Audit planning is only ${readiness.percentage}% ready.`);
  await prisma.auditServiceEngagement.update({
    where: { id: engagement.id },
    data: {
      riskRating: input.riskRating,
      riskRationale: input.riskRationale.trim(),
      planningNotes: input.planningNotes?.trim() || null,
      planningStatus: AuditServicePlanningStatus.SUBMITTED,
      planningSubmittedById: input.userId,
      planningSubmittedAt: new Date(),
      planningReviewedById: null,
      planningReviewedAt: null,
      planningReviewNotes: null,
    },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.STATUS_CHANGE,
    entityType: "AuditServiceEngagement",
    entityId: engagement.id,
    title: "Audit service plan submitted",
    metadata: { riskRating: input.riskRating },
  });
}

export async function reviewAuditServicePlan(input: {
  organizationId: string;
  reviewerId: string;
  engagementId: string;
  decision: "APPROVED" | "CHANGES_REQUESTED";
  notes?: string | null;
}) {
  const engagement = await prisma.auditServiceEngagement.findFirst({
    where: { id: input.engagementId, organizationId: input.organizationId },
  });
  if (
    !engagement ||
    engagement.planningStatus !== AuditServicePlanningStatus.SUBMITTED
  )
    throw new Error("Only a submitted audit plan may be reviewed.");
  if (engagement.planningSubmittedById === input.reviewerId)
    throw new Error("The plan submitter cannot approve their own plan.");
  if (input.decision === "CHANGES_REQUESTED" && !input.notes?.trim())
    throw new Error("Review notes are required when changes are requested.");
  await prisma.auditServiceEngagement.update({
    where: { id: engagement.id },
    data: {
      planningStatus: input.decision,
      planningReviewedById: input.reviewerId,
      planningReviewedAt: new Date(),
      planningReviewNotes: input.notes?.trim() || null,
    },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.reviewerId,
    action: ActivityAction.STATUS_CHANGE,
    entityType: "AuditServiceEngagement",
    entityId: engagement.id,
    title: `Audit service plan ${input.decision === "APPROVED" ? "approved" : "returned"}`,
    metadata: { decision: input.decision },
  });
}
