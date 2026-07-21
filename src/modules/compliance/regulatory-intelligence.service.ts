import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import { canTransitionRegulatoryChange, canTransitionRegulatorySource } from "@/modules/compliance/regulatory-intelligence-lifecycle";
import { createPreparedSubmissions, type PreparedSubmission } from "@/modules/forms/runtime-form.service";
import {
  ActivityAction,
  ConfigurableFormModule,
  NotificationType,
  RegulatoryAssessmentStatus,
  RegulatoryChangeStatus,
  RegulatoryChangeType,
  RegulatoryImpactDecision,
  RegulatoryObligationRelationship,
  RegulatorySourceStatus,
  RegulatorySourceType,
  RiskLevel,
  Status,
} from "@prisma/client";

const day = 86_400_000;
const assessmentPendingStatuses = new Set<RegulatoryChangeStatus>([RegulatoryChangeStatus.DETECTED, RegulatoryChangeStatus.UNDER_REVIEW, RegulatoryChangeStatus.IMPACT_ASSESSMENT]);
const openChangeStatuses = new Set<RegulatoryChangeStatus>([RegulatoryChangeStatus.DETECTED, RegulatoryChangeStatus.UNDER_REVIEW, RegulatoryChangeStatus.IMPACT_ASSESSMENT, RegulatoryChangeStatus.ACTION_REQUIRED]);
const actionClosedStatuses = new Set<Status>([Status.COMPLETED, Status.CLOSED]);

function validHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

async function tenantUser(organizationId: string, userId: string) {
  return prisma.user.findFirst({ where: { id: userId, organizationId, isActive: true } });
}

export async function createRegulatorySourceService(input: {
  organizationId: string; userId: string; code: string; name: string; authority: string; type: RegulatorySourceType;
  jurisdiction: string; sourceUrl: string; description?: string | null; ownerId: string; reviewCadenceDays: number; nextReviewAt: Date;
}) {
  const [owner, creator] = await Promise.all([tenantUser(input.organizationId, input.ownerId), tenantUser(input.organizationId, input.userId)]);
  if (!owner || !creator) throw new Error("Select a valid tenant source owner.");
  if (!validHttpUrl(input.sourceUrl)) throw new Error("Source URL must be a valid HTTP or HTTPS address.");
  if (!Number.isInteger(input.reviewCadenceDays) || input.reviewCadenceDays < 1 || input.reviewCadenceDays > 3650) throw new Error("Review cadence must be between 1 and 3,650 days.");
  if (input.nextReviewAt <= new Date()) throw new Error("Next source review must be in the future.");
  return prisma.$transaction(async tx => {
    const source = await tx.regulatorySource.create({ data: { organizationId: input.organizationId, code: input.code.toUpperCase(), name: input.name, authority: input.authority, type: input.type, jurisdiction: input.jurisdiction, sourceUrl: input.sourceUrl, description: input.description, ownerId: owner.id, reviewCadenceDays: input.reviewCadenceDays, nextReviewAt: input.nextReviewAt } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: creator.id, action: ActivityAction.CREATE, entityType: "RegulatorySource", entityId: source.id, title: "Regulatory source registered", description: `${source.code} — ${source.name}`, metadata: { authority: source.authority, jurisdiction: source.jurisdiction, sourceUrl: source.sourceUrl, ownerId: source.ownerId } } });
    return source;
  });
}

export async function changeRegulatorySourceStatusService(input: { organizationId: string; userId: string; sourceId: string; status: RegulatorySourceStatus; reason: string }) {
  const [source, user] = await Promise.all([prisma.regulatorySource.findFirst({ where: { id: input.sourceId, organizationId: input.organizationId } }), tenantUser(input.organizationId, input.userId)]);
  if (!source || !user) throw new Error("Regulatory source not found in this organization.");
  if (!canTransitionRegulatorySource(source.status, input.status)) throw new Error(`A source cannot move from ${source.status.toLowerCase()} to ${input.status.toLowerCase()}.`);
  if (!input.reason.trim()) throw new Error("Record the reason for the source status change.");
  return prisma.$transaction(async tx => {
    const updated = await tx.regulatorySource.update({ where: { id: source.id }, data: { status: input.status } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: user.id, action: ActivityAction.STATUS_CHANGE, entityType: "RegulatorySource", entityId: source.id, title: "Regulatory source status changed", description: `${source.status} → ${updated.status}: ${input.reason}`, metadata: { previousStatus: source.status, status: updated.status, reason: input.reason } } });
    return updated;
  });
}

