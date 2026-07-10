import { prisma } from "@/lib/prisma";
import { createNotification } from "@/core/notifications/notifications.service";
import {
  NotificationType,
  UserRole,
  WorkflowEntityType,
  WorkflowStepStatus,
} from "@prisma/client";

const REMINDER_WINDOW_HOURS = 4;

function getEntityLink(
  entityType: WorkflowEntityType,
  entityId: string
): string {
  switch (entityType) {
    case WorkflowEntityType.INCIDENT:
      return `/incidents/${entityId}`;

    case WorkflowEntityType.CORRECTIVE_ACTION:
      return "/actions";

    case WorkflowEntityType.AUDIT:
      return "/audits";

    case WorkflowEntityType.INSPECTION:
      return "/inspections";

    case WorkflowEntityType.COMPLIANCE:
      return "/compliance";

    case WorkflowEntityType.TRAINING:
      return "/training";

    default:
      return "/tasks";
  }
}

async function resolveStepRecipients(input: {
  organizationId: string;
  assignedUserId: string | null;
  assignedRole: UserRole | null;
}) {
  if (input.assignedUserId) {
    return [input.assignedUserId];
  }

  if (!input.assignedRole) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: {
      organizationId: input.organizationId,
      role: input.assignedRole,
    },
    select: {
      id: true,
    },
  });

  return users.map((user) => user.id);
}

export async function processWorkflowSlaNotifications() {
  const now = new Date();

  const reminderThreshold = new Date(
    now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000
  );

  const activeSteps = await prisma.workflowInstanceStep.findMany({
    where: {
      status: WorkflowStepStatus.IN_PROGRESS,
      dueAt: {
        not: null,
      },
      instance: {
        status: "ACTIVE",
      },
    },
    include: {
      instance: true,
    },
  });

  let remindersCreated = 0;
  let escalationsCreated = 0;

  for (const step of activeSteps) {
    if (!step.dueAt) {
      continue;
    }

    const recipients = await resolveStepRecipients({
      organizationId: step.instance.organizationId,
      assignedUserId: step.assignedUserId,
      assignedRole: step.assignedRole,
    });

    if (recipients.length === 0) {
      continue;
    }

    const link = getEntityLink(
      step.instance.entityType,
      step.instance.entityId
    );

    const isOverdue = step.dueAt < now;

    const isApproachingDueDate =
      step.dueAt >= now && step.dueAt <= reminderThreshold;

    if (isOverdue && !step.escalationSentAt) {
      await Promise.all(
        recipients.map((userId) =>
          createNotification({
            organizationId: step.instance.organizationId,
            userId,
            type: NotificationType.CRITICAL,
            title: "Workflow task overdue",
            message: `"${step.name}" is overdue and requires immediate attention.`,
            link,
          })
        )
      );

      await prisma.workflowInstanceStep.update({
        where: {
          id: step.id,
        },
        data: {
          escalationSentAt: now,
        },
      });

      escalationsCreated += recipients.length;
      continue;
    }

    if (
      isApproachingDueDate &&
      !step.reminderSentAt &&
      !step.escalationSentAt
    ) {
      await Promise.all(
        recipients.map((userId) =>
          createNotification({
            organizationId: step.instance.organizationId,
            userId,
            type: NotificationType.DUE_DATE,
            title: "Workflow task due soon",
            message: `"${step.name}" is due within ${REMINDER_WINDOW_HOURS} hours.`,
            link,
          })
        )
      );

      await prisma.workflowInstanceStep.update({
        where: {
          id: step.id,
        },
        data: {
          reminderSentAt: now,
        },
      });

      remindersCreated += recipients.length;
    }
  }

  return {
    processedSteps: activeSteps.length,
    remindersCreated,
    escalationsCreated,
  };
}