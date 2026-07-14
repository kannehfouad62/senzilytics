import { logActivity } from "@/core/activity-log/activity-log.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { startWorkflowForEntity } from "@/core/workflow/workflow.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  NotificationType,
  RiskLevel,
  Status,
  UserRole,
  WorkflowEntityType,
} from "@prisma/client";
import {
  createTenantAudit,
  createTenantAuditFinding,
  findTenantAuditById,
  findTenantAuditFinding,
  updateTenantAuditFindingStatus,
  updateTenantAuditStatus,
} from "./audit.repository";

async function createNotificationSafely(input: {
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  context: string;
}) {
  try {
    await createNotification({
      organizationId:
        input.organizationId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
    });
  } catch (error) {
    console.error(
      `${input.context} notification failed for user ${input.userId}:`,
      error
    );
  }
}

async function notifyAuditCreated(input: {
  organizationId: string;
  createdById: string;
  auditId: string;
  auditTitle: string;
  siteName: string;
  scheduledAt?: Date | null;
}) {
  const link = `/audits/${input.auditId}`;

  const recipients =
    await prisma.user.findMany({
      where: {
        organizationId:
          input.organizationId,
        role: {
          in: [
            UserRole.ORG_ADMIN,
            UserRole.EHS_MANAGER,
            UserRole.AUDITOR,
          ],
        },
      },
      select: {
        id: true,
      },
    });

  const recipientIds = new Set(
    recipients.map(
      (recipient) => recipient.id
    )
  );

  recipientIds.add(input.createdById);

  await Promise.all(
    Array.from(recipientIds).map(
      async (recipientId) => {
        const isCreator =
          recipientId ===
          input.createdById;

        await createNotificationSafely({
          organizationId:
            input.organizationId,
          userId: recipientId,
          type: isCreator
            ? NotificationType.SUCCESS
            : NotificationType.INFO,
          title: isCreator
            ? "Audit created"
            : "New audit scheduled",
          message: isCreator
            ? `The audit "${input.auditTitle}" was created successfully.`
            : `"${input.auditTitle}" has been scheduled for ${input.siteName}.`,
          link,
          context:
            "Audit-created",
        });
      }
    )
  );
}

async function notifyAuditFindingCreated(input: {
  organizationId: string;
  auditId: string;
  auditTitle: string;
  findingTitle: string;
  riskLevel: RiskLevel;
}) {
  const recipients =
    await prisma.user.findMany({
      where: {
        organizationId:
          input.organizationId,
        role: {
          in: [
            UserRole.ORG_ADMIN,
            UserRole.EHS_MANAGER,
            UserRole.AUDITOR,
          ],
        },
      },
      select: {
        id: true,
      },
    });

  const notificationType =
    input.riskLevel ===
    RiskLevel.CRITICAL
      ? NotificationType.CRITICAL
      : input.riskLevel ===
          RiskLevel.HIGH
        ? NotificationType.WARNING
        : NotificationType.INFO;

  await Promise.all(
    recipients.map(
      async (recipient) => {
        await createNotificationSafely({
          organizationId:
            input.organizationId,
          userId: recipient.id,
          type: notificationType,
          title:
            input.riskLevel ===
            RiskLevel.CRITICAL
              ? "Critical audit finding"
              : input.riskLevel ===
                  RiskLevel.HIGH
                ? "High-risk audit finding"
                : "Audit finding recorded",
          message:
            `"${input.findingTitle}" was recorded during ` +
            `"${input.auditTitle}".`,
          link:
            `/audits/${input.auditId}`,
          context:
            "Audit-finding",
        });
      }
    )
  );
}