export async function recordRegulatorySourceReviewService(input: { organizationId: string; userId: string; sourceId: string; notes: string }) {
  const [source, reviewer] = await Promise.all([prisma.regulatorySource.findFirst({ where: { id: input.sourceId, organizationId: input.organizationId } }), tenantUser(input.organizationId, input.userId)]);
  if (!source || !reviewer) throw new Error("Regulatory source not found in this organization.");
  if (source.status === RegulatorySourceStatus.RETIRED) throw new Error("Retired sources cannot receive monitoring reviews.");
  if (!input.notes.trim()) throw new Error("Record the source review outcome and any detected changes.");
  const reviewedAt = new Date();
  const nextReviewAt = new Date(reviewedAt.getTime() + source.reviewCadenceDays * day);
  return prisma.$transaction(async tx => {
    const updated = await tx.regulatorySource.update({ where: { id: source.id }, data: { lastReviewedAt: reviewedAt, lastReviewedById: reviewer.id, nextReviewAt, reviewReminderAt: null } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: reviewer.id, action: ActivityAction.UPDATE, entityType: "RegulatorySource", entityId: source.id, title: "Regulatory source reviewed", description: input.notes, metadata: { previousReviewDueAt: source.nextReviewAt, nextReviewAt } } });
    return updated;
  });
}

export async function createRegulatoryChangeService(input: {
  organizationId: string; userId: string; sourceId: string; reference: string; title: string; summary: string; type: RegulatoryChangeType;
  significance: RiskLevel; sourceUrl: string; citation: string; publishedAt?: Date | null; effectiveAt?: Date | null; assessmentDueAt: Date; ownerId: string; customSubmissions?: PreparedSubmission[];
}) {
  const [source, owner, detector] = await Promise.all([
    prisma.regulatorySource.findFirst({ where: { id: input.sourceId, organizationId: input.organizationId } }),
    tenantUser(input.organizationId, input.ownerId), tenantUser(input.organizationId, input.userId),
  ]);
  if (!source || !owner || !detector) throw new Error("Select a valid tenant source and change owner.");
  if (source.status !== RegulatorySourceStatus.ACTIVE) throw new Error("Changes can only be recorded against an active regulatory source.");
  if (!validHttpUrl(input.sourceUrl)) throw new Error("Change source URL must be a valid HTTP or HTTPS address.");
  if (!input.citation.trim()) throw new Error("Record a precise source citation or section reference.");
  if (input.publishedAt && input.effectiveAt && input.effectiveAt < input.publishedAt) throw new Error("The effective date cannot be earlier than the publication date.");
  if (input.assessmentDueAt <= new Date()) throw new Error("Impact-assessment due date must be in the future.");
  return prisma.$transaction(async tx => {
    const change = await tx.regulatoryChange.create({ data: { organizationId: input.organizationId, sourceId: source.id, reference: input.reference.toUpperCase(), title: input.title, summary: input.summary, type: input.type, significance: input.significance, sourceUrl: input.sourceUrl, citation: input.citation, publishedAt: input.publishedAt, effectiveAt: input.effectiveAt, assessmentDueAt: input.assessmentDueAt, ownerId: owner.id, detectedById: detector.id } });
    await createPreparedSubmissions(tx, { organizationId: input.organizationId, userId: detector.id, module: ConfigurableFormModule.REGULATORY_INTELLIGENCE, entityId: change.id, submissions: input.customSubmissions ?? [] });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: detector.id, action: ActivityAction.CREATE, entityType: "RegulatoryChange", entityId: change.id, title: "Regulatory change detected", description: `${change.reference} — ${change.title}`, metadata: { sourceId: source.id, type: change.type, significance: change.significance, citation: change.citation, assessmentDueAt: change.assessmentDueAt } } });
    return change;
  });
}

