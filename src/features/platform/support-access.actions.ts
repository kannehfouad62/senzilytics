"use server";

import { ActivityAction, NotificationType, SupportAccessStatus, UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { tenantAssignableModules } from "@/core/navigation/tenant-module-catalog";
import { getPlatformAdministrator, requirePlatformAdministrator } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { supportAccessCookie, supportAccessDurations, supportAccessTransitionAllowed } from "@/modules/platform/support-access.service";
import { createNotification } from "@/core/notifications/notifications.service";

const required = (data: FormData, key: string) => { const result = String(data.get(key) ?? "").trim(); if (!result) throw new Error(`${key} is required.`); return result; };
const selectedModules = (data: FormData) => [...new Set(data.getAll("moduleKeys").map(String))];
async function tenantOwnerContext() {
  if (await getPlatformAdministrator()) throw new Error("A platform administrator cannot approve their own support access.");
  const context = await getCurrentUserTenant();
  if (context.user.role !== UserRole.ORG_ADMIN && context.user.role !== UserRole.SUPER_ADMIN) throw new Error("Only the tenant owner can approve support access.");
  return context;
}

export async function requestSupportAccess(data: FormData) {
  const admin = await requirePlatformAdministrator();
  const organizationId = required(data, "organizationId");
  const reason = required(data, "reason");
  if (reason.length > 2_000) throw new Error("Support reason is too long.");
  const durationMinutes = Number(required(data, "durationMinutes"));
  if (!supportAccessDurations.includes(durationMinutes as never)) throw new Error("Select a valid support duration.");
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, include: { moduleAssignments: { select: { moduleKey: true, enabled: true } } } });
  if (!organization || organization.status !== "ACTIVE") throw new Error("Select an active tenant.");
  if (organization.id === admin.organizationId) throw new Error("Support access is only for another tenant.");
  const available = new Set<string>(tenantAssignableModules(organization.industryCategory, organization.moduleAssignments).map((entry) => entry.key));
  const moduleKeys = selectedModules(data);
  if (!moduleKeys.length || moduleKeys.some((key) => !available.has(key))) throw new Error("Select at least one available tenant module.");
  const grant = await prisma.supportAccessGrant.create({ data: { organizationId, requestedById: admin.id, reason, durationMinutes, moduleKeys } });
  await prisma.activityLog.create({ data: { organizationId, userId: admin.id, action: ActivityAction.CREATE, entityType: "SupportAccessGrant", entityId: grant.id, title: "Support access requested", description: reason, metadata: { durationMinutes, moduleKeys } } });
  const owners = await prisma.user.findMany({ where: { organizationId, isActive: true, role: { in: [UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN] } }, select: { id: true } });
  await Promise.all(owners.map((owner) => createNotification({ organizationId, userId: owner.id, type: NotificationType.WARNING, title: "Senzilytics support access requested", message: `${admin.email} requested ${durationMinutes} minutes of read-only support access.`, link: "/support-access" }).catch(() => null)));
  revalidatePath("/platform/support-access"); revalidatePath("/support-access");
}

export async function decideSupportAccess(data: FormData) {
  const { organizationId, user } = await tenantOwnerContext();
  const grant = await prisma.supportAccessGrant.findFirst({ where: { id: required(data, "grantId"), organizationId } });
  if (!grant || grant.status !== SupportAccessStatus.REQUESTED) throw new Error("This support request is no longer awaiting a decision.");
  const approve = required(data, "decision") === "approve";
  const status = approve ? SupportAccessStatus.APPROVED : SupportAccessStatus.DENIED;
  if (!supportAccessTransitionAllowed(grant.status, status)) throw new Error("Invalid support-access transition.");
  const expiresAt = approve ? new Date(Date.now() + grant.durationMinutes * 60_000) : null;
  await prisma.$transaction([
    prisma.supportAccessGrant.update({ where: { id: grant.id }, data: { status, approvedById: user.id, approvedAt: new Date(), expiresAt } }),
    prisma.activityLog.create({ data: { organizationId, userId: user.id, action: ActivityAction.STATUS_CHANGE, entityType: "SupportAccessGrant", entityId: grant.id, title: approve ? "Support access approved" : "Support access denied", metadata: { expiresAt, moduleKeys: grant.moduleKeys } } }),
  ]);
  await createNotification({ organizationId, userId: grant.requestedById, type: approve ? NotificationType.SUCCESS : NotificationType.WARNING, title: approve ? "Tenant approved support access" : "Tenant denied support access", message: approve ? `Read-only access is approved until ${expiresAt!.toLocaleString("en-US")}.` : "The tenant did not approve the support request.", link: "/platform/support-access" }).catch(() => null);
  revalidatePath("/support-access"); revalidatePath("/platform/support-access");
}

