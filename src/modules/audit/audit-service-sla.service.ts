import {
  ActivityAction,
  AuditExternalAccessStatus,
  AuditExternalFindingReviewStatus,
  AuditInformationRequestStatus,
  AuditServiceDeliverableStatus,
  AuditServiceEngagementStatus,
  NotificationType,
  UserRole,
} from "@prisma/client";
import { createSenzilyticsEmailTemplate } from "@/core/email/email-template";
import { getApplicationUrl, sendTenantNotificationEmail } from "@/core/email/email.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";

type Signal = {
  organizationId: string;
  entityType: string;
  entityId: string;
  reference: string;
  title: string;
  milestone: string;
  dueAt: Date;
  link: string;
  recipientIds: string[];
};

const day = 86_400_000;
const terminalEngagements = [
  AuditServiceEngagementStatus.COMPLETED,
  AuditServiceEngagementStatus.CANCELLED,
];
const terminalRequests = [
  AuditInformationRequestStatus.ACCEPTED,
  AuditInformationRequestStatus.CLOSED,
  AuditInformationRequestStatus.CANCELLED,
];
const compact = (values: Array<string | null | undefined>) => [
  ...new Set(values.filter((value): value is string => Boolean(value))),
];
export const auditServiceSlaLevel = (dueAt: Date, now: Date) => {
  const overdueDays = Math.floor((now.getTime() - dueAt.getTime()) / day);
  if (overdueDays >= 3) return "ESCALATED";
  if (overdueDays >= 0) return "OVERDUE";
  return "DUE_SOON";
};

