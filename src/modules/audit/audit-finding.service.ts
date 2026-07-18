import { logActivity } from "@/core/activity-log/activity-log.service";
import { sendCorrectiveActionAssignmentEmail } from "@/core/notifications/notification-email.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import { createRiskService } from "@/modules/risk/risk.service";
import {
  ActivityAction,
  EnterpriseAuditEvidenceType,
  EnterpriseAuditFindingCategory,
  EnterpriseAuditFindingStatus,
  EnterpriseAuditFindingType,
  EnterpriseAuditHistoryAction,
  EnterpriseAuditLinkStatus,
  EnterpriseAuditSeverity,
  EnterpriseAuditVerificationStatus,
  NotificationType,
  RiskCategory,
  RiskImpact,
  RiskLevel,
  RiskLikelihood,
  RiskReviewFrequency,
  Status,
} from "@prisma/client";

const allowedTransitions: Record<EnterpriseAuditFindingStatus, EnterpriseAuditFindingStatus[]> = {
  DRAFT: [EnterpriseAuditFindingStatus.OPEN, EnterpriseAuditFindingStatus.CANCELLED],
  OPEN: [EnterpriseAuditFindingStatus.UNDER_REVIEW, EnterpriseAuditFindingStatus.ACTION_REQUIRED, EnterpriseAuditFindingStatus.CANCELLED],
  UNDER_REVIEW: [EnterpriseAuditFindingStatus.OPEN, EnterpriseAuditFindingStatus.ACTION_REQUIRED, EnterpriseAuditFindingStatus.REJECTED],
  ACTION_REQUIRED: [EnterpriseAuditFindingStatus.IN_PROGRESS, EnterpriseAuditFindingStatus.CANCELLED],
  IN_PROGRESS: [EnterpriseAuditFindingStatus.PENDING_VERIFICATION, EnterpriseAuditFindingStatus.CANCELLED],
  PENDING_VERIFICATION: [EnterpriseAuditFindingStatus.IN_PROGRESS],
  VERIFIED: [EnterpriseAuditFindingStatus.CLOSED, EnterpriseAuditFindingStatus.IN_PROGRESS],
  CLOSED: [EnterpriseAuditFindingStatus.OPEN],
  REJECTED: [EnterpriseAuditFindingStatus.OPEN],
  CANCELLED: [EnterpriseAuditFindingStatus.OPEN],
};
const completedActionStatuses = new Set<Status>([Status.COMPLETED, Status.CLOSED]);

function severityToRiskLevel(severity: EnterpriseAuditSeverity) {
  if (severity === EnterpriseAuditSeverity.CRITICAL) return RiskLevel.CRITICAL;
  if (severity === EnterpriseAuditSeverity.HIGH) return RiskLevel.HIGH;
  if (severity === EnterpriseAuditSeverity.MEDIUM) return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
}

async function findTenantFinding(findingId: string, auditId: string, organizationId: string) {
  const finding = await prisma.enterpriseAuditFinding.findFirst({
    where: { id: findingId, auditId, organizationId },
    include: {
      audit: { include: { site: true } },
      owner: true,
      correctiveActionLinks: { include: { correctiveAction: true } },
      riskLinks: { include: { risk: true } },
    },
  });
  if (!finding) throw new Error("Audit finding not found.");
  return finding;
}

async function refreshAuditFindingMetrics(auditId: string) {
  const findings = await prisma.enterpriseAuditFinding.findMany({ where: { auditId }, select: { status: true, severity: true } });
  const closed = new Set<EnterpriseAuditFindingStatus>([EnterpriseAuditFindingStatus.CLOSED, EnterpriseAuditFindingStatus.CANCELLED, EnterpriseAuditFindingStatus.REJECTED]);
  const open = findings.filter((finding) => !closed.has(finding.status));
  await prisma.enterpriseAudit.update({ where: { id: auditId }, data: { findingCount: findings.length, openFindingCount: open.length, highRiskFindingCount: open.filter((finding) => finding.severity === EnterpriseAuditSeverity.HIGH || finding.severity === EnterpriseAuditSeverity.CRITICAL).length } });
}

