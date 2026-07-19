"use server";

import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey, RiskLevel, SafetyObservationStatus, SafetyObservationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";

const required = (data: FormData, key: string) => {
  const value = String(data.get(key) || "").trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
};
const optional = (data: FormData, key: string) => String(data.get(key) || "").trim() || null;

export async function createSafetyObservation(data: FormData) {
  await requirePermission(PermissionKey.CREATE_OBSERVATION);
  const { organizationId, user } = await getCurrentUserTenant();
  const siteId = required(data, "siteId");
  const site = await prisma.site.findFirst({ where: { id: siteId, organizationId }, select: { id: true } });
  if (!site) throw new Error("Select a valid site.");
  const type = required(data, "type") as SafetyObservationType;
  const riskLevel = required(data, "riskLevel") as RiskLevel;
  if (!Object.values(SafetyObservationType).includes(type)) throw new Error("Select a valid observation type.");
  if (!Object.values(RiskLevel).includes(riskLevel)) throw new Error("Select a valid risk level.");
  const observedAt = new Date(required(data, "observedAt"));
  if (Number.isNaN(observedAt.getTime())) throw new Error("Enter a valid observation date.");
  const observation = await prisma.safetyObservation.create({ data: {
    reference: `OBS-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
    title: required(data, "title"), description: required(data, "description"), type, riskLevel,
    siteId, organizationId, reportedById: user.id, departmentId: user.departmentId,
    location: optional(data, "location"), immediateAction: optional(data, "immediateAction"),
    isAnonymous: data.get("isAnonymous") === "on", observedAt,
  }});
  redirect(`/observations/${observation.id}`);
}

export async function triageSafetyObservation(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_OBSERVATIONS);
  const { organizationId } = await getCurrentUserTenant();
  const id = required(data, "id");
  const status = required(data, "status") as SafetyObservationStatus;
  if (!Object.values(SafetyObservationStatus).includes(status)) throw new Error("Select a valid status.");
  const assignedToId = optional(data, "assignedToId");
  if (assignedToId && !(await prisma.user.findFirst({ where: { id: assignedToId, organizationId } }))) throw new Error("Select a valid assignee.");
  const result = await prisma.safetyObservation.updateMany({ where: { id, organizationId }, data: {
    status, assignedToId, reviewNotes: optional(data, "reviewNotes"),
    resolvedAt: status === SafetyObservationStatus.RESOLVED || status === SafetyObservationStatus.CLOSED ? new Date() : null,
  }});
  if (!result.count) throw new Error("Observation not found.");
  revalidatePath(`/observations/${id}`); revalidatePath("/observations");
}
