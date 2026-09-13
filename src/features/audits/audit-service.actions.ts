"use server";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { requireAuditServicesEntitlement } from "@/modules/audit/audit-services-entitlement";
import {
  addAuditServiceClientContact,
  addAuditServiceEngagementTeamMember,
  changeAuditServiceEngagementStatus,
  createAuditServiceClientRecord,
  createAuditServiceEngagementRecord,
  changeAuditServiceClientStatus,
  linkEnterpriseAuditToEngagement,
} from "@/modules/audit/audit-service.service";
import {
  AuditServiceEngagementKind,
  AuditServiceClientStatus,
  AuditServiceEngagementStatus,
  AuditServiceEngagementTeamRole,
  PermissionKey,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  declareAuditServiceIndependence,
  reviewAuditServiceIndependence,
  reviewAuditServicePlan,
  submitAuditServicePlan,
} from "@/modules/audit/audit-service-planning.service";
import {
  AuditIndependenceDecision,
  AuditServiceRiskRating,
} from "@prisma/client";

const value = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
const required = (data: FormData, key: string) => {
  const result = value(data, key);
  if (!result) throw new Error(`${key} is required.`);
  return result;
};
const optionalDate = (data: FormData, key: string) => {
  const raw = value(data, key);
  if (!raw) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()))
    throw new Error(`${key} is not a valid date.`);
  return date;
};

async function auditServiceContext() {
  await requirePermission(PermissionKey.MANAGE_AUDITS);
  const tenant = await getCurrentUserTenant();
  await requireAuditServicesEntitlement(tenant.organizationId);
  return tenant;
}

export async function createAuditServiceClient(data: FormData) {
  const { organizationId, user } = await auditServiceContext();
  await createAuditServiceClientRecord({
    organizationId,
    userId: user.id,
    reference: value(data, "reference"),
    name: required(data, "name"),
    legalName: value(data, "legalName"),
    industry: value(data, "industry"),
    country: value(data, "country"),
    address: value(data, "address"),
    website: value(data, "website"),
    notes: value(data, "notes"),
  });
  revalidatePath("/audit-services");
}

export async function createAuditServiceContact(data: FormData) {
  const { organizationId, user } = await auditServiceContext();
  await addAuditServiceClientContact({
    organizationId,
    userId: user.id,
    clientId: required(data, "clientId"),
    name: required(data, "name"),
    email: required(data, "email"),
    jobTitle: value(data, "jobTitle"),
    phone: value(data, "phone"),
    isPrimary: data.get("isPrimary") === "on",
    isAuthorizedRepresentative: data.get("isAuthorizedRepresentative") === "on",
  });
  revalidatePath("/audit-services");
}

export async function createAuditServiceEngagement(data: FormData) {
  const { organizationId, user } = await auditServiceContext();
  const kind = required(data, "kind") as AuditServiceEngagementKind;
  if (!Object.values(AuditServiceEngagementKind).includes(kind))
    throw new Error("Select a valid engagement kind.");
  await createAuditServiceEngagementRecord({
    organizationId,
    userId: user.id,
    reference: value(data, "reference"),
    title: required(data, "title"),
    kind,
    clientId: value(data, "clientId"),
    purpose: required(data, "purpose"),
    scope: required(data, "scope"),
    objectives: value(data, "objectives"),
    criteria: value(data, "criteria"),
    externalContractReference: value(data, "externalContractReference"),
    ownerId: value(data, "ownerId"),
    managerId: value(data, "managerId"),
    leadAuditorId: value(data, "leadAuditorId"),
    plannedStartDate: optionalDate(data, "plannedStartDate"),
    plannedEndDate: optionalDate(data, "plannedEndDate"),
    dueDate: optionalDate(data, "dueDate"),
  });
  revalidatePath("/audit-services");
}

export async function updateAuditServiceEngagementStatus(data: FormData) {
  const { organizationId, user } = await auditServiceContext();
  const status = required(data, "status") as AuditServiceEngagementStatus;
  if (!Object.values(AuditServiceEngagementStatus).includes(status))
    throw new Error("Select a valid engagement status.");
  await changeAuditServiceEngagementStatus({
    organizationId,
    userId: user.id,
    engagementId: required(data, "engagementId"),
    status,
    cancellationReason: value(data, "cancellationReason"),
  });
  revalidatePath("/audit-services");
}