export async function revokeSupportAccess(data: FormData) {
  const { organizationId, user } = await tenantOwnerContext();
  const grant = await prisma.supportAccessGrant.findFirst({ where: { id: required(data, "grantId"), organizationId, status: { in: [SupportAccessStatus.REQUESTED, SupportAccessStatus.APPROVED, SupportAccessStatus.ACTIVE] } } });
  if (!grant || !supportAccessTransitionAllowed(grant.status, SupportAccessStatus.REVOKED)) throw new Error("Support access is not revocable.");
  await prisma.$transaction([
    prisma.supportAccessGrant.update({ where: { id: grant.id }, data: { status: SupportAccessStatus.REVOKED, revokedById: user.id, revokedAt: new Date() } }),
    prisma.activityLog.create({ data: { organizationId, userId: user.id, action: ActivityAction.STATUS_CHANGE, entityType: "SupportAccessGrant", entityId: grant.id, title: "Support access revoked" } }),
  ]);
  revalidatePath("/support-access"); revalidatePath("/platform/support-access");
}

export async function enterSupportAccess(data: FormData) {
  const admin = await requirePlatformAdministrator();
  const grant = await prisma.supportAccessGrant.findFirst({ where: { id: required(data, "grantId"), requestedById: admin.id, status: SupportAccessStatus.APPROVED, expiresAt: { gt: new Date() } } });
  if (!grant || !supportAccessTransitionAllowed(grant.status, SupportAccessStatus.ACTIVE)) throw new Error("This support approval is unavailable or expired.");
  await prisma.$transaction([
    prisma.supportAccessGrant.update({ where: { id: grant.id }, data: { status: SupportAccessStatus.ACTIVE, enteredAt: new Date() } }),
    prisma.activityLog.create({ data: { organizationId: grant.organizationId, userId: admin.id, action: ActivityAction.LOGIN, entityType: "SupportAccessGrant", entityId: grant.id, title: "Read-only support session entered", metadata: { moduleKeys: grant.moduleKeys, expiresAt: grant.expiresAt } } }),
  ]);
  (await cookies()).set(supportAccessCookie, grant.id, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: Math.max(1, Math.floor((grant.expiresAt!.getTime() - Date.now()) / 1_000)) });
  redirect("/dashboard");
}

export async function exitSupportAccess() {
  const admin = await requirePlatformAdministrator();
  const jar = await cookies();
  const grantId = jar.get(supportAccessCookie)?.value;
  if (grantId) {
    const grant = await prisma.supportAccessGrant.findFirst({ where: { id: grantId, requestedById: admin.id, status: SupportAccessStatus.ACTIVE } });
    if (grant) await prisma.$transaction([
      prisma.supportAccessGrant.update({ where: { id: grant.id }, data: { status: SupportAccessStatus.COMPLETED, exitedAt: new Date() } }),
      prisma.activityLog.create({ data: { organizationId: grant.organizationId, userId: admin.id, action: ActivityAction.LOGOUT, entityType: "SupportAccessGrant", entityId: grant.id, title: "Read-only support session exited" } }),
    ]);
  }
  jar.delete(supportAccessCookie);
  redirect("/platform/support-access");
}
