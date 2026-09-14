"use server";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  auditExternalSessionCookie,
  issueAuditExternalAccess,
  recordAuditExternalComment,
  recordAuditExternalDecision,
  recordAuditExternalFindingResponse,
  resolveAuditExternalAccess,
  revokeAuditExternalAccess,
  verifyAuditExternalPasscode,
} from "@/modules/audit/audit-external-access.service";
import { requireAuditServicesEntitlement } from "@/modules/audit/audit-services-entitlement";
import {
  AuditExternalAccessScope,
  AuditExternalDecisionType,
  AuditExternalFindingPosition,
  PermissionKey,
} from "@prisma/client";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const value = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
const required = (data: FormData, key: string) => {
  const result = value(data, key);
  if (!result) throw new Error(`${key} is required.`);
  return result;
};

async function internalContext() {
  await requirePermission(PermissionKey.MANAGE_AUDITS);
  const tenant = await getCurrentUserTenant();
  await requireAuditServicesEntitlement(tenant.organizationId);
  return tenant;
}

export async function createAuditExternalAccess(data: FormData) {
  const { organizationId, user } = await internalContext();
  const engagementId = required(data, "engagementId");
  const scope = required(data, "scope") as AuditExternalAccessScope;
  if (!Object.values(AuditExternalAccessScope).includes(scope))
    throw new Error("Select a valid external access scope.");
  const expiresAt = new Date(required(data, "expiresAt"));
  await issueAuditExternalAccess({
    organizationId,
    actorId: user.id,
    engagementId,
    contactId: required(data, "contactId"),
    informationRequestId: value(data, "informationRequestId"),
    auditId: value(data, "auditId"),
    questionId: value(data, "questionId"),
    findingId: value(data, "findingId"),
    scope,
    title: required(data, "title"),
    instructions: value(data, "instructions"),
    expiresAt,
  });
  revalidatePath(`/audit-services/engagements/${engagementId}`);
}

export async function revokeAuditExternalAccessLink(data: FormData) {
  const { organizationId, user } = await internalContext();
  await revokeAuditExternalAccess({
    organizationId,
    actorId: user.id,
    accessId: required(data, "accessId"),
  });
  revalidatePath(
    `/audit-services/engagements/${required(data, "engagementId")}`,
  );
}

export async function verifyExternalAuditPasscode(data: FormData) {
  const token = required(data, "token");
  const passcode = required(data, "passcode");
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !/^\d{6}$/.test(passcode))
    redirect("/audit-client/invalid?error=invalid");
  let verified: Awaited<ReturnType<typeof verifyAuditExternalPasscode>> | null =
    null;
  try {
    verified = await verifyAuditExternalPasscode(token, passcode);
  } catch {
    redirect(`/audit-client/${encodeURIComponent(token)}?error=invalid`);
  }
  const jar = await cookies();
  jar.set(auditExternalSessionCookie, verified.sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: `/audit-client/${token}`,
    expires: verified.sessionExpiresAt,
  });
  redirect(`/audit-client/${encodeURIComponent(token)}`);
}

async function verifiedExternalAccess(data: FormData) {
  const token = required(data, "token");
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new Error("Invalid external audit access.");
  const sessionToken = (await cookies()).get(auditExternalSessionCookie)?.value;
  const access = await resolveAuditExternalAccess(token, sessionToken);
  if (!access) throw new Error("External audit session is invalid or expired.");
  return { token, access };
}

export async function addExternalAuditComment(data: FormData) {
  let token = "invalid";
  try {
    const verified = await verifiedExternalAccess(data);
    token = verified.token;
    await recordAuditExternalComment({
      accessId: verified.access.id,
      body: required(data, "body"),
    });
  } catch {
    redirect(`/audit-client/${encodeURIComponent(token)}?error=action`);
  }
  redirect(`/audit-client/${encodeURIComponent(token)}?saved=comment`);
}

export async function submitExternalAuditDecision(data: FormData) {
  let token = "invalid";
  try {
    const verified = await verifiedExternalAccess(data);
    token = verified.token;
    const decision = required(data, "decision") as AuditExternalDecisionType;
    if (!Object.values(AuditExternalDecisionType).includes(decision))
      throw new Error("Invalid external decision.");
    await recordAuditExternalDecision({
      accessId: verified.access.id,
      decision,
      comment: value(data, "comment"),
    });
  } catch {
    redirect(`/audit-client/${encodeURIComponent(token)}?error=action`);
  }
  redirect(`/audit-client/${encodeURIComponent(token)}?saved=decision`);
}

export async function submitExternalFindingResponse(data: FormData) {
  let token = "invalid";
  try {
    const verified = await verifiedExternalAccess(data);
    token = verified.token;
    const position = required(data, "position") as AuditExternalFindingPosition;
    if (!Object.values(AuditExternalFindingPosition).includes(position))
      throw new Error("Invalid finding response position.");
    const target = value(data, "targetDate");
    const targetDate = target ? new Date(`${target}T00:00:00Z`) : null;
    await recordAuditExternalFindingResponse({
      accessId: verified.access.id,
      position,
      response: required(data, "response"),
      proposedRootCause: value(data, "proposedRootCause"),
      immediateCorrection: value(data, "immediateCorrection"),
      remediationPlan: value(data, "remediationPlan"),
      targetDate,
    });
  } catch {
    redirect(`/audit-client/${encodeURIComponent(token)}?error=action`);
  }
  redirect(`/audit-client/${encodeURIComponent(token)}?saved=finding-response`);
}
