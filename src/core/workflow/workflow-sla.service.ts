import { sendWorkflowSlaEmail } from "@/core/notifications/notification-email.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import {
  NotificationType,
  WorkflowInstanceStatus,
  UserRole,
  WorkflowStepStatus,
} from "@prisma/client";

const REMINDER_WINDOW_HOURS = 24;

function getEntityLink(
  entityType: string,
  entityId: string
) {
  switch (entityType) {
    case "INCIDENT":
      return `/incidents/${entityId}`;

    case "CORRECTIVE_ACTION":
      return "/actions";

    case "AUDIT":
      return `/audits/${entityId}`;

    case "INSPECTION":
      return `/inspections/${entityId}`;

    case "COMPLIANCE":
      return "/compliance";

    case "TRAINING":
      return "/training";

    default:
      return "/tasks";
  }
}

async function getStepRecipients(input: {
  organizationId: string;
  assignedUserId?: string | null;
  assignedRole?: string | null;
}) {
  if (input.assignedUserId) {
    const user = await prisma.user.findFirst({
      where: {
        id: input.assignedUserId,
        organizationId: input.organizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return user ? [user] : [];
  }

  if (!input.assignedRole) {
    return [];
  }

  return prisma.user.findMany({
    where: {
      organizationId: input.organizationId,
      role: input.assignedRole as never,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
}

export async function processWorkflowSlaNotifications() {
  const now = new Date();

  const reminderWindowEnd = new Date(
    now.getTime() +
      REMINDER_WINDOW_HOURS * 60 * 60 * 1000
  );

  const steps = await prisma.workflowInstanceStep.findMany({
    where: {
      status: WorkflowStepStatus.IN_PROGRESS,
      dueAt: {
        not: null,
        lte: reminderWindowEnd,
      },
      instance: {
        status: WorkflowInstanceStatus.ACTIVE,
      },
    },
    include: {
      instance: {
        include: {
          template: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      dueAt: "asc",
    },
  });

  let remindersSent = 0;
  let overdueAlertsSent = 0;
  let skipped = 0;

  for (const step of steps) {
    if (!step.dueAt) {
      skipped += 1;
      continue;
    }

    const isOverdue = step.dueAt < now;

    if (isOverdue && step.overdueNotifiedAt) {
      skipped += 1;
      continue;
    }

    if (!isOverdue && step.reminderSentAt) {
      skipped += 1;
      continue;
    }

    const recipients = await getStepRecipients({
      organizationId: step.instance.organizationId,
      assignedUserId: step.assignedUserId,
      assignedRole: step.assignedRole,
    });

    if (recipients.length === 0) {
      skipped += 1;
      continue;
    }

    const link = getEntityLink(
      step.instance.entityType,
      step.instance.entityId
    );

    await Promise.all(
      recipients.map(async (recipient) => {
        await createNotification({
          organizationId: step.instance.organizationId,
          userId: recipient.id,
          type: NotificationType.DUE_DATE,
          title: isOverdue
            ? "Workflow step overdue"
            : "Workflow step due soon",
          message: isOverdue
            ? `${step.name} is overdue.`
            : `${step.name} is due within 24 hours.`,
          link,
        });

        if (!recipient.email) {
          return;
        }

        try {
          await sendWorkflowSlaEmail({
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            entityType: step.instance.entityType,
            entityId: step.instance.entityId,
            workflowName:
              step.instance.template.name,
            stepName: step.name,
            dueAt: step.dueAt!,
            notificationKind: isOverdue
              ? "OVERDUE"
              : "REMINDER",
          });
        } catch (error) {
          console.error(
            `Workflow SLA email failed for user ${recipient.id}:`,
            error
          );
        }
      })
    );

    if (isOverdue) {
      await prisma.workflowInstanceStep.update({
        where: {
          id: step.id,
        },
        data: {
          overdueNotifiedAt: now,
        },
      });

      overdueAlertsSent += 1;
    } else {
      await prisma.workflowInstanceStep.update({
        where: {
          id: step.id,
        },
        data: {
          reminderSentAt: now,
        },
      });

      remindersSent += 1;
    }
  }

  return {
    checked: steps.length,
    remindersSent,
    overdueAlertsSent,
    skipped,
  };
}