export async function processAuditServiceSla(now = new Date()) {
  const horizon = new Date(now.getTime() + 7 * day);
  const reviewCutoff = new Date(now.getTime() - 2 * day);
  const [engagements, requests, accesses, deliverables, responses] =
    await Promise.all([
      prisma.auditServiceEngagement.findMany({
        where: {
          status: { notIn: terminalEngagements },
          dueDate: { not: null, lte: horizon },
        },
        select: {
          id: true,
          organizationId: true,
          reference: true,
          title: true,
          dueDate: true,
          ownerId: true,
          managerId: true,
          leadAuditorId: true,
        },
      }),
      prisma.auditServiceInformationRequest.findMany({
        where: {
          status: { notIn: terminalRequests },
          dueDate: { not: null, lte: horizon },
        },
        include: {
          engagement: {
            select: {
              reference: true,
              title: true,
              managerId: true,
              leadAuditorId: true,
            },
          },
        },
      }),
      prisma.auditServiceExternalAccess.findMany({
        where: {
          status: AuditExternalAccessStatus.ACTIVE,
          expiresAt: { gt: now, lte: new Date(now.getTime() + 2 * day) },
        },
        include: { engagement: { select: { reference: true, managerId: true } } },
      }),
      prisma.auditServiceDeliverable.findMany({
        where: {
          status: {
            in: [
              AuditServiceDeliverableStatus.UNDER_REVIEW,
              AuditServiceDeliverableStatus.CHANGES_REQUESTED,
              AuditServiceDeliverableStatus.APPROVED,
            ],
          },
          updatedAt: { lte: reviewCutoff },
        },
        include: {
          engagement: {
            select: { reference: true, managerId: true, leadAuditorId: true },
          },
        },
      }),
      prisma.auditServiceExternalFindingResponse.findMany({
        where: {
          reviewStatus: {
            in: [
              AuditExternalFindingReviewStatus.PENDING,
              AuditExternalFindingReviewStatus.CHANGES_REQUESTED,
            ],
          },
          submittedAt: { lte: reviewCutoff },
        },
        include: {
          access: {
            include: {
              engagement: {
                select: { reference: true, managerId: true, leadAuditorId: true },
              },
            },
          },
        },
      }),
    ]);

  const signals: Signal[] = [
    ...engagements.map((record) => ({
      organizationId: record.organizationId,
      entityType: "AuditServiceEngagement",
      entityId: record.id,
      reference: record.reference,
      title: record.title,
      milestone: "engagement completion",
      dueAt: record.dueDate!,
      link: `/audit-services/engagements/${record.id}`,
      recipientIds: compact([record.ownerId, record.managerId, record.leadAuditorId]),
    })),
    ...requests.map((record) => ({
      organizationId: record.organizationId,
      entityType: "AuditServiceInformationRequest",
      entityId: record.id,
      reference: record.reference,
      title: record.title,
      milestone: "information request",
      dueAt: record.dueDate!,
      link: `/audit-services/engagements/${record.engagementId}`,
      recipientIds: compact([record.ownerId, record.engagement.managerId, record.engagement.leadAuditorId]),
    })),
    ...accesses.map((record) => ({
      organizationId: record.organizationId,
      entityType: "AuditServiceExternalAccess",
      entityId: record.id,
      reference: record.engagement.reference,
      title: record.title,
      milestone: "secure client access expiry",
      dueAt: record.expiresAt,
      link: `/audit-services/engagements/${record.engagementId}`,
      recipientIds: compact([record.createdById, record.engagement.managerId]),
    })),
    ...deliverables.map((record) => ({
      organizationId: record.organizationId,
      entityType: "AuditServiceDeliverable",
      entityId: record.id,
      reference: `${record.reference} v${record.version}`,
      title: record.title,
      milestone: record.status === AuditServiceDeliverableStatus.APPROVED ? "approved report release" : "deliverable review",
      dueAt: new Date(record.updatedAt.getTime() + 2 * day),
      link: `/audit-services/engagements/${record.engagementId}`,
      recipientIds: compact([record.createdById, record.engagement.managerId, record.engagement.leadAuditorId]),
    })),
    ...responses.map((record) => ({
      organizationId: record.organizationId,
      entityType: "AuditServiceExternalFindingResponse",
      entityId: record.id,
      reference: record.access.engagement.reference,
      title: record.access.title,
      milestone: "external finding response review",
      dueAt: new Date(record.submittedAt.getTime() + 2 * day),
      link: `/audit-services/engagements/${record.access.engagementId}`,
      recipientIds: compact([record.access.engagement.managerId, record.access.engagement.leadAuditorId]),
    })),
  ];

  let notificationsSent = 0;
  let emailsSent = 0;
  let escalations = 0;
  for (const signal of signals) {
    const level = auditServiceSlaLevel(signal.dueAt, now);
    const recipients = new Set(signal.recipientIds);
    if (level !== "DUE_SOON") {
      const managers = await prisma.user.findMany({
        where: {
          organizationId: signal.organizationId,
          isActive: true,
          role: { in: [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.EHS_MANAGER] },
        },
        select: { id: true },
      });
      managers.forEach((manager) => recipients.add(manager.id));
    }
    const users = await prisma.user.findMany({
      where: { organizationId: signal.organizationId, isActive: true, id: { in: [...recipients] } },
      select: { id: true, name: true, email: true },
    });
    for (const recipient of users) {
      const auditKey = `Audit service SLA:${signal.milestone}:${level}:${recipient.id}`;
      const sent = await prisma.activityLog.findFirst({
        where: { organizationId: signal.organizationId, entityType: signal.entityType, entityId: signal.entityId, title: auditKey },
        select: { id: true },
      });
      if (sent) continue;
      const overdue = level !== "DUE_SOON";
      const title = `${signal.milestone} ${overdue ? "overdue" : "due soon"}`;
      const message = `${signal.reference} — ${signal.title} is ${overdue ? "past its governed milestone" : `due ${signal.dueAt.toLocaleDateString("en-US")}`}.`;
      const notification = await createNotification({ organizationId: signal.organizationId, userId: recipient.id, type: level === "ESCALATED" ? NotificationType.CRITICAL : overdue ? NotificationType.WARNING : NotificationType.DUE_DATE, title, message, link: signal.link }).catch(() => null);
      if (notification) notificationsSent += 1;
      const email = await sendTenantNotificationEmail({
        to: recipient.email,
        subject: `Senzilytics: ${title}`,
        html: createSenzilyticsEmailTemplate({ preheader: title, heading: title, body: `${recipient.name}, ${message}`, actionLabel: "Open Audit Service Milestone", actionUrl: `${getApplicationUrl()}${signal.link}` }),
      });
      if (email.messageId) emailsSent += 1;
      if (notification || email.messageId) {
        await prisma.activityLog.create({ data: { organizationId: signal.organizationId, userId: recipient.id, action: ActivityAction.SYSTEM, entityType: signal.entityType, entityId: signal.entityId, title: auditKey, description: message, metadata: { level, milestone: signal.milestone, dueAt: signal.dueAt.toISOString(), notificationId: notification?.id ?? null, emailMessageId: email.messageId } } });
        if (level === "ESCALATED") escalations += 1;
      }
    }
  }
  return { checked: signals.length, notificationsSent, emailsSent, escalations };
}
