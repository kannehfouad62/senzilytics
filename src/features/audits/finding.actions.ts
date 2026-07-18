"use server";
import { auditActionError, type AuditActionFeedback } from "@/features/audits/audit-action-feedback";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  addAuditFindingEvidenceService,
  createAuditFindingService,
  proposeCapaFromAuditFindingService,
  proposeRiskFromAuditFindingService,
  reviewCapaProposalService,
  reviewRiskProposalService,
  transitionAuditFindingService,
  verifyAuditFindingService,
} from "@/modules/audit/audit-finding.service";
import {
  EnterpriseAuditEvidenceType,
  EnterpriseAuditFindingCategory,
  EnterpriseAuditFindingStatus,
  EnterpriseAuditFindingType,
  EnterpriseAuditSeverity,
  PermissionKey,
  RiskCategory,
  RiskImpact,
  RiskLikelihood,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

function required(formData: FormData, name: string) { const value = String(formData.get(name) ?? "").trim(); if (!value) throw new Error(`${name} is required.`); return value; }
function optional(formData: FormData, name: string) { return String(formData.get(name) ?? "").trim() || null; }
function checked(formData: FormData, name: string) { return formData.get(name) === "on"; }
function date(formData: FormData, name: string, requiredValue = false) { const value = optional(formData, name); if (!value) { if (requiredValue) throw new Error(`${name} is required.`); return null; } const parsed = new Date(value); if (Number.isNaN(parsed.getTime())) throw new Error(`${name} must be a valid date.`); return parsed; }
function enumValue<T extends Record<string, string>>(values: T, value: string, message: string): T[keyof T] { if (!Object.values(values).includes(value)) throw new Error(message); return value as T[keyof T]; }

export async function createAuditFinding(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_AUDITS); const { organizationId, user } = await getCurrentUserTenant(); const auditId = required(formData, "auditId");
  await createAuditFindingService({ organizationId, userId: user.id, auditId, questionId: optional(formData, "questionId"), title: required(formData, "title"), findingType: enumValue(EnterpriseAuditFindingType, required(formData, "findingType"), "A valid finding type is required."), category: enumValue(EnterpriseAuditFindingCategory, required(formData, "category"), "A valid finding category is required."), severity: enumValue(EnterpriseAuditSeverity, required(formData, "severity"), "A valid severity is required."), description: optional(formData, "description"), objectiveEvidence: optional(formData, "objectiveEvidence"), standardClause: optional(formData, "standardClause"), regulatoryRef: optional(formData, "regulatoryRef"), immediateCorrection: optional(formData, "immediateCorrection"), containmentAction: optional(formData, "containmentAction"), ownerId: optional(formData, "ownerId"), dueDate: date(formData, "dueDate"), requiresCapa: checked(formData, "requiresCapa"), requiresRiskReview: checked(formData, "requiresRiskReview") });
  revalidatePath(`/audits/${auditId}`);
}

export async function transitionAuditFinding(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_AUDITS); const { organizationId, user } = await getCurrentUserTenant(); const auditId = required(formData, "auditId");
  await transitionAuditFindingService({ organizationId, userId: user.id, auditId, findingId: required(formData, "findingId"), status: enumValue(EnterpriseAuditFindingStatus, required(formData, "status"), "A valid finding status is required."), ownerId: optional(formData, "ownerId"), dueDate: date(formData, "dueDate"), rootCause: optional(formData, "rootCause"), rootCauseCategory: optional(formData, "rootCauseCategory"), closureSummary: optional(formData, "closureSummary") });
  revalidatePath(`/audits/${auditId}`);
}

export async function addAuditFindingEvidence(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_AUDITS); const { organizationId, user } = await getCurrentUserTenant(); const auditId = required(formData, "auditId");
  await addAuditFindingEvidenceService({ organizationId, userId: user.id, auditId, findingId: required(formData, "findingId"), evidenceType: enumValue(EnterpriseAuditEvidenceType, required(formData, "evidenceType"), "A valid evidence type is required."), title: required(formData, "title"), description: optional(formData, "description"), externalUrl: optional(formData, "externalUrl") });
  revalidatePath(`/audits/${auditId}`);
}

export async function verifyAuditFinding(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_AUDITS); const { organizationId, user } = await getCurrentUserTenant(); const auditId = required(formData, "auditId");
  await verifyAuditFindingService({ organizationId, userId: user.id, auditId, findingId: required(formData, "findingId"), accepted: required(formData, "decision") === "ACCEPT", verificationMethod: required(formData, "verificationMethod"), verificationEvidence: optional(formData, "verificationEvidence"), comments: optional(formData, "comments") });
  revalidatePath(`/audits/${auditId}`);
}

export async function createCapaFromAuditFinding(formData: FormData) {
  await requirePermission(PermissionKey.CREATE_CAPA); const { organizationId, user } = await getCurrentUserTenant(); const auditId = required(formData, "auditId"); const dueDate = date(formData, "dueDate", true); if (!dueDate) throw new Error("dueDate is required.");
  await proposeCapaFromAuditFindingService({ organizationId, userId: user.id, auditId, findingId: required(formData, "findingId"), title: required(formData, "title"), description: optional(formData, "description"), assignedToId: required(formData, "assignedToId"), dueDate });
  revalidatePath(`/audits/${auditId}`); revalidatePath("/capa"); revalidatePath("/actions");
}
export async function createCapaFromAuditFindingWithFeedback(_state: AuditActionFeedback, formData: FormData): Promise<AuditActionFeedback> {
  try { await createCapaFromAuditFinding(formData); return { status: "success", message: "CAPA recommendation submitted for approval." }; }
  catch (error) { return auditActionError(error, "The CAPA could not be created."); }
}

export async function createRiskFromAuditFinding(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_RISKS); const { organizationId, user } = await getCurrentUserTenant(); const auditId = required(formData, "auditId");
  await proposeRiskFromAuditFindingService({ organizationId, userId: user.id, auditId, findingId: required(formData, "findingId"), title: required(formData, "title"), description: required(formData, "description"), category: enumValue(RiskCategory, required(formData, "riskCategory"), "A valid risk category is required."), hazardType: optional(formData, "hazardType"), ownerId: optional(formData, "ownerId"), likelihood: enumValue(RiskLikelihood, required(formData, "likelihood"), "A valid likelihood is required."), impact: enumValue(RiskImpact, required(formData, "impact"), "A valid impact is required."), nextReviewDate: date(formData, "nextReviewDate") });
  revalidatePath(`/audits/${auditId}`); revalidatePath("/risks");
}

export async function reviewCapaProposal(formData: FormData) { await requirePermission(PermissionKey.CREATE_CAPA); const { organizationId, user } = await getCurrentUserTenant(); const auditId = required(formData, "auditId"); await reviewCapaProposalService({ organizationId, userId: user.id, auditId, findingId: required(formData, "findingId"), linkId: required(formData, "linkId"), approve: required(formData, "decision") === "APPROVE" }); revalidatePath(`/audits/${auditId}`); revalidatePath("/capa"); revalidatePath("/actions"); }
export async function reviewRiskProposal(formData: FormData) { await requirePermission(PermissionKey.MANAGE_RISKS); const { organizationId, user } = await getCurrentUserTenant(); const auditId = required(formData, "auditId"); await reviewRiskProposalService({ organizationId, userId: user.id, auditId, findingId: required(formData, "findingId"), linkId: required(formData, "linkId"), approve: required(formData, "decision") === "APPROVE" }); revalidatePath(`/audits/${auditId}`); revalidatePath("/risks"); }
