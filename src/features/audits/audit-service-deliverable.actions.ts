"use server";

import { revalidatePath } from "next/cache";
import {
  AuditServiceDeliverableStatus,
  AuditServiceDeliverableType,
  PermissionKey,
} from "@prisma/client";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { requireAuditServicesEntitlement } from "@/modules/audit/audit-services-entitlement";
import {
  createAuditServiceDeliverable,
  reviseAuditServiceDeliverable,
  transitionAuditServiceDeliverable,
} from "@/modules/audit/audit-service-deliverable.service";

const value = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
const required = (data: FormData, key: string) => {
  const result = value(data, key);
  if (!result) throw new Error(`${key} is required.`);
  return result;
};
async function context() {
  await requirePermission(PermissionKey.MANAGE_AUDITS);
  const tenant = await getCurrentUserTenant();
  await requireAuditServicesEntitlement(tenant.organizationId);
  return tenant;
}
const refresh = (id: string) =>
  revalidatePath(`/audit-services/engagements/${id}`);

export async function createEngagementDeliverable(data: FormData) {
  const { organizationId, user } = await context();
  const engagementId = required(data, "engagementId");
  const type = required(data, "type") as AuditServiceDeliverableType;
  if (!Object.values(AuditServiceDeliverableType).includes(type))
    throw new Error("Select a valid deliverable type.");
  await createAuditServiceDeliverable({
    organizationId,
    actorId: user.id,
    engagementId,
    sourceAuditId: value(data, "sourceAuditId"),
    reference: value(data, "reference"),
    type,
    title: required(data, "title"),
    summary: required(data, "summary"),
    narrative: value(data, "narrative"),
  });
  refresh(engagementId);
}

export async function transitionEngagementDeliverable(data: FormData) {
  const { organizationId, user } = await context();
  const engagementId = required(data, "engagementId");
  const status = required(data, "status") as AuditServiceDeliverableStatus;
  if (!Object.values(AuditServiceDeliverableStatus).includes(status))
    throw new Error("Select a valid deliverable status.");
  await transitionAuditServiceDeliverable({
    organizationId,
    actorId: user.id,
    deliverableId: required(data, "deliverableId"),
    status,
    notes: value(data, "notes"),
  });
  refresh(engagementId);
}

export async function reviseEngagementDeliverable(data: FormData) {
  const { organizationId, user } = await context();
  const engagementId = required(data, "engagementId");
  await reviseAuditServiceDeliverable({
    organizationId,
    actorId: user.id,
    deliverableId: required(data, "deliverableId"),
    changeNote: required(data, "changeNote"),
    summary: value(data, "summary"),
    narrative: value(data, "narrative"),
  });
  refresh(engagementId);
}
