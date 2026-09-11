import {
  ActivityAction,
  NotificationType,
  Prisma,
  ResearchDataDisposalMethod,
  ResearchDataLifecycleStatus,
  ResearchDatasetAccessLevel,
  ResearchDatasetAccessStatus,
  ResearchDisclosureRisk,
  ResearchPrivacyReviewStatus,
  ResearchPrivacyReviewType,
} from "@prisma/client";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import {
  dataLifecycleTransitions,
  datasetAccessTransitions,
  privacyReviewTransitions,
} from "@/modules/research/research-data-governance";

const governanceLink = (projectId: string) => `/research/projects/${projectId}/data-governance`;

export async function getResearchDataGovernanceWorkspace(organizationId: string, projectId: string, viewerId: string, canManage: boolean) {
  const project = await prisma.researchProject.findFirst({ where: { id: projectId, organizationId }, select: { id: true, reference: true, title: true, retentionDays: true } });
  if (!project) return null;
  const [plan, reviews, requests, users] = await Promise.all([
    prisma.researchDataLifecyclePlan.findUnique({ where: { projectId }, include: { owner: { select: { name: true } }, approvedBy: { select: { name: true } }, disposedBy: { select: { name: true } } } }),
    prisma.researchPrivacyReview.findMany({ where: { organizationId, projectId }, include: { createdBy: { select: { name: true } }, reviewedBy: { select: { name: true } } }, orderBy: [{ datasetReference: "asc" }, { version: "desc" }] }),
    prisma.researchDatasetAccessRequest.findMany({ where: { organizationId, projectId, ...(canManage ? {} : { requestedById: viewerId }) }, include: { requestedBy: { select: { name: true, email: true } }, decidedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    canManage ? prisma.user.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  return { project, plan, reviews, requests, users };
}

export async function saveResearchDataLifecyclePlan(input: { organizationId: string; actorId: string; projectId: string; retentionBasis: string; retentionDays: number; disposalMethod: ResearchDataDisposalMethod; scheduledDisposalAt: Date; ownerId: string }) {
  if (input.retentionBasis.trim().length < 20) throw new Error("Retention basis must contain at least 20 characters.");
  if (!Number.isInteger(input.retentionDays) || input.retentionDays < 1 || input.retentionDays > 36500) throw new Error("Retention must be between 1 and 36,500 days.");
  if (input.scheduledDisposalAt <= new Date()) throw new Error("Scheduled disposal must be in the future.");
  const [project, owner, existing] = await Promise.all([
    prisma.researchProject.findFirst({ where: { id: input.projectId, organizationId: input.organizationId }, select: { id: true } }),
    prisma.user.findFirst({ where: { id: input.ownerId, organizationId: input.organizationId, isActive: true }, select: { id: true } }),
    prisma.researchDataLifecyclePlan.findFirst({ where: { projectId: input.projectId, organizationId: input.organizationId }, select: { status: true } }),
  ]);
  if (!project || !owner) throw new Error("Project or lifecycle owner was not found in this tenant.");
  if (existing && existing.status !== ResearchDataLifecycleStatus.DRAFT) throw new Error("Only a draft lifecycle plan can be edited.");
  const plan = await prisma.researchDataLifecyclePlan.upsert({
    where: { projectId: input.projectId },
    create: { organizationId: input.organizationId, projectId: input.projectId, retentionBasis: input.retentionBasis.trim(), retentionDays: input.retentionDays, disposalMethod: input.disposalMethod, scheduledDisposalAt: input.scheduledDisposalAt, ownerId: input.ownerId },
    update: { retentionBasis: input.retentionBasis.trim(), retentionDays: input.retentionDays, disposalMethod: input.disposalMethod, scheduledDisposalAt: input.scheduledDisposalAt, ownerId: input.ownerId },
  });
  await audit(input.organizationId, input.actorId, "ResearchDataLifecyclePlan", plan.id, "Research data lifecycle plan saved", { projectId: input.projectId }, existing ? ActivityAction.UPDATE : ActivityAction.CREATE);
  return plan;
}

export async function changeResearchDataLifecycleStatus(input: { organizationId: string; actorId: string; planId: string; status: ResearchDataLifecycleStatus; reason?: string | null; evidence?: string | null; canApprove: boolean }) {
  const plan = await prisma.researchDataLifecyclePlan.findFirst({ where: { id: input.planId, organizationId: input.organizationId } });
  if (!plan) throw new Error("Data lifecycle plan not found.");
  if (!dataLifecycleTransitions[plan.status].includes(input.status)) throw new Error(`Lifecycle plan cannot move from ${plan.status} to ${input.status}.`);
  if (input.status === ResearchDataLifecycleStatus.ACTIVE && plan.status === ResearchDataLifecycleStatus.DRAFT) {
    if (!input.canApprove) throw new Error("Research output approval permission is required.");
    if (plan.ownerId === input.actorId) throw new Error("Independent approval is required; the plan owner cannot approve it.");
  }
  if (input.status === ResearchDataLifecycleStatus.LEGAL_HOLD && (input.reason?.trim().length ?? 0) < 10) throw new Error("Record a substantive legal-hold reason.");
  if (input.status === ResearchDataLifecycleStatus.DISPOSED && (input.evidence?.trim().length ?? 0) < 3) throw new Error("Disposal evidence is required.");
  const now = new Date();
  const updated = await prisma.researchDataLifecyclePlan.update({ where: { id: plan.id }, data: {
    status: input.status,
    approvedById: input.status === ResearchDataLifecycleStatus.ACTIVE && plan.status === ResearchDataLifecycleStatus.DRAFT ? input.actorId : plan.approvedById,
    approvedAt: input.status === ResearchDataLifecycleStatus.ACTIVE && plan.status === ResearchDataLifecycleStatus.DRAFT ? now : plan.approvedAt,
    legalHoldReason: input.status === ResearchDataLifecycleStatus.LEGAL_HOLD ? input.reason?.trim() : input.status === ResearchDataLifecycleStatus.ACTIVE ? null : plan.legalHoldReason,
    legalHoldAt: input.status === ResearchDataLifecycleStatus.LEGAL_HOLD ? now : input.status === ResearchDataLifecycleStatus.ACTIVE ? null : plan.legalHoldAt,
    disposalEvidence: input.status === ResearchDataLifecycleStatus.DISPOSED ? input.evidence?.trim() : plan.disposalEvidence,
    disposedById: input.status === ResearchDataLifecycleStatus.DISPOSED ? input.actorId : plan.disposedById,
    disposedAt: input.status === ResearchDataLifecycleStatus.DISPOSED ? now : plan.disposedAt,
  } });
  await audit(input.organizationId, input.actorId, "ResearchDataLifecyclePlan", plan.id, "Research data lifecycle status changed", { projectId: plan.projectId, from: plan.status, to: input.status });
  return updated;
}

export async function createResearchPrivacyReview(input: { organizationId: string; actorId: string; projectId: string; datasetReference: string; type: ResearchPrivacyReviewType; method: string; directIdentifiersRemoved: boolean; quasiIdentifierControls?: string | null; residualRisk: ResearchDisclosureRisk; findings: string; mitigation?: string | null; evidenceReference: string }) {
  const datasetReference = normalizeReference(input.datasetReference);
  if (input.method.trim().length < 10 || input.findings.trim().length < 20 || input.evidenceReference.trim().length < 3) throw new Error("Method, findings, and evidence must be substantively documented.");
  if (isHighRisk(input.residualRisk) && (input.mitigation?.trim().length ?? 0) < 20) throw new Error("High or critical residual risk requires a mitigation plan.");
  const project = await prisma.researchProject.findFirst({ where: { id: input.projectId, organizationId: input.organizationId }, select: { id: true } });
  if (!project) throw new Error("Research project not found.");
  const latest = await prisma.researchPrivacyReview.aggregate({ where: { projectId: input.projectId, datasetReference, type: input.type }, _max: { version: true } });
  const review = await prisma.researchPrivacyReview.create({ data: { organizationId: input.organizationId, projectId: input.projectId, datasetReference, type: input.type, version: (latest._max.version ?? 0) + 1, method: input.method.trim(), directIdentifiersRemoved: input.directIdentifiersRemoved, quasiIdentifierControls: input.quasiIdentifierControls?.trim() || null, residualRisk: input.residualRisk, findings: input.findings.trim(), mitigation: input.mitigation?.trim() || null, evidenceReference: input.evidenceReference.trim(), createdById: input.actorId } });
  await audit(input.organizationId, input.actorId, "ResearchPrivacyReview", review.id, "Research privacy review created", { projectId: input.projectId, datasetReference, type: input.type, version: review.version }, ActivityAction.CREATE);
  return review;
}

export async function changeResearchPrivacyReviewStatus(input: { organizationId: string; actorId: string; reviewId: string; status: ResearchPrivacyReviewStatus; canApprove: boolean }) {
  const review = await prisma.researchPrivacyReview.findFirst({ where: { id: input.reviewId, organizationId: input.organizationId } });
  if (!review) throw new Error("Privacy review not found.");
  if (!privacyReviewTransitions[review.status].includes(input.status)) throw new Error(`Privacy review cannot move from ${review.status} to ${input.status}.`);
  if (input.status === ResearchPrivacyReviewStatus.APPROVED) {
    if (!input.canApprove) throw new Error("Research output approval permission is required.");
    if (review.createdById === input.actorId) throw new Error("Independent approval is required; the review creator cannot approve it.");
    if (isHighRisk(review.residualRisk)) throw new Error("High or critical residual disclosure risk cannot be approved.");
  }
  const now = new Date();
  const updated = await prisma.researchPrivacyReview.update({ where: { id: review.id }, data: { status: input.status, submittedAt: input.status === ResearchPrivacyReviewStatus.UNDER_REVIEW ? now : review.submittedAt, reviewedById: isPrivacyDecision(input.status) ? input.actorId : review.reviewedById, reviewedAt: isPrivacyDecision(input.status) ? now : review.reviewedAt } });
  await audit(input.organizationId, input.actorId, "ResearchPrivacyReview", review.id, "Research privacy review status changed", { projectId: review.projectId, from: review.status, to: input.status });
  return updated;
}

export async function requestResearchDatasetAccess(input: { organizationId: string; actorId: string; projectId: string; datasetReference: string; accessLevel: ResearchDatasetAccessLevel; purpose: string; scope: string; safeguards: string; accessStartsAt?: Date | null; accessExpiresAt?: Date | null }) {
  if (input.purpose.trim().length < 20 || input.scope.trim().length < 20 || input.safeguards.trim().length < 20) throw new Error("Purpose, scope, and safeguards must each contain at least 20 characters.");
  if (input.accessStartsAt && input.accessExpiresAt && input.accessExpiresAt <= input.accessStartsAt) throw new Error("Access expiry must be after its start date.");
  if (input.accessExpiresAt && input.accessExpiresAt <= new Date()) throw new Error("Access expiry must be in the future.");
  const project = await prisma.researchProject.findFirst({ where: { id: input.projectId, organizationId: input.organizationId }, select: { id: true, projectManagerId: true } });
  if (!project) throw new Error("Research project not found.");
  const request = await prisma.researchDatasetAccessRequest.create({ data: { organizationId: input.organizationId, projectId: input.projectId, datasetReference: normalizeReference(input.datasetReference), accessLevel: input.accessLevel, purpose: input.purpose.trim(), scope: input.scope.trim(), safeguards: input.safeguards.trim(), requestedById: input.actorId, accessStartsAt: input.accessStartsAt || null, accessExpiresAt: input.accessExpiresAt || null } });
  if (project.projectManagerId !== input.actorId) await createNotification({ organizationId: input.organizationId, userId: project.projectManagerId, type: NotificationType.ASSIGNMENT, title: "Research dataset access requires decision", message: request.datasetReference, link: governanceLink(input.projectId) });
  await audit(input.organizationId, input.actorId, "ResearchDatasetAccessRequest", request.id, "Research dataset access requested", { projectId: input.projectId, accessLevel: input.accessLevel }, ActivityAction.CREATE);
  return request;
}

export async function decideResearchDatasetAccess(input: { organizationId: string; actorId: string; requestId: string; status: ResearchDatasetAccessStatus; reason: string; canApprove: boolean }) {
  const request = await prisma.researchDatasetAccessRequest.findFirst({ where: { id: input.requestId, organizationId: input.organizationId } });
  if (!request) throw new Error("Dataset access request not found.");
  if (!datasetAccessTransitions[request.status].includes(input.status)) throw new Error(`Dataset access cannot move from ${request.status} to ${input.status}.`);
  if (!input.canApprove) throw new Error("Research output approval permission is required.");
  if (request.requestedById === input.actorId && isAccessDecision(input.status)) throw new Error("Independent decision is required; requesters cannot decide their own access.");
  if (input.reason.trim().length < 10) throw new Error("Record a substantive access decision reason.");
  if (input.status === ResearchDatasetAccessStatus.APPROVED && request.accessLevel !== ResearchDatasetAccessLevel.METADATA_ONLY) {
    const review = await prisma.researchPrivacyReview.findFirst({ where: { organizationId: input.organizationId, projectId: request.projectId, datasetReference: request.datasetReference, type: ResearchPrivacyReviewType.DISCLOSURE_RISK, status: ResearchPrivacyReviewStatus.APPROVED }, orderBy: { version: "desc" } });
    if (!review || isHighRisk(review.residualRisk)) throw new Error("Approved low- or medium-risk disclosure review is required before data access.");
  }
  const now = new Date();
  const updated = await prisma.researchDatasetAccessRequest.update({ where: { id: request.id }, data: { status: input.status, decidedById: input.actorId, decisionReason: input.reason.trim(), decidedAt: isAccessDecision(input.status) ? now : request.decidedAt, revokedAt: input.status === ResearchDatasetAccessStatus.REVOKED ? now : request.revokedAt } });
  await createNotification({ organizationId: input.organizationId, userId: request.requestedById, type: NotificationType.INFO, title: "Research dataset access updated", message: `${request.datasetReference}: ${input.status}`, link: governanceLink(request.projectId) });
  await audit(input.organizationId, input.actorId, "ResearchDatasetAccessRequest", request.id, "Research dataset access status changed", { projectId: request.projectId, from: request.status, to: input.status });
  return updated;
}

function normalizeReference(value: string) { const reference = value.trim().toUpperCase().replace(/[^A-Z0-9._/-]+/g, "-").slice(0, 100); if (reference.length < 3) throw new Error("Enter a valid dataset reference."); return reference; }
function isHighRisk(risk: ResearchDisclosureRisk) { return risk === ResearchDisclosureRisk.HIGH || risk === ResearchDisclosureRisk.CRITICAL; }
function isPrivacyDecision(status: ResearchPrivacyReviewStatus) { return status === ResearchPrivacyReviewStatus.APPROVED || status === ResearchPrivacyReviewStatus.REJECTED; }
function isAccessDecision(status: ResearchDatasetAccessStatus) { return status === ResearchDatasetAccessStatus.APPROVED || status === ResearchDatasetAccessStatus.REJECTED; }
async function audit(organizationId: string, userId: string, entityType: string, entityId: string, title: string, metadata: Prisma.InputJsonValue, action: ActivityAction = ActivityAction.STATUS_CHANGE) { await logActivity({ organizationId, userId, action, entityType, entityId, title, metadata }); }
