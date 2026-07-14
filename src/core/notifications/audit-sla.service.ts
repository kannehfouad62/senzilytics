import { logActivity } from "@/core/activity-log/activity-log.service";
import {
  sendAuditFindingSlaEmail,
  sendAuditSlaEmail,
} from "@/core/notifications/audit-sla-email.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  NotificationType,
  Status,
  UserRole,
} from "@prisma/client";

const REMINDER_WINDOW_HOURS = 24;

function getFindingReminderTitle(
  findingId: string
) {
  return `Audit finding reminder sent:${findingId}`;
}

function getFindingOverdueTitle(
  findingId: string
) {
  return `Audit finding overdue alert sent:${findingId}`;
}

async function getAuditRecipients(input: {
  organizationId: string;
  leadAuditorId?: string | null;
  teamMemberIds: string[];
}) {
  const recipientIds =
    new Set<string>(
      input.teamMemberIds
    );

  if (input.leadAuditorId) {
    recipientIds.add(
      input.leadAuditorId
    );
  }

  const managementUsers =
    await prisma.user.findMany({
      where: {
        organizationId:
          input.organizationId,
        role: {
          in: [
            UserRole.ORG_ADMIN,
            UserRole.EHS_MANAGER,
          ],
        },
      },
      select: {
        id: true,
      },
    });

  for (
    const managementUser
    of managementUsers
  ) {
    recipientIds.add(
      managementUser.id
    );
  }

  return prisma.user.findMany({
    where: {
      organizationId:
        input.organizationId,
      id: {
        in: Array.from(
          recipientIds
        ),
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
}

export async function processAuditSlaNotifications() {
  const now = new Date();

  const reminderWindowEnd =
    new Date(
      now.getTime() +
        REMINDER_WINDOW_HOURS *
          60 *
          60 *
          1000
    );

  const audits =
    await prisma.audit.findMany({
      where: {
        status: {
          notIn: [
            Status.COMPLETED,
            Status.CLOSED,
          ],
        },
        dueDate: {
          not: null,
          lte: reminderWindowEnd,
        },
        site: {
          organizationId: {
            not: "",
          },
        },
      },
      include: {
        site: {
          select: {
            name: true,
            organizationId: true,
          },
        },
        leadAuditor: {
          select: {
            id: true,
          },
        },
        teamMembers: {
          select: {
            userId: true,
          },
        },
      },
      orderBy: {
        dueDate: "asc",
      },
    });

  const findings =
    await prisma.auditFinding.findMany({
      where: {
        status: {
          notIn: [
            Status.COMPLETED,
            Status.CLOSED,
          ],
        },
        dueDate: {
          not: null,
          lte: reminderWindowEnd,
        },
        audit: {
          status: {
            notIn: [
              Status.COMPLETED,
              Status.CLOSED,
            ],
          },
          site: {
            organizationId: {
              not: "",
            },
          },
        },
      },
      include: {
        audit: {
          include: {
            site: {
              select: {
                name: true,
                organizationId: true,
              },
            },
            leadAuditor: {
              select: {
                id: true,
              },
            },
            teamMembers: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
      orderBy: {
        dueDate: "asc",
      },
    });

  let auditRemindersSent = 0;
  let auditOverdueAlertsSent = 0;
  let findingRemindersSent = 0;
  let findingOverdueAlertsSent = 0;
  let inAppNotificationsSent = 0;
  let emailsSent = 0;
  let skipped = 0;

  for (const audit of audits) {
    if (!audit.dueDate) {
      skipped += 1;
      continue;
    }

    const isOverdue =
      audit.dueDate < now;

    if (
      isOverdue &&
      audit.overdueNotifiedAt
    ) {
      skipped += 1;
      continue;
    }

    if (
      !isOverdue &&
      audit.reminderSentAt
    ) {
      skipped += 1;
      continue;
    }

    const recipients =
      await getAuditRecipients({
        organizationId:
          audit.site.organizationId,
        leadAuditorId:
          audit.leadAuditor?.id,
        teamMemberIds:
          audit.teamMembers.map(
            (member) =>
              member.userId
          ),
      });

    if (recipients.length === 0) {
      skipped += 1;
      continue;
    }

    let successfulDeliveries = 0;

    for (const recipient of recipients) {
      try {
        await createNotification({
          organizationId:
            audit.site.organizationId,
          userId: recipient.id,
          type:
            NotificationType.DUE_DATE,
          title: isOverdue
            ? "Audit overdue"
            : "Audit due soon",
          message: isOverdue
            ? `"${audit.title}" is overdue.`
            : `"${audit.title}" is due within 24 hours.`,
          link:
            `/audits/${audit.id}`,
        });

        successfulDeliveries += 1;
        inAppNotificationsSent += 1;
      } catch (error) {
        console.error(
          `Audit in-app SLA notification failed for audit ${audit.id} and user ${recipient.id}:`,
          error
        );
      }

      if (!recipient.email) {
        continue;
      }

      try {
        const result =
          await sendAuditSlaEmail({
            recipientEmail:
              recipient.email,
            recipientName:
              recipient.name,
            auditId:
              audit.id,
            auditTitle:
              audit.title,
            auditReference:
              audit.reference,
            auditType:
              audit.type,
            siteName:
              audit.site.name,
            dueDate:
              audit.dueDate,
            notificationKind:
              isOverdue
                ? "OVERDUE"
                : "REMINDER",
          });

        if (result.success) {
          successfulDeliveries += 1;
          emailsSent += 1;
        }
      } catch (error) {
        console.error(
          `Audit SLA email failed for audit ${audit.id} and user ${recipient.id}:`,
          error
        );
      }
    }

    if (successfulDeliveries === 0) {
      skipped += 1;
      continue;
    }

    if (isOverdue) {
      await prisma.audit.update({
        where: {
          id: audit.id,
        },
        data: {
          status: Status.OVERDUE,
          overdueNotifiedAt: now,
        },
      });

      auditOverdueAlertsSent += 1;
    } else {
      await prisma.audit.update({
        where: {
          id: audit.id,
        },
        data: {
          reminderSentAt: now,
        },
      });

      auditRemindersSent += 1;
    }

    await logActivity({
      organizationId:
        audit.site.organizationId,
      userId: null,
      action:
        ActivityAction.SYSTEM,
      entityType: "Audit",
      entityId: audit.id,
      title: isOverdue
        ? "Audit overdue alert sent"
        : "Audit reminder sent",
      description: isOverdue
        ? `An overdue alert was sent for ${audit.title}.`
        : `A due-date reminder was sent for ${audit.title}.`,
      metadata: {
        auditId: audit.id,
        dueDate:
          audit.dueDate.toISOString(),
        notificationKind:
          isOverdue
            ? "OVERDUE"
            : "REMINDER",
        recipientCount:
          recipients.length,
        processedAt:
          now.toISOString(),
      },
    });
  }

  for (const finding of findings) {
    if (!finding.dueDate) {
      skipped += 1;
      continue;
    }

    const isOverdue =
      finding.dueDate < now;

    const activityTitle =
      isOverdue
        ? getFindingOverdueTitle(
            finding.id
          )
        : getFindingReminderTitle(
            finding.id
          );

    const existingLog =
      await prisma.activityLog.findFirst({
        where: {
          organizationId:
            finding.audit.site
              .organizationId,
          entityType:
            "AuditFinding",
          entityId:
            finding.id,
          title:
            activityTitle,
        },
        select: {
          id: true,
        },
      });

    if (existingLog) {
      skipped += 1;
      continue;
    }

    const recipients =
      await getAuditRecipients({
        organizationId:
          finding.audit.site
            .organizationId,
        leadAuditorId:
          finding.audit
            .leadAuditor?.id,
        teamMemberIds:
          finding.audit.teamMembers.map(
            (member) =>
              member.userId
          ),
      });

    if (recipients.length === 0) {
      skipped += 1;
      continue;
    }

    let successfulDeliveries = 0;

    for (const recipient of recipients) {
      try {
        await createNotification({
          organizationId:
            finding.audit.site
              .organizationId,
          userId: recipient.id,
          type:
            finding.riskLevel ===
              "CRITICAL"
              ? NotificationType.CRITICAL
              : finding.riskLevel ===
                  "HIGH"
                ? NotificationType.WARNING
                : NotificationType.DUE_DATE,
          title: isOverdue
            ? "Audit finding overdue"
            : "Audit finding due soon",
          message: isOverdue
            ? `"${finding.title}" is overdue.`
            : `"${finding.title}" is due within 24 hours.`,
          link:
            `/audits/${finding.audit.id}`,
        });

        successfulDeliveries += 1;
        inAppNotificationsSent += 1;
      } catch (error) {
        console.error(
          `Audit-finding in-app notification failed for finding ${finding.id} and user ${recipient.id}:`,
          error
        );
      }

      if (!recipient.email) {
        continue;
      }

      try {
        const result =
          await sendAuditFindingSlaEmail({
            recipientEmail:
              recipient.email,
            recipientName:
              recipient.name,
            auditId:
              finding.audit.id,
            auditTitle:
              finding.audit.title,
            findingId:
              finding.id,
            findingTitle:
              finding.title,
            findingDescription:
              finding.description,
            riskLevel:
              finding.riskLevel,
            siteName:
              finding.audit.site
                .name,
            dueDate:
              finding.dueDate,
            notificationKind:
              isOverdue
                ? "OVERDUE"
                : "REMINDER",
          });

        if (result.success) {
          successfulDeliveries += 1;
          emailsSent += 1;
        }
      } catch (error) {
        console.error(
          `Audit-finding SLA email failed for finding ${finding.id} and user ${recipient.id}:`,
          error
        );
      }
    }

    if (successfulDeliveries === 0) {
      skipped += 1;
      continue;
    }

    if (isOverdue) {
      await prisma.auditFinding.update({
        where: {
          id: finding.id,
        },
        data: {
          status: Status.OVERDUE,
        },
      });

      findingOverdueAlertsSent += 1;
    } else {
      findingRemindersSent += 1;
    }

    await logActivity({
      organizationId:
        finding.audit.site
          .organizationId,
      userId: null,
      action:
        ActivityAction.SYSTEM,
      entityType:
        "AuditFinding",
      entityId: finding.id,
      title: activityTitle,
      description: isOverdue
        ? `An overdue alert was sent for ${finding.title}.`
        : `A due-date reminder was sent for ${finding.title}.`,
      metadata: {
        auditId:
          finding.audit.id,
        findingId:
          finding.id,
        riskLevel:
          finding.riskLevel,
        dueDate:
          finding.dueDate.toISOString(),
        notificationKind:
          isOverdue
            ? "OVERDUE"
            : "REMINDER",
        recipientCount:
          recipients.length,
        processedAt:
          now.toISOString(),
      },
    });
  }

  return {
    checked:
      audits.length +
      findings.length,
    auditRemindersSent,
    auditOverdueAlertsSent,
    findingRemindersSent,
    findingOverdueAlertsSent,
    inAppNotificationsSent,
    emailsSent,
    skipped,
  };
}