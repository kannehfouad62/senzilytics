import { sendCorrectiveActionSlaEmail } from "@/core/notifications/notification-email.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import {
  NotificationType,
  Status,
} from "@prisma/client";

const REMINDER_WINDOW_DAYS = 7;

export async function processCorrectiveActionSlaNotifications() {
  const now = new Date();

  const reminderWindowEnd = new Date(
    now.getTime() +
      REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );

  const actions = await prisma.correctiveAction.findMany({
    where: {
      status: {
        notIn: [
          Status.COMPLETED,
          Status.CLOSED,
        ],
      },
      dueDate: {
        lte: reminderWindowEnd,
      },
      incident: {
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
        },
      },
      incident: {
        select: {
          id: true,
          title: true,
          site: {
            select: {
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
  let skipped = 0;

  for (const action of actions) {
    const incident = action.incident;

    if (!incident?.site.organizationId) {
      skipped += 1;
      continue;
    }

    const assignee = action.assignedTo;

    if (!assignee) {
      skipped += 1;
      continue;
    }

    const isOverdue = action.dueDate < now;

    if (isOverdue && action.overdueNotifiedAt) {
      skipped += 1;
      continue;
    }

    if (!isOverdue && action.reminderSentAt) {
      skipped += 1;
      continue;
    }

    const link = `/incidents/${incident.id}`;

    try {
      await createNotification({
        organizationId:
          incident.site.organizationId,
        userId: assignee.id,
        type: NotificationType.DUE_DATE,
        title: isOverdue
          ? "Corrective action overdue"
          : "Corrective action due soon",
        message: isOverdue
          ? `${action.title} is overdue.`
          : `${action.title} is due within seven days.`,
        link,
      });
    } catch (error) {
      console.error(
        `Corrective-action in-app notification failed for ${action.id}:`,
        error
      );
    }

    if (assignee.email) {
      try {
        await sendCorrectiveActionSlaEmail({
          recipientEmail: assignee.email,
          recipientName: assignee.name,
          actionTitle: action.title,
          actionDescription: action.description,
          incidentId: incident.id,
          incidentTitle: incident.title,
          dueDate: action.dueDate,
          riskLevel: action.riskLevel,
          notificationKind: isOverdue
            ? "OVERDUE"
            : "REMINDER",
        });
      } catch (error) {
        console.error(
          `Corrective-action SLA email failed for ${action.id}:`,
          error
        );
      }
    }

    if (isOverdue) {
      await prisma.correctiveAction.update({
        where: {
          id: action.id,
        },
        data: {
          overdueNotifiedAt: now,
        },
      });

      overdueAlertsSent += 1;
    } else {
      await prisma.correctiveAction.update({
        where: {
          id: action.id,
        },
        data: {
          reminderSentAt: now,
        },
      });

      remindersSent += 1;
    }
  }

  return {
    checked: actions.length,
    remindersSent,
    overdueAlertsSent,
    skipped,
  };
}