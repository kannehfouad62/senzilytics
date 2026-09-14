import { logActivity } from "@/core/activity-log/activity-log.service";
import { createSenzilyticsEmailTemplate } from "@/core/email/email-template";
import { getApplicationUrl, sendEmail } from "@/core/email/email.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  AuditExternalAccessScope,
  AuditExternalAccessStatus,
  AuditServiceEngagementKind,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomInt } from "node:crypto";

export const auditExternalSessionCookie = "senzilytics_audit_client";
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const clean = (value: string | null | undefined, maximum = 2000) =>
  value?.trim().slice(0, maximum) || null;

export async function issueAuditExternalAccess(input: {
  organizationId: string;
  actorId: string;
  engagementId: string;
  contactId: string;
  informationRequestId?: string | null;
  scope: AuditExternalAccessScope;
  title: string;
  instructions?: string | null;
  expiresAt: Date;
}) {
  const now = new Date();
  if (!Number.isFinite(input.expiresAt.valueOf()) || input.expiresAt <= now)
    throw new Error("External access expiry must be in the future.");
  if (input.expiresAt > new Date(now.getTime() + 30 * 86400000))
    throw new Error("External access cannot exceed 30 days.");
  const engagement = await prisma.auditServiceEngagement.findFirst({
    where: {
      id: input.engagementId,
      organizationId: input.organizationId,
      kind: AuditServiceEngagementKind.EXTERNAL,
      clientId: { not: null },
    },
    include: {
      organization: { select: { name: true } },
      client: {
        include: {
          contacts: {
            where: {
              id: input.contactId,
              isActive: true,
              isAuthorizedRepresentative: true,
            },
          },
        },
      },
    },
  });
  const contact = engagement?.client?.contacts[0];
  if (!engagement || !contact)
    throw new Error(
      "Select an active authorized representative for this external engagement.",
    );
  const informationRequestId = clean(input.informationRequestId, 100);
  if (input.scope === AuditExternalAccessScope.INFORMATION_REQUEST) {
    if (!informationRequestId)
      throw new Error("Select an information request for this access link.");
    const request = await prisma.auditServiceInformationRequest.findFirst({
      where: {
        id: informationRequestId,
        organizationId: input.organizationId,
        engagementId: engagement.id,
      },
      select: { id: true },
    });
    if (!request) throw new Error("Information request not found.");
  } else if (informationRequestId) {
    throw new Error("Information requests require the matching access scope.");
  }
  const title = clean(input.title, 200);
  if (!title) throw new Error("External access title is required.");
  const token = randomBytes(32).toString("base64url");
  const passcode = randomInt(100000, 1000000).toString();
  const access = await prisma.auditServiceExternalAccess.create({
    data: {
      organizationId: input.organizationId,
      engagementId: engagement.id,
      contactId: contact.id,
      informationRequestId:
        input.scope === AuditExternalAccessScope.INFORMATION_REQUEST
          ? informationRequestId
          : null,
      scope: input.scope,
      title,
      instructions: clean(input.instructions),
      tokenHash: digest(token),
      passcodeHash: await bcrypt.hash(passcode, 12),
      expiresAt: input.expiresAt,
      createdById: input.actorId,
    },
  });
  const url = `${getApplicationUrl()}/audit-client/${token}`;
  const delivery = await sendEmail({
    to: contact.email,
    subject: `${engagement.organization.name}: secure audit review access`,
    html: createSenzilyticsEmailTemplate({
      preheader: "Secure external audit access",
      heading: "Audit review access",
      body: `${contact.name}, ${engagement.organization.name} has provided controlled access to ${title}. Open the secure link and enter the one-time passcode below. Do not forward either credential.`,
      actionLabel: "Open Secure Audit Access",
      actionUrl: url,
      details: [
        { label: "Engagement", value: engagement.reference },
        { label: "Passcode", value: passcode },
        { label: "Expires", value: input.expiresAt.toUTCString() },
      ],
    }),
    text: `Secure audit access: ${url}\nPasscode: ${passcode}\nExpires: ${input.expiresAt.toUTCString()}`,
  });
  if (!delivery.success) {
    await prisma.auditServiceExternalAccess.update({
      where: { id: access.id },
      data: { status: AuditExternalAccessStatus.REVOKED, revokedAt: new Date() },
    });
    throw new Error("The access email could not be delivered. No active link was issued.");
  }
  await logActivity({
    organizationId: input.organizationId,
    userId: input.actorId,
    action: ActivityAction.CREATE,
    entityType: "AuditServiceExternalAccess",
    entityId: access.id,
    title: "Secure external audit access issued",
    description: `${engagement.reference} · ${contact.email} · ${input.scope}`,
    metadata: {
      engagementId: engagement.id,
      contactId: contact.id,
      scope: input.scope,
      expiresAt: input.expiresAt.toISOString(),
      emailMessageId: delivery.messageId,
    },
  });
  return access;
}