export async function startRegulatoryChangeReviewService(input: { organizationId: string; userId: string; changeId: string; note: string }) {
  const [change, user] = await Promise.all([prisma.regulatoryChange.findFirst({ where: { id: input.changeId, organizationId: input.organizationId } }), tenantUser(input.organizationId, input.userId)]);
  if (!change || !user) throw new Error("Regulatory change not found in this organization.");
  if (!canTransitionRegulatoryChange(change.status, RegulatoryChangeStatus.UNDER_REVIEW)) throw new Error("This regulatory change cannot enter review from its current status.");
  if (!input.note.trim()) throw new Error("Record the initial review scope.");
  return prisma.$transaction(async tx => {
    const updated = await tx.regulatoryChange.update({ where: { id: change.id }, data: { status: RegulatoryChangeStatus.UNDER_REVIEW } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: user.id, action: ActivityAction.STATUS_CHANGE, entityType: "RegulatoryChange", entityId: change.id, title: "Regulatory change review started", description: input.note, metadata: { previousStatus: change.status, status: updated.status } } });
    return updated;
  });
}

export async function submitRegulatoryImpactAssessmentService(input: {
  organizationId: string; userId: string; changeId: string; decision: RegulatoryImpactDecision; applicabilityRationale: string;
  impactSummary?: string | null; gapSummary?: string | null; requiredActions?: string | null; implementationDueAt?: Date | null;
}) {
  const [change, assessor] = await Promise.all([prisma.regulatoryChange.findFirst({ where: { id: input.changeId, organizationId: input.organizationId }, include: { assessments: { where: { status: RegulatoryAssessmentStatus.SUBMITTED }, select: { id: true } } } }), tenantUser(input.organizationId, input.userId)]);
  if (!change || !assessor) throw new Error("Regulatory change not found in this organization.");
  if (change.status !== RegulatoryChangeStatus.DETECTED && change.status !== RegulatoryChangeStatus.UNDER_REVIEW) throw new Error("A new impact assessment cannot be submitted from the current change status.");
  if (change.assessments.length) throw new Error("This change already has an impact assessment awaiting review.");
  if (!input.applicabilityRationale.trim()) throw new Error("Record the applicability rationale.");
  if (input.decision === RegulatoryImpactDecision.APPLICABLE) {
    if (!input.impactSummary?.trim() || !input.requiredActions?.trim()) throw new Error("Applicable changes require an impact summary and required actions.");
    if (!input.implementationDueAt || input.implementationDueAt <= new Date()) throw new Error("Applicable changes require a future implementation due date.");
  }
  return prisma.$transaction(async tx => {
    const assessment = await tx.regulatoryImpactAssessment.create({ data: { organizationId: input.organizationId, changeId: change.id, assessorId: assessor.id, decision: input.decision, applicabilityRationale: input.applicabilityRationale, impactSummary: input.impactSummary, gapSummary: input.gapSummary, requiredActions: input.requiredActions, implementationDueAt: input.decision === RegulatoryImpactDecision.APPLICABLE ? input.implementationDueAt : null } });
    await tx.regulatoryChange.update({ where: { id: change.id }, data: { status: RegulatoryChangeStatus.IMPACT_ASSESSMENT, assessmentReminderAt: null } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: assessor.id, action: ActivityAction.CREATE, entityType: "RegulatoryImpactAssessment", entityId: assessment.id, title: "Regulatory impact assessment submitted", description: `${change.reference}: ${assessment.decision.replaceAll("_", " ")}`, metadata: { changeId: change.id, decision: assessment.decision, implementationDueAt: assessment.implementationDueAt } } });
    return assessment;
  });
}

