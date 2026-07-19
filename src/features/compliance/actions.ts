"use server";

import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { ComplianceObligationType, ComplianceRecurrence, PermissionKey, PermitStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { nextComplianceDueDate } from "@/modules/compliance/compliance-recurrence";
import { Status } from "@prisma/client";
import { revalidatePath } from "next/cache";

const required = (data: FormData, key: string) => { const value = String(data.get(key) || "").trim(); if (!value) throw new Error(`${key} is required.`); return value; };
const optional = (data: FormData, key: string) => String(data.get(key) || "").trim() || null;
const optionalDate = (data: FormData, key: string) => { const raw = optional(data, key); if (!raw) return null; const value = new Date(raw); if (Number.isNaN(value.getTime())) throw new Error(`${key} must be a valid date.`); return value; };

export async function createComplianceObligation(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE);
  const { organizationId } = await getCurrentUserTenant();
  const siteId = required(data, "siteId");
  const ownerId = optional(data, "ownerId");
  if (!(await prisma.site.findFirst({ where: { id: siteId, organizationId } }))) throw new Error("Select a valid site.");
  if (ownerId && !(await prisma.user.findFirst({ where: { id: ownerId, organizationId } }))) throw new Error("Select a valid owner.");
  const obligationType = required(data, "obligationType") as ComplianceObligationType;
  const recurrence = required(data, "recurrence") as ComplianceRecurrence;
  if (!Object.values(ComplianceObligationType).includes(obligationType) || !Object.values(ComplianceRecurrence).includes(recurrence)) throw new Error("Select valid obligation classifications.");
  await prisma.complianceItem.create({ data: { siteId, ownerId, title: required(data, "title"), description: optional(data, "description"), reference: optional(data, "reference"), obligationType, authority: optional(data, "authority"), jurisdiction: optional(data, "jurisdiction"), legalReference: optional(data, "legalReference"), applicability: optional(data, "applicability"), recurrence, intervalValue: Number(required(data, "intervalValue")), evidenceRequired: optional(data, "evidenceRequired"), dueDate: optionalDate(data, "dueDate")! } });
  redirect("/compliance");
}

export async function createPermit(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE);
  const { organizationId } = await getCurrentUserTenant();
  const siteId = required(data, "siteId");
  const ownerId = optional(data, "ownerId");
  if (!(await prisma.site.findFirst({ where: { id: siteId, organizationId } }))) throw new Error("Select a valid site.");
  if (ownerId && !(await prisma.user.findFirst({ where: { id: ownerId, organizationId } }))) throw new Error("Select a valid owner.");
  const status = required(data, "status") as PermitStatus;
  if (!Object.values(PermitStatus).includes(status)) throw new Error("Select a valid permit status.");
  await prisma.permit.create({ data: { organizationId, siteId, ownerId, number: required(data, "number"), name: required(data, "name"), description: optional(data, "description"), authority: optional(data, "authority"), permitType: optional(data, "permitType"), status, effectiveDate: optionalDate(data, "effectiveDate"), expirationDate: optionalDate(data, "expirationDate"), renewalDueDate: optionalDate(data, "renewalDueDate"), conditions: optional(data, "conditions"), limits: optional(data, "limits"), reportingRequirements: optional(data, "reportingRequirements") } });
  redirect("/compliance/permits");
}

export async function evaluateComplianceObligation(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE);
  const { organizationId, user } = await getCurrentUserTenant();
  const id = required(data, "id");
  const item = await prisma.complianceItem.findFirst({ where: { id, site: { organizationId } } });
  if (!item) throw new Error("Compliance obligation not found.");
  const isCompliant = required(data, "result") === "COMPLIANT";
  const nextDueDate = isCompliant ? nextComplianceDueDate(item.dueDate, item.recurrence, item.intervalValue) : null;
  await prisma.$transaction([
    prisma.complianceEvaluation.create({ data: { complianceItemId: id, evaluatedById: user.id, isCompliant, findings: optional(data, "findings"), evidenceSummary: optional(data, "evidenceSummary"), nextDueDate } }),
    prisma.complianceItem.update({ where: { id }, data: { status: isCompliant ? (nextDueDate ? Status.OPEN : Status.COMPLETED) : Status.IN_PROGRESS, completedAt: isCompliant && !nextDueDate ? new Date() : null, lastEvaluatedAt: new Date(), evaluationNotes: optional(data, "findings"), dueDate: nextDueDate ?? item.dueDate, reminderSentAt: nextDueDate ? null : item.reminderSentAt, overdueNotifiedAt: nextDueDate ? null : item.overdueNotifiedAt } }),
  ]);
  revalidatePath(`/compliance/${id}`); revalidatePath("/compliance");
}
