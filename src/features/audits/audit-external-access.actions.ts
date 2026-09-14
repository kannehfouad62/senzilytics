"use server";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  auditExternalSessionCookie,
  issueAuditExternalAccess,
  revokeAuditExternalAccess,
  verifyAuditExternalPasscode,
} from "@/modules/audit/audit-external-access.service";
import { requireAuditServicesEntitlement } from "@/modules/audit/audit-services-entitlement";
import { AuditExternalAccessScope, PermissionKey } from "@prisma/client";
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
const phase4aScopes = [
  AuditExternalAccessScope.ENGAGEMENT,
  AuditExternalAccessScope.INFORMATION_REQUEST,
] as const;

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
  if (!phase4aScopes.includes(scope as (typeof phase4aScopes)[number]))
    throw new Error("Select a valid external access scope.");
  const expiresAt = new Date(required(data, "expiresAt"));
  await issueAuditExternalAccess({
    organizationId,
    actorId: user.id,
    engagementId,
    contactId: required(data, "contactId"),
    informationRequestId: value(data, "informationRequestId"),
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
