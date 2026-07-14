import { logActivity } from "@/core/activity-log/activity-log.service";
import { sendInvestigationSlaEmail } from "@/core/notifications/investigation-sla-email.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  NotificationType,
  Status,
} from "@prisma/client";

const REMINDER_WINDOW_HOURS = 24;

export async function processInvestigationSlaNotifications() {
  const now = new Date();

  const reminderWindowEnd =
    new Date(
      now.getTime() +
        REMINDER_WINDOW_HOURS *
          60 *
          60 *
          1000
    );

  const investigations =
    await prisma.investigation.findMany({
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
        assignedToId: {
          not: null,
        },
        incident: {
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
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            organizationId: true,
          },
        },
        incident: {
          select: {
            id: true,
            title: true,
            type: true,
            riskLevel: true,
            site: {
              select: {
                name: true,
                organizationId: true,
              },
            },
          },
        },
      },
      orderBy: {
        dueDate: "asc",
      },
    });

  let remindersSent = 0;
  let overdueAlertsSent = 0;
  let inAppNotificationsSent = 0;
  let emailsSent = 0;
  let skipped = 0;

  for (
    const investigation
    of investigations
  ) {
    if (
      !investigation.dueDate ||
      !investigation.assignedTo
    ) {
      skipped += 1;
      continue;
    }

    const organizationId =
      investigation.incident.site
        .organizationId;

    if (
      investigation.assignedTo
        .organizationId !==
      organizationId
    ) {
      console.error(
        `Investigation ${investigation.id} has an assignee outside its organization.`
      );

      skipped += 1;
      continue;
    }

    const isOverdue =
      investigation.dueDate < now;

    if (
      isOverdue &&
      investigation.overdueNotifiedAt
    ) {
      skipped += 1;
      continue;
    }

    if (
      !isOverdue &&
      investigation.reminderSentAt
    ) {
      skipped += 1;
      continue;
    }

    const link =
      `/incidents/${investigation.incident.id}`;

    let notificationCreated = false;
    let emailSent = false;

    try {
      await createNotification({
        organizationId,
        userId:
          investigation.assignedTo.id,
        type: NotificationType.DUE_DATE,
        title: isOverdue
          ? "Investigation overdue"
          : "Investigation due soon",
        message: isOverdue
          ? `The investigation for "${investigation.incident.title}" is overdue.`
          : `The investigation for "${investigation.incident.title}" is due within 24 hours.`,
        link,
      });

      notificationCreated = true;
      inAppNotificationsSent += 1;
    } catch (error) {
      console.error(
        `Investigation in-app notification failed for ${investigation.id}:`,
        error
      );
    }

    if (
      investigation.assignedTo.email
    ) {
      try {
        const result =
          await sendInvestigationSlaEmail({
            recipientEmail:
              investigation.assignedTo
                .email,
            recipientName:
              investigation.assignedTo
                .name,
            investigationId:
              investigation.id,
            incidentId:
              investigation.incident.id,
            incidentTitle:
              investigation.incident
                .title,
            incidentType:
              investigation.incident.type,
            incidentRiskLevel:
              investigation.incident
                .riskLevel,
            siteName:
              investigation.incident.site
                .name,
            dueDate:
              investigation.dueDate,
            notificationKind: isOverdue
              ? "OVERDUE"
              : "REMINDER",
          });

        emailSent = result.success;

        if (emailSent) {
          emailsSent += 1;
        }
      } catch (error) {
        console.error(
          `Investigation SLA email failed for ${investigation.id}:`,
          error
        );
      }
    }

    if (
      !notificationCreated &&
      !emailSent
    ) {
      console.error(
        `Investigation ${investigation.id} had no successful SLA notification delivery.`
      );

      skipped += 1;
      continue;
    }

    if (isOverdue) {
      await prisma.investigation.update({
        where: {
          id: investigation.id,
        },
        data: {
          status: Status.OVERDUE,
          overdueNotifiedAt: now,
        },
      });

      overdueAlertsSent += 1;
    } else {
      await prisma.investigation.update({
        where: {
          id: investigation.id,
        },
        data: {
          reminderSentAt: now,
        },
      });

      remindersSent += 1;
    }

    await logActivity({
      organizationId,
      userId: null,
      action: ActivityAction.SYSTEM,
      entityType: "Investigation",
      entityId: investigation.id,
      title: isOverdue
        ? "Investigation overdue alert sent"
        : "Investigation reminder sent",
      description: isOverdue
        ? `An overdue investigation alert was sent for ${investigation.incident.title}.`
        : `An investigation due-date reminder was sent for ${investigation.incident.title}.`,
      metadata: {
        incidentId:
          investigation.incident.id,
        assignedToId:
          investigation.assignedTo.id,
        dueDate:
          investigation.dueDate.toISOString(),
        notificationKind: isOverdue
          ? "OVERDUE"
          : "REMINDER",
        inAppNotificationCreated:
          notificationCreated,
        emailSent,
        processedAt:
          now.toISOString(),
      },
    });
  }

  return {
    checked: investigations.length,
    remindersSent,
    overdueAlertsSent,
    inAppNotificationsSent,
    emailsSent,
    skipped,
  };
}