export async function reviewRegulatoryImpactAssessmentService(input: { organizationId: string; userId: string; assessmentId: string; approved: boolean; reviewNotes: string }) {
  const [assessment, approver] = await Promise.all([prisma.regulatoryImpactAssessment.findFirst({ where: { id: input.assessmentId, organizationId: input.organizationId }, include: { change: true } }), tenantUser(input.organizationId, input.userId)]);
  if (!assessment || !approver) throw new Error("Regulatory impact assessment not found in this organization.");
  if (assessment.status !== RegulatoryAssessmentStatus.SUBMITTED || assessment.change.status !== RegulatoryChangeStatus.IMPACT_ASSESSMENT) throw new Error("This assessment is not awaiting review.");
  if (!input.reviewNotes.trim()) throw new Error("Record the assessment review rationale.");
  const nextStatus = input.approved ? (assessment.decision === RegulatoryImpactDecision.APPLICABLE ? RegulatoryChangeStatus.ACTION_REQUIRED : RegulatoryChangeStatus.NOT_APPLICABLE) : RegulatoryChangeStatus.UNDER_REVIEW;
  if (!canTransitionRegulatoryChange(assessment.change.status, nextStatus)) throw new Error("The assessment decision is not valid from the current change status.");
  return prisma.$transaction(async tx => {
    const reviewed = await tx.regulatoryImpactAssessment.update({ where: { id: assessment.id }, data: { status: input.approved ? RegulatoryAssessmentStatus.APPROVED : RegulatoryAssessmentStatus.REJECTED, reviewedById: approver.id, reviewedAt: new Date(), reviewNotes: input.reviewNotes } });
    await tx.regulatoryChange.update({ where: { id: assessment.changeId }, data: { status: nextStatus } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: approver.id, action: ActivityAction.STATUS_CHANGE, entityType: "RegulatoryImpactAssessment", entityId: assessment.id, title: input.approved ? "Regulatory impact assessment approved" : "Regulatory impact assessment rejected", description: input.reviewNotes, metadata: { changeId: assessment.changeId, decision: assessment.decision, assessmentStatus: reviewed.status, changeStatus: nextStatus } } });
    return reviewed;
  });
}

export async function linkRegulatoryObligationService(input: { organizationId: string; userId: string; changeId: string; complianceItemId: string; relationship: RegulatoryObligationRelationship; notes?: string | null }) {
  const [change, item, user] = await Promise.all([
    prisma.regulatoryChange.findFirst({ where: { id: input.changeId, organizationId: input.organizationId } }),
    prisma.complianceItem.findFirst({ where: { id: input.complianceItemId, site: { organizationId: input.organizationId } } }), tenantUser(input.organizationId, input.userId),
  ]);
  if (!change || !item || !user) throw new Error("Select a valid tenant regulatory change and compliance obligation.");
  if (change.status !== RegulatoryChangeStatus.ACTION_REQUIRED && change.status !== RegulatoryChangeStatus.IMPLEMENTED) throw new Error("Obligations can be linked after an applicable impact assessment is approved.");
  if (item.regulatorySourceId && item.regulatorySourceId !== change.sourceId) throw new Error("This obligation is already governed by a different regulatory source.");
  return prisma.$transaction(async tx => {
    const link = await tx.regulatoryChangeObligationLink.create({ data: { changeId: change.id, complianceItemId: item.id, relationship: input.relationship, notes: input.notes } });
    if (!item.regulatorySourceId) await tx.complianceItem.update({ where: { id: item.id }, data: { regulatorySourceId: change.sourceId } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: user.id, action: ActivityAction.UPDATE, entityType: "RegulatoryChange", entityId: change.id, title: "Regulatory obligation linked", description: `${item.reference || item.id} — ${item.title}`, metadata: { complianceItemId: item.id, relationship: link.relationship } } });
    return link;
  });
}

export async function createCapaFromRegulatoryChangeService(input: { organizationId: string; userId: string; changeId: string; title: string; description?: string | null; assignedToId: string; dueDate: Date }) {
  const [change, creator, assignee] = await Promise.all([prisma.regulatoryChange.findFirst({ where: { id: input.changeId, organizationId: input.organizationId } }), tenantUser(input.organizationId, input.userId), tenantUser(input.organizationId, input.assignedToId)]);
  if (!change || !creator || !assignee) throw new Error("Select a valid tenant regulatory change and corrective-action owner.");
  if (change.status !== RegulatoryChangeStatus.ACTION_REQUIRED) throw new Error("Corrective actions can only be created for an applicable change requiring action.");
  if (input.dueDate <= new Date()) throw new Error("Corrective-action due date must be in the future.");
  const action = await prisma.$transaction(async tx => {
    const created = await tx.correctiveAction.create({ data: { title: input.title, description: input.description, status: Status.OPEN, riskLevel: change.significance, dueDate: input.dueDate, assignedToId: assignee.id } });
    await tx.regulatoryChangeActionLink.create({ data: { changeId: change.id, correctiveActionId: created.id } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: creator.id, action: ActivityAction.CREATE, entityType: "CorrectiveAction", entityId: created.id, title: "Regulatory change CAPA created", description: `${change.reference} — ${created.title}`, metadata: { changeId: change.id, assignedToId: assignee.id, dueDate: created.dueDate } } });
    return created;
  });
  await createNotification({ organizationId: input.organizationId, userId: assignee.id, type: NotificationType.ASSIGNMENT, title: "Regulatory implementation action assigned", message: `${change.reference} — ${action.title}`, link: `/actions/${action.id}` }).catch(() => undefined);
  return action;
}