export async function assignAuditServiceEngagementMember(data: FormData) {
  const { organizationId, user } = await auditServiceContext();
  const role = required(data, "role") as AuditServiceEngagementTeamRole;
  if (!Object.values(AuditServiceEngagementTeamRole).includes(role))
    throw new Error("Select a valid engagement role.");
  await addAuditServiceEngagementTeamMember({
    organizationId,
    userId: user.id,
    engagementId: required(data, "engagementId"),
    memberUserId: required(data, "memberUserId"),
    role,
  });
  revalidatePath("/audit-services");
}

export async function updateAuditServiceClientStatus(data: FormData) {
  const { organizationId, user } = await auditServiceContext();
  const status = required(data, "status") as AuditServiceClientStatus;
  if (!Object.values(AuditServiceClientStatus).includes(status))
    throw new Error("Select a valid client status.");
  await changeAuditServiceClientStatus({
    organizationId,
    userId: user.id,
    clientId: required(data, "clientId"),
    status,
  });
  revalidatePath("/audit-services");
  revalidatePath(`/audit-services/clients/${required(data, "clientId")}`);
}

export async function linkAuditServiceEngagementAudit(data: FormData) {
  const { organizationId, user } = await auditServiceContext();
  const engagementId = required(data, "engagementId");
  await linkEnterpriseAuditToEngagement({
    organizationId,
    userId: user.id,
    engagementId,
    auditId: required(data, "auditId"),
  });
  revalidatePath("/audit-services");
  revalidatePath(`/audit-services/engagements/${engagementId}`);
  revalidatePath("/audits");
}

export async function declareEngagementIndependence(data: FormData) {
  const { organizationId, user } = await auditServiceContext();
  await declareAuditServiceIndependence({
    organizationId,
    actorId: user.id,
    engagementId: required(data, "engagementId"),
    userId: user.id,
    conflictDeclared: data.get("conflictDeclared") === "on",
    declaration: required(data, "declaration"),
    safeguards: value(data, "safeguards"),
  });
  revalidatePath(
    `/audit-services/engagements/${required(data, "engagementId")}`,
  );
}

export async function reviewEngagementIndependence(data: FormData) {
  const { organizationId, user } = await auditServiceContext();
  const decision = required(data, "decision") as AuditIndependenceDecision;
  if (!Object.values(AuditIndependenceDecision).includes(decision))
    throw new Error("Select a valid independence decision.");
  await reviewAuditServiceIndependence({
    organizationId,
    reviewerId: user.id,
    declarationId: required(data, "declarationId"),
    decision,
    notes: value(data, "notes"),
  });
  revalidatePath(
    `/audit-services/engagements/${required(data, "engagementId")}`,
  );
}

export async function submitEngagementPlan(data: FormData) {
  const { organizationId, user } = await auditServiceContext();
  const riskRating = required(data, "riskRating") as AuditServiceRiskRating;
  if (!Object.values(AuditServiceRiskRating).includes(riskRating))
    throw new Error("Select a valid risk rating.");
  await submitAuditServicePlan({
    organizationId,
    userId: user.id,
    engagementId: required(data, "engagementId"),
    riskRating,
    riskRationale: required(data, "riskRationale"),
    planningNotes: value(data, "planningNotes"),
  });
  revalidatePath(
    `/audit-services/engagements/${required(data, "engagementId")}`,
  );
}

export async function reviewEngagementPlan(data: FormData) {
  const { organizationId, user } = await auditServiceContext();
  const decision = required(data, "decision");
  if (decision !== "APPROVED" && decision !== "CHANGES_REQUESTED")
    throw new Error("Select a valid planning decision.");
  await reviewAuditServicePlan({
    organizationId,
    reviewerId: user.id,
    engagementId: required(data, "engagementId"),
    decision,
    notes: value(data, "notes"),
  });
  revalidatePath(
    `/audit-services/engagements/${required(data, "engagementId")}`,
  );
}