export async function verifyAuditExternalPasscode(token: string, passcode: string) {
  const now = new Date();
  const access = await prisma.auditServiceExternalAccess.findUnique({
    where: { tokenHash: digest(token) },
  });
  if (
    !access ||
    access.status !== AuditExternalAccessStatus.ACTIVE ||
    access.expiresAt <= now
  )
    throw new Error("This external audit link is invalid or expired.");
  if (access.lockedUntil && access.lockedUntil > now)
    throw new Error("Verification is temporarily locked. Try again later.");
  const valid = await bcrypt.compare(passcode.trim(), access.passcodeHash);
  if (!valid) {
    const attempts =
      access.lockedUntil && access.lockedUntil <= now
        ? 1
        : access.failedAttempts + 1;
    await prisma.auditServiceExternalAccess.update({
      where: { id: access.id },
      data: {
        failedAttempts: attempts >= access.maxAttempts ? 0 : attempts,
        lockedUntil:
          attempts >= access.maxAttempts
            ? new Date(now.getTime() + 15 * 60 * 1000)
            : null,
      },
    });
    throw new Error("The verification passcode is incorrect.");
  }
  const sessionToken = randomBytes(32).toString("base64url");
  const sessionExpiresAt = new Date(
    Math.min(access.expiresAt.getTime(), now.getTime() + 4 * 60 * 60 * 1000),
  );
  await prisma.auditServiceExternalAccess.update({
    where: { id: access.id },
    data: {
      sessionTokenHash: digest(sessionToken),
      sessionExpiresAt,
      verifiedAt: now,
      lastAccessedAt: now,
      failedAttempts: 0,
      lockedUntil: null,
    },
  });
  return { accessId: access.id, sessionToken, sessionExpiresAt };
}

export async function resolveAuditExternalAccess(
  token: string,
  sessionToken?: string | null,
) {
  if (!sessionToken) return null;
  const now = new Date();
  const access = await prisma.auditServiceExternalAccess.findFirst({
    where: {
      tokenHash: digest(token),
      sessionTokenHash: digest(sessionToken),
      status: AuditExternalAccessStatus.ACTIVE,
      expiresAt: { gt: now },
      sessionExpiresAt: { gt: now },
    },
    include: {
      organization: { select: { name: true } },
      engagement: {
        select: { reference: true, title: true, purpose: true, scope: true },
      },
      contact: { select: { name: true, email: true } },
      informationRequest: {
        select: { reference: true, title: true, description: true, dueDate: true },
      },
    },
  });
  if (access)
    await prisma.auditServiceExternalAccess.update({
      where: { id: access.id },
      data: { lastAccessedAt: now },
    });
  return access;
}

export async function revokeAuditExternalAccess(input: {
  organizationId: string;
  actorId: string;
  accessId: string;
}) {
  const access = await prisma.auditServiceExternalAccess.findFirst({
    where: { id: input.accessId, organizationId: input.organizationId },
  });
  if (!access) throw new Error("External access record not found.");
  if (access.status === AuditExternalAccessStatus.REVOKED) return access;
  const updated = await prisma.auditServiceExternalAccess.update({
    where: { id: access.id },
    data: {
      status: AuditExternalAccessStatus.REVOKED,
      revokedAt: new Date(),
      sessionTokenHash: null,
      sessionExpiresAt: null,
    },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.actorId,
    action: ActivityAction.STATUS_CHANGE,
    entityType: "AuditServiceExternalAccess",
    entityId: access.id,
    title: "External audit access revoked",
    description: access.title,
  });
  return updated;
}