export async function markRegulatoryChangeImplementedService(input: { organizationId: string; userId: string; changeId: string; implementationSummary: string }) {
  const [change, user] = await Promise.all([prisma.regulatoryChange.findFirst({ where: { id: input.changeId, organizationId: input.organizationId }, include: { assessments: { where: { status: RegulatoryAssessmentStatus.APPROVED, decision: RegulatoryImpactDecision.APPLICABLE } }, obligationLinks: true, actionLinks: { include: { correctiveAction: true } } } }), tenantUser(input.organizationId, input.userId)]);
  if (!change || !user) throw new Error("Regulatory change not found in this organization.");
  if (!canTransitionRegulatoryChange(change.status, RegulatoryChangeStatus.IMPLEMENTED)) throw new Error("This regulatory change is not ready for implementation closure.");
  if (!change.assessments.length) throw new Error("An approved applicable impact assessment is required.");
  if (!change.obligationLinks.length) throw new Error("Link at least one updated or created compliance obligation before recording implementation.");
  const openActions = change.actionLinks.filter(link => !actionClosedStatuses.has(link.correctiveAction.status));
  if (openActions.length) throw new Error(`${openActions.length} linked corrective action${openActions.length === 1 ? " remains" : "s remain"} open.`);
  if (!input.implementationSummary.trim()) throw new Error("Record the implementation evidence and outcome.");
  return prisma.$transaction(async tx => {
    const updated = await tx.regulatoryChange.update({ where: { id: change.id }, data: { status: RegulatoryChangeStatus.IMPLEMENTED, implementedAt: new Date(), implementedById: user.id, implementationSummary: input.implementationSummary } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: user.id, action: ActivityAction.STATUS_CHANGE, entityType: "RegulatoryChange", entityId: change.id, title: "Regulatory change implemented", description: input.implementationSummary, metadata: { previousStatus: change.status, status: updated.status, obligationCount: change.obligationLinks.length, actionCount: change.actionLinks.length } } });
    return updated;
  });
}

export async function closeRegulatoryChangeService(input: { organizationId: string; userId: string; changeId: string; rationale: string }) {
  const [change, user] = await Promise.all([prisma.regulatoryChange.findFirst({ where: { id: input.changeId, organizationId: input.organizationId } }), tenantUser(input.organizationId, input.userId)]);
  if (!change || !user) throw new Error("Regulatory change not found in this organization.");
  if (!canTransitionRegulatoryChange(change.status, RegulatoryChangeStatus.CLOSED)) throw new Error("Only implemented or approved not-applicable changes can be closed.");
  if (!input.rationale.trim()) throw new Error("Record the closure rationale.");
  return prisma.$transaction(async tx => {
    const updated = await tx.regulatoryChange.update({ where: { id: change.id }, data: { status: RegulatoryChangeStatus.CLOSED, closedAt: new Date(), closeRationale: input.rationale } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: user.id, action: ActivityAction.STATUS_CHANGE, entityType: "RegulatoryChange", entityId: change.id, title: "Regulatory change closed", description: input.rationale, metadata: { previousStatus: change.status, status: updated.status } } });
    return updated;
  });
}

