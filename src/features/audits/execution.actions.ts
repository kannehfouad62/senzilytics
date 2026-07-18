"use server";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  completeAuditService,
  recordAuditResponseService,
  startAuditExecutionService,
  submitAuditForReviewService,
} from "@/modules/audit/audit-execution.service";
import { EnterpriseAuditResponseResult, PermissionKey } from "@prisma/client";
import { revalidatePath } from "next/cache";

function required(formData: FormData, name: string) { const value = String(formData.get(name) ?? "").trim(); if (!value) throw new Error(`${name} is required.`); return value; }
function optional(formData: FormData, name: string) { return String(formData.get(name) ?? "").trim() || null; }
function optionalNumber(formData: FormData, name: string) { const value = optional(formData, name); if (!value) return null; const number = Number(value); if (!Number.isFinite(number)) throw new Error(`${name} must be a valid number.`); return number; }

export async function startAuditExecution(formData: FormData) {
  await requirePermission(PermissionKey.VIEW_AUDITS); const { organizationId, user } = await getCurrentUserTenant(); const auditId = required(formData, "auditId");
  await startAuditExecutionService({ organizationId, userId: user.id, userRole: user.role, auditId });
  revalidatePath(`/audits/${auditId}`);
}

export async function recordAuditResponse(formData: FormData) {
  await requirePermission(PermissionKey.VIEW_AUDITS); const { organizationId, user } = await getCurrentUserTenant(); const auditId = required(formData, "auditId"); const rawResult = required(formData, "result");
  if (!Object.values(EnterpriseAuditResponseResult).includes(rawResult as EnterpriseAuditResponseResult) || rawResult === EnterpriseAuditResponseResult.NOT_ASSESSED) throw new Error("A valid assessed result is required.");
  const booleanRaw = optional(formData, "booleanValue");
  await recordAuditResponseService({ organizationId, userId: user.id, userRole: user.role, auditId, questionId: required(formData, "questionId"), result: rawResult as EnterpriseAuditResponseResult, responseText: optional(formData, "responseText"), numericValue: optionalNumber(formData, "numericValue"), booleanValue: booleanRaw == null ? null : booleanRaw === "true", selectedOptionValues: formData.getAll("selectedOptionValues").map(String).filter(Boolean), comments: optional(formData, "comments"), evidenceNote: optional(formData, "evidenceNote"), evidenceUrl: optional(formData, "evidenceUrl") });
  revalidatePath(`/audits/${auditId}`);
}

export async function submitAuditForReview(formData: FormData) {
  await requirePermission(PermissionKey.VIEW_AUDITS); const { organizationId, user } = await getCurrentUserTenant(); const auditId = required(formData, "auditId");
  await submitAuditForReviewService({ organizationId, userId: user.id, userRole: user.role, auditId });
  revalidatePath(`/audits/${auditId}`);
}

export async function completeAudit(formData: FormData) {
  await requirePermission(PermissionKey.VIEW_AUDITS); const { organizationId, user } = await getCurrentUserTenant(); const auditId = required(formData, "auditId");
  await completeAuditService({ organizationId, userId: user.id, userRole: user.role, auditId });
  revalidatePath(`/audits/${auditId}`);
}