async function writeFindingHistory(input: { findingId: string; userId: string; action: EnterpriseAuditHistoryAction; title: string; description?: string | null }) {
  return prisma.enterpriseAuditFindingHistory.create({ data: input });
}

export async function createAuditFindingService(input: {
  organizationId: string;
  userId: string;
  auditId: string;
  questionId?: string | null;
  title: string;
  findingType: EnterpriseAuditFindingType;
  category: EnterpriseAuditFindingCategory;
  severity: EnterpriseAuditSeverity;
  description?: string | null;
  objectiveEvidence?: string | null;
  standardClause?: string | null;
  regulatoryRef?: string | null;
  immediateCorrection?: string | null;
  containmentAction?: string | null;
  ownerId?: string | null;
  dueDate?: Date | null;
  requiresCapa: boolean;
  requiresRiskReview: boolean;
}) {
  const [audit, question, owner] = await Promise.all([
    prisma.enterpriseAudit.findFirst({ where: { id: input.auditId, organizationId: input.organizationId } }),
    input.questionId ? prisma.enterpriseAuditQuestion.findFirst({ where: { id: input.questionId, auditId: input.auditId } }) : null,
    input.ownerId ? prisma.user.findFirst({ where: { id: input.ownerId, organizationId: input.organizationId } }) : null,
  ]);
  if (!audit) throw new Error("Audit not found.");
  if (input.questionId && !question) throw new Error("The selected Audit question is invalid.");
  if (input.ownerId && !owner) throw new Error("The selected finding owner is invalid.");
  if (input.dueDate && input.dueDate <= new Date()) throw new Error("The finding due date must be in the future.");
  const reference = `AF-${audit.reference}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const finding = await prisma.enterpriseAuditFinding.create({ data: { organizationId: input.organizationId, auditId: audit.id, questionId: question?.id, reference, title: input.title, findingType: input.findingType, category: input.category, severity: input.severity, status: EnterpriseAuditFindingStatus.OPEN, description: input.description, objectiveEvidence: input.objectiveEvidence, standardClause: input.standardClause ?? question?.standardClause, regulatoryRef: input.regulatoryRef ?? question?.regulatoryRef, immediateCorrection: input.immediateCorrection, containmentAction: input.containmentAction, ownerId: owner?.id, dueDate: input.dueDate, requiresCapa: input.requiresCapa, requiresRiskReview: input.requiresRiskReview, capaSuggestedAt: input.requiresCapa ? new Date() : null, riskSuggestedAt: input.requiresRiskReview ? new Date() : null, submittedAt: new Date(), createdById: input.userId, updatedById: input.userId } });
  await writeFindingHistory({ findingId: finding.id, userId: input.userId, action: EnterpriseAuditHistoryAction.FINDING_CREATED, title: "Audit finding created", description: reference });
  await logActivity({ organizationId: input.organizationId, userId: input.userId, action: ActivityAction.CREATE, entityType: "EnterpriseAuditFinding", entityId: finding.id, title: "Audit finding created", description: `${reference}: ${input.title}` });
  await refreshAuditFindingMetrics(audit.id);
  if (owner && owner.id !== input.userId) await createNotification({ organizationId: input.organizationId, userId: owner.id, type: input.severity === EnterpriseAuditSeverity.CRITICAL ? NotificationType.CRITICAL : NotificationType.ASSIGNMENT, title: "Audit finding assigned", message: `${reference} — ${input.title} was assigned to you.`, link: `/audits/${audit.id}` });
  return finding;
}

export async function transitionAuditFindingService(input: { organizationId: string; userId: string; auditId: string; findingId: string; status: EnterpriseAuditFindingStatus; ownerId?: string | null; dueDate?: Date | null; rootCause?: string | null; rootCauseCategory?: string | null; closureSummary?: string | null }) {
  const finding = await findTenantFinding(input.findingId, input.auditId, input.organizationId);
  const owner = input.ownerId ? await prisma.user.findFirst({ where: { id: input.ownerId, organizationId: input.organizationId } }) : null;
  if (input.ownerId && !owner) throw new Error("The selected finding owner is invalid.");
  if (!allowedTransitions[finding.status].includes(input.status)) throw new Error(`Finding cannot move from ${finding.status} to ${input.status}.`);
  if (input.status === EnterpriseAuditFindingStatus.IN_PROGRESS && !finding.ownerId && !owner) throw new Error("Assign a finding owner before starting action work.");
  if (input.status === EnterpriseAuditFindingStatus.PENDING_VERIFICATION && !input.rootCause && !finding.rootCause) throw new Error("Root-cause analysis is required before verification.");
  if (input.status === EnterpriseAuditFindingStatus.CLOSED) {
    if (!input.closureSummary) throw new Error("A closure summary is required.");
    if (finding.requiresCapa && !finding.correctiveActionLinks.some((link) => link.correctiveAction)) throw new Error("Create and link the required CAPA before closing this finding.");
    if (finding.requiresRiskReview && !finding.riskLinks.some((link) => link.risk)) throw new Error("Create and link the required Risk before closing this finding.");
    const incompleteActions = finding.correctiveActionLinks.filter((link) => link.correctiveAction && !completedActionStatuses.has(link.correctiveAction.status));
    if (incompleteActions.length > 0) throw new Error("All linked corrective actions must be completed or closed first.");
  }
  const now = new Date();
  const updated = await prisma.enterpriseAuditFinding.update({ where: { id: finding.id }, data: { status: input.status, ownerId: owner?.id ?? finding.ownerId, dueDate: input.dueDate ?? finding.dueDate, rootCause: input.rootCause ?? finding.rootCause, rootCauseCategory: input.rootCauseCategory ?? finding.rootCauseCategory, closureSummary: input.closureSummary ?? finding.closureSummary, acceptedAt: input.status === EnterpriseAuditFindingStatus.ACTION_REQUIRED ? now : finding.acceptedAt, completedAt: input.status === EnterpriseAuditFindingStatus.PENDING_VERIFICATION ? now : finding.completedAt, closedAt: input.status === EnterpriseAuditFindingStatus.CLOSED ? now : finding.closedAt, reopenedAt: input.status === EnterpriseAuditFindingStatus.OPEN && finding.status === EnterpriseAuditFindingStatus.CLOSED ? now : finding.reopenedAt, updatedById: input.userId } });
  await writeFindingHistory({ findingId: finding.id, userId: input.userId, action: input.status === EnterpriseAuditFindingStatus.CLOSED ? EnterpriseAuditHistoryAction.CLOSED : input.status === EnterpriseAuditFindingStatus.OPEN && finding.status === EnterpriseAuditFindingStatus.CLOSED ? EnterpriseAuditHistoryAction.REOPENED : EnterpriseAuditHistoryAction.STATUS_CHANGED, title: `Finding status changed to ${input.status.replaceAll("_", " ")}`, description: input.closureSummary ?? input.rootCause });
  await refreshAuditFindingMetrics(finding.auditId);
  if (finding.ownerId && finding.ownerId !== input.userId) await createNotification({ organizationId: input.organizationId, userId: finding.ownerId, type: NotificationType.INFO, title: "Audit finding status updated", message: `${finding.reference} moved to ${input.status.replaceAll("_", " ")}.`, link: `/audits/${finding.auditId}` });
  return updated;
}

export async function addAuditFindingEvidenceService(input: { organizationId: string; userId: string; auditId: string; findingId: string; evidenceType: EnterpriseAuditEvidenceType; title: string; description?: string | null; externalUrl?: string | null }) {
  const finding = await findTenantFinding(input.findingId, input.auditId, input.organizationId);
  if (input.evidenceType !== EnterpriseAuditEvidenceType.NOTE && !input.externalUrl) throw new Error("An evidence URL is required for this evidence type.");
  const evidence = await prisma.enterpriseAuditEvidence.create({ data: { organizationId: input.organizationId, auditId: finding.auditId, findingId: finding.id, evidenceType: input.evidenceType, title: input.title, description: input.description, externalUrl: input.externalUrl, capturedAt: new Date(), capturedById: input.userId } });
  await prisma.enterpriseAuditFindingEvidence.create({ data: { findingId: finding.id, evidenceId: evidence.id, relationshipNote: input.description } });
  await writeFindingHistory({ findingId: finding.id, userId: input.userId, action: EnterpriseAuditHistoryAction.EVIDENCE_ADDED, title: "Finding evidence added", description: input.title });
  return evidence;
}

export async function verifyAuditFindingService(input: { organizationId: string; userId: string; auditId: string; findingId: string; accepted: boolean; verificationMethod: string; verificationEvidence?: string | null; comments?: string | null }) {
  const finding = await findTenantFinding(input.findingId, input.auditId, input.organizationId);
  if (finding.status !== EnterpriseAuditFindingStatus.PENDING_VERIFICATION) throw new Error("Finding is not pending verification.");
  if (finding.ownerId === input.userId) throw new Error("The finding owner cannot independently verify their own finding.");
  const status = input.accepted ? EnterpriseAuditVerificationStatus.ACCEPTED : EnterpriseAuditVerificationStatus.REJECTED;
  const findingStatus = input.accepted ? EnterpriseAuditFindingStatus.VERIFIED : EnterpriseAuditFindingStatus.IN_PROGRESS;
  await prisma.$transaction([
    prisma.enterpriseAuditFindingVerification.create({ data: { findingId: finding.id, status, verifiedById: input.userId, verificationMethod: input.verificationMethod, verificationEvidence: input.verificationEvidence, comments: input.comments, verifiedAt: new Date() } }),
    prisma.enterpriseAuditFinding.update({ where: { id: finding.id }, data: { status: findingStatus, verifiedAt: input.accepted ? new Date() : null, updatedById: input.userId } }),
    prisma.enterpriseAuditFindingHistory.create({ data: { findingId: finding.id, userId: input.userId, action: input.accepted ? EnterpriseAuditHistoryAction.VERIFIED : EnterpriseAuditHistoryAction.REOPENED, title: input.accepted ? "Finding verification accepted" : "Finding verification rejected", description: input.comments } }),
  ]);
  if (finding.ownerId) await createNotification({ organizationId: input.organizationId, userId: finding.ownerId, type: input.accepted ? NotificationType.SUCCESS : NotificationType.WARNING, title: input.accepted ? "Finding verified" : "Finding verification rejected", message: `${finding.reference} verification was ${input.accepted ? "accepted" : "rejected"}.`, link: `/audits/${finding.auditId}` });
}

export async function createCapaFromAuditFindingService(input: { organizationId: string; userId: string; auditId: string; findingId: string; title: string; description?: string | null; assignedToId: string; dueDate: Date }) {
  const [finding, assignedUser, creator] = await Promise.all([findTenantFinding(input.findingId, input.auditId, input.organizationId), prisma.user.findFirst({ where: { id: input.assignedToId, organizationId: input.organizationId } }), prisma.user.findFirst({ where: { id: input.userId, organizationId: input.organizationId } })]);
  if (!assignedUser || !creator) throw new Error("Corrective-action assignee or creator is invalid.");
  if (input.dueDate <= new Date()) throw new Error("Corrective-action due date must be in the future.");
  const existing = finding.correctiveActionLinks.find((link) => link.correctiveActionId);
  if (existing) throw new Error("This finding already has a linked corrective action.");
  const action = await prisma.$transaction(async (tx) => {
    const correctiveAction = await tx.correctiveAction.create({ data: { title: input.title, description: input.description, status: Status.OPEN, riskLevel: severityToRiskLevel(finding.severity), dueDate: input.dueDate, assignedToId: assignedUser.id } });
    await tx.enterpriseAuditFindingActionLink.create({ data: { findingId: finding.id, correctiveActionId: correctiveAction.id, status: EnterpriseAuditLinkStatus.CREATED, recommendationTitle: input.title, recommendationDescription: input.description, suggestedOwnerId: assignedUser.id, suggestedDueDate: input.dueDate, rationale: `Corrective action created from ${finding.reference}.`, createdById: input.userId, reviewedById: input.userId, reviewedAt: new Date() } });
    await tx.enterpriseAuditFinding.update({ where: { id: finding.id }, data: { requiresCapa: true, capaSuggestedAt: finding.capaSuggestedAt ?? new Date(), status: finding.status === EnterpriseAuditFindingStatus.OPEN ? EnterpriseAuditFindingStatus.ACTION_REQUIRED : finding.status } });
    await tx.enterpriseAuditFindingHistory.create({ data: { findingId: finding.id, userId: input.userId, action: EnterpriseAuditHistoryAction.CAPA_LINKED, title: "Corrective action created and linked", description: correctiveAction.title } });
    return correctiveAction;
  });
  await logActivity({ organizationId: input.organizationId, userId: input.userId, action: ActivityAction.CREATE, entityType: "CorrectiveAction", entityId: action.id, title: "Corrective action created from enterprise Audit finding", description: input.title, metadata: { auditId: finding.auditId, findingId: finding.id, findingReference: finding.reference } });
  await createNotification({ organizationId: input.organizationId, userId: assignedUser.id, type: NotificationType.ASSIGNMENT, title: "Audit corrective action assigned", message: `You were assigned a corrective action from ${finding.reference}: ${input.title}`, link: `/audits/${finding.auditId}` });
  if (assignedUser.email) await sendCorrectiveActionAssignmentEmail({ recipientEmail: assignedUser.email, recipientName: assignedUser.name, actionId: action.id, actionTitle: action.title, actionDescription: action.description, incidentId: null, incidentTitle: `Audit: ${finding.audit.title}`, dueDate: action.dueDate, riskLevel: action.riskLevel, assignedByName: creator.name }).catch((error) => console.error(`Audit CAPA assignment email failed for ${action.id}:`, error));
  return action;
}

export async function createRiskFromAuditFindingService(input: { organizationId: string; userId: string; auditId: string; findingId: string; title: string; description: string; category: RiskCategory; hazardType?: string | null; ownerId?: string | null; likelihood: RiskLikelihood; impact: RiskImpact; nextReviewDate?: Date | null }) {
  const finding = await findTenantFinding(input.findingId, input.auditId, input.organizationId);
  const risk = await createRiskService({ organizationId: input.organizationId, userId: input.userId, title: input.title, description: input.description, category: input.category, hazardType: input.hazardType, process: `Enterprise Audit ${finding.audit.reference}`, siteId: finding.audit.siteId, departmentId: finding.audit.departmentId, ownerId: input.ownerId, initialLikelihood: input.likelihood, initialImpact: input.impact, currentLikelihood: input.likelihood, currentImpact: input.impact, residualLikelihood: input.likelihood, residualImpact: input.impact, reviewFrequency: RiskReviewFrequency.ANNUAL, nextReviewDate: input.nextReviewDate });
  await prisma.$transaction([
    prisma.enterpriseAuditFindingRiskLink.create({ data: { findingId: finding.id, riskId: risk.id, status: EnterpriseAuditLinkStatus.CREATED, proposedRiskTitle: input.title, proposedRiskDescription: input.description, proposedHazard: input.hazardType, proposedLikelihood: input.likelihood, proposedImpact: input.impact, rationale: `Risk created from ${finding.reference}.`, createdById: input.userId, reviewedById: input.userId, reviewedAt: new Date() } }),
    prisma.enterpriseAuditFinding.update({ where: { id: finding.id }, data: { requiresRiskReview: true, riskSuggestedAt: finding.riskSuggestedAt ?? new Date(), updatedById: input.userId } }),
    prisma.enterpriseAuditFindingHistory.create({ data: { findingId: finding.id, userId: input.userId, action: EnterpriseAuditHistoryAction.RISK_LINKED, title: "Risk created and linked", description: `${risk.reference}: ${risk.title}` } }),
  ]);
  return risk;
}