export async function getRegulatoryIntelligenceDashboardService(organizationId: string, now = new Date()) {
  const soon = new Date(now.getTime() + 30 * day);
  const [sources, changes, obligations] = await Promise.all([
    prisma.regulatorySource.findMany({ where: { organizationId }, include: { owner: true, _count: { select: { changes: true, obligations: true } } }, orderBy: { nextReviewAt: "asc" } }),
    prisma.regulatoryChange.findMany({ where: { organizationId }, include: { source: true, owner: true, assessments: { orderBy: { submittedAt: "desc" }, take: 1 }, obligationLinks: true, actionLinks: { include: { correctiveAction: true } } }, orderBy: { detectedAt: "desc" } }),
    prisma.complianceItem.count({ where: { site: { organizationId }, regulatorySourceId: { not: null } } }),
  ]);
  return {
    sources, changes,
    metrics: {
      activeSources: sources.filter(source => source.status === RegulatorySourceStatus.ACTIVE).length,
      sourceReviewsOverdue: sources.filter(source => source.status === RegulatorySourceStatus.ACTIVE && source.nextReviewAt < now).length,
      openChanges: changes.filter(change => openChangeStatuses.has(change.status)).length,
      assessmentsOverdue: changes.filter(change => assessmentPendingStatuses.has(change.status) && change.assessmentDueAt < now).length,
      effectiveWithin30Days: changes.filter(change => change.effectiveAt && change.effectiveAt >= now && change.effectiveAt <= soon && openChangeStatuses.has(change.status)).length,
      criticalExposure: changes.filter(change => change.significance === RiskLevel.CRITICAL && openChangeStatuses.has(change.status)).length,
      governedObligations: obligations,
      implementationActionsOpen: changes.reduce((sum, change) => sum + change.actionLinks.filter(link => !actionClosedStatuses.has(link.correctiveAction.status)).length, 0),
    },
  };
}

export async function processRegulatoryIntelligenceMonitoring(now = new Date()) {
  const sourceHorizon = new Date(now.getTime() + 14 * day);
  const effectiveHorizon = new Date(now.getTime() + 30 * day);
  const [sources, assessmentChanges, effectiveChanges] = await Promise.all([
    prisma.regulatorySource.findMany({ where: { status: RegulatorySourceStatus.ACTIVE, nextReviewAt: { lte: sourceHorizon }, reviewReminderAt: null } }),
    prisma.regulatoryChange.findMany({ where: { status: { in: [RegulatoryChangeStatus.DETECTED, RegulatoryChangeStatus.UNDER_REVIEW, RegulatoryChangeStatus.IMPACT_ASSESSMENT] }, assessmentDueAt: { lte: now }, assessmentReminderAt: null } }),
    prisma.regulatoryChange.findMany({ where: { status: RegulatoryChangeStatus.ACTION_REQUIRED, effectiveAt: { lte: effectiveHorizon }, effectiveReminderAt: null } }),
  ]);
  let notificationsSent = 0;
  for (const source of sources) {
    const notification = await createNotification({ organizationId: source.organizationId, userId: source.ownerId, type: source.nextReviewAt < now ? NotificationType.CRITICAL : NotificationType.DUE_DATE, title: `Regulatory source review ${source.nextReviewAt < now ? "overdue" : "due soon"}`, message: `${source.code} — ${source.name}`, link: "/compliance/regulatory" }).catch(() => null);
    if (notification) { await prisma.regulatorySource.update({ where: { id: source.id }, data: { reviewReminderAt: now } }); notificationsSent++; }
  }
  for (const change of assessmentChanges) {
    const notification = await createNotification({ organizationId: change.organizationId, userId: change.ownerId, type: NotificationType.CRITICAL, title: "Regulatory impact assessment overdue", message: `${change.reference} — ${change.title}`, link: `/compliance/regulatory/changes/${change.id}` }).catch(() => null);
    if (notification) { await prisma.regulatoryChange.update({ where: { id: change.id }, data: { assessmentReminderAt: now } }); notificationsSent++; }
  }
  for (const change of effectiveChanges) {
    const notification = await createNotification({ organizationId: change.organizationId, userId: change.ownerId, type: change.significance === RiskLevel.CRITICAL ? NotificationType.CRITICAL : NotificationType.WARNING, title: "Regulatory effective date approaching", message: `${change.reference} — ${change.title}`, link: `/compliance/regulatory/changes/${change.id}` }).catch(() => null);
    if (notification) { await prisma.regulatoryChange.update({ where: { id: change.id }, data: { effectiveReminderAt: now } }); notificationsSent++; }
  }
  return { sourcesDue: sources.length, assessmentsOverdue: assessmentChanges.length, effectiveDatesApproaching: effectiveChanges.length, notificationsSent };
}
