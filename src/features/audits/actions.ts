"use server";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { createAuditService } from "@/modules/audit/audit.service";
import { AuditType, PermissionKey } from "@prisma/client";
import { redirect } from "next/navigation";

function required(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function optional(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim() || null;
}

function optionalDate(formData: FormData, name: string) {
  const value = optional(formData, name);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${name} must be a valid date.`);
  return date;
}

export async function createAudit(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_AUDITS);
  const { organizationId, user } = await getCurrentUserTenant();
  const auditType = required(formData, "auditType");

  if (!Object.values(AuditType).includes(auditType as AuditType)) {
    throw new Error("A valid audit type is required.");
  }

  const audit = await createAuditService({
    organizationId,
    userId: user.id,
    title: required(formData, "title"),
    reference: optional(formData, "reference"),
    description: optional(formData, "description"),
    objectives: optional(formData, "objectives"),
    scope: optional(formData, "scope"),
    criteria: optional(formData, "criteria"),
    auditType: auditType as AuditType,
    siteId: required(formData, "siteId"),
    departmentId: optional(formData, "departmentId"),
    programId: optional(formData, "programId"),
    protocolId: optional(formData, "protocolId"),
    leadAuditorId: optional(formData, "leadAuditorId"),
    ownerId: optional(formData, "ownerId"),
    scheduledAt: optionalDate(formData, "scheduledAt"),
    dueDate: optionalDate(formData, "dueDate"),
  });

  redirect(`/audits/${audit.id}`);
}