export async function createAuditService(input: {
  organizationId: string;
  userId: string;
  title: string;
  scope?: string | null;
  siteId: string;
  scheduledAt?: Date | null;
}) {
  const site =
    await prisma.site.findFirst({
      where: {
        id: input.siteId,
        organizationId:
          input.organizationId,
      },
      select: {
        id: true,
        name: true,
      },
    });

  if (!site) {
    throw new Error(
      "Invalid site for this organization."
    );
  }

  const audit = await createTenantAudit({
    title: input.title,
    scope: input.scope,
    siteId: site.id,
    scheduledAt: input.scheduledAt,
  });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType: "Audit",
    entityId: audit.id,
    title: "Audit created",
    description: audit.title,
    metadata: {
      siteId: site.id,
      scheduledAt:
        audit.scheduledAt?.toISOString() ??
        null,
      status: audit.status,
    },
  });

  try {
    await notifyAuditCreated({
      organizationId:
        input.organizationId,
      createdById: input.userId,
      auditId: audit.id,
      auditTitle: audit.title,
      siteName: site.name,
      scheduledAt:
        audit.scheduledAt,
    });
  } catch (error) {
    console.error(
      `Automatic audit notifications failed for audit ${audit.id}:`,
      error
    );
  }

  await startWorkflowForEntity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    entityType:
      WorkflowEntityType.AUDIT,
    entityId: audit.id,
  });

  return audit;
}

export async function updateAuditStatusService(input: {
  organizationId: string;
  userId: string;
  auditId: string;
  status: Status;
}) {
  const audit =
    await findTenantAuditById(
      input.auditId,
      input.organizationId
    );

  if (!audit) {
    throw new Error(
      "Invalid audit for this organization."
    );
  }

  const previousStatus = audit.status;

  if (previousStatus === input.status) {
    return audit;
  }

  const completedAt =
    input.status === Status.COMPLETED ||
    input.status === Status.CLOSED
      ? audit.completedAt ??
        new Date()
      : null;

  const updatedAudit =
    await updateTenantAuditStatus({
      auditId: audit.id,
      status: input.status,
      completedAt,
    });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action:
      ActivityAction.STATUS_CHANGE,
    entityType: "Audit",
    entityId: audit.id,
    title:
      "Audit status changed",
    description:
      `${previousStatus} → ${input.status}`,
    metadata: {
      previousStatus,
      newStatus: input.status,
      completedAt:
        completedAt?.toISOString() ??
        null,
    },
  });

  return updatedAudit;
}

export async function createAuditFindingService(input: {
  organizationId: string;
  userId: string;
  auditId: string;
  title: string;
  description?: string | null;
  riskLevel: RiskLevel;
}) {
  const audit =
    await findTenantAuditById(
      input.auditId,
      input.organizationId
    );

  if (!audit) {
    throw new Error(
      "Invalid audit for this organization."
    );
  }

  if (
    audit.status === Status.COMPLETED ||
    audit.status === Status.CLOSED
  ) {
    throw new Error(
      "Findings cannot be added to a completed or closed audit."
    );
  }

  const finding =
    await createTenantAuditFinding({
      auditId: audit.id,
      title: input.title,
      description: input.description,
      riskLevel: input.riskLevel,
    });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType: "AuditFinding",
    entityId: finding.id,
    title:
      "Audit finding created",
    description: finding.title,
    metadata: {
      auditId: audit.id,
      riskLevel:
        finding.riskLevel,
      status: finding.status,
    },
  });

  try {
    await notifyAuditFindingCreated({
      organizationId:
        input.organizationId,
      auditId: audit.id,
      auditTitle: audit.title,
      findingTitle:
        finding.title,
      riskLevel:
        finding.riskLevel,
    });
  } catch (error) {
    console.error(
      `Automatic audit-finding notifications failed for finding ${finding.id}:`,
      error
    );
  }

  return finding;
}

export async function updateAuditFindingStatusService(input: {
  organizationId: string;
  userId: string;
  auditId: string;
  findingId: string;
  status: Status;
}) {
  const finding =
    await findTenantAuditFinding({
      findingId: input.findingId,
      auditId: input.auditId,
      organizationId:
        input.organizationId,
    });

  if (!finding) {
    throw new Error(
      "Invalid audit finding for this organization."
    );
  }

  const previousStatus =
    finding.status;

  if (previousStatus === input.status) {
    return finding;
  }

  const updatedFinding =
    await updateTenantAuditFindingStatus({
      findingId:
        input.findingId,
      status: input.status,
    });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action:
      ActivityAction.STATUS_CHANGE,
    entityType: "AuditFinding",
    entityId: input.findingId,
    title:
      "Audit finding status changed",
    description:
      `${previousStatus} → ${input.status}`,
    metadata: {
      auditId: input.auditId,
      previousStatus,
      newStatus: input.status,
    },
  });

  return updatedFinding;
}