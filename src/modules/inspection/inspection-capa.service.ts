import { logActivity } from "@/core/activity-log/activity-log.service";
import { sendCorrectiveActionAssignmentEmail } from "@/core/notifications/notification-email.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  NotificationType,
  RiskLevel,
  Status,
} from "@prisma/client";

export async function convertInspectionFindingToCorrectiveActionService(input: {
  organizationId: string;
  userId: string;
  inspectionId: string;
  findingId: string;
  title: string;
  description?: string | null;
  riskLevel: RiskLevel;
  assignedToId: string;
  dueDate: Date;
}) {
  const [finding, assignedUser, createdByUser] =
    await Promise.all([
      prisma.inspectionFinding.findFirst({
        where: {
          id: input.findingId,
          inspection: {
            id: input.inspectionId,
            site: {
              organizationId:
                input.organizationId,
            },
          },
        },
        include: {
          inspection: {
            include: {
              site: {
                select: {
                  id: true,
                  name: true,
                  organizationId: true,
                },
              },
            },
          },
          correctiveAction: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      }),

      prisma.user.findFirst({
        where: {
          id: input.assignedToId,
          organizationId:
            input.organizationId,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      }),

      prisma.user.findFirst({
        where: {
          id: input.userId,
          organizationId:
            input.organizationId,
        },
        select: {
          id: true,
          name: true,
        },
      }),
    ]);

  if (!finding) {
    throw new Error(
      "Invalid inspection finding for this organization."
    );
  }

  if (!assignedUser) {
    throw new Error(
      "The selected corrective-action assignee was not found in this organization."
    );
  }

  if (!createdByUser) {
    throw new Error(
      "The current user was not found in this organization."
    );
  }

  if (finding.correctiveAction) {
    throw new Error(
      "This inspection finding already has a corrective action."
    );
  }

  if (
    finding.status === Status.COMPLETED ||
    finding.status === Status.CLOSED
  ) {
    throw new Error(
      "A corrective action cannot be created from a completed or closed inspection finding."
    );
  }

  if (input.dueDate <= new Date()) {
    throw new Error(
      "The corrective-action due date must be in the future."
    );
  }

  const correctiveAction =
    await prisma.correctiveAction.create({
      data: {
        inspectionFindingId:
          finding.id,
        title: input.title,
        description:
          input.description,
        status: Status.OPEN,
        riskLevel:
          input.riskLevel,
        assignedToId:
          assignedUser.id,
        dueDate: input.dueDate,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        inspectionFinding: {
          include: {
            inspection: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType:
      "CorrectiveAction",
    entityId:
      correctiveAction.id,
    title:
      "Corrective action created from inspection finding",
    description:
      correctiveAction.title,
    metadata: {
      inspectionId:
        finding.inspection.id,
      inspectionFindingId:
        finding.id,
      assignedToId:
        assignedUser.id,
      riskLevel:
        correctiveAction.riskLevel,
      dueDate:
        correctiveAction.dueDate.toISOString(),
      status:
        correctiveAction.status,
    },
  });

  try {
    await createNotification({
      organizationId:
        input.organizationId,
      userId:
        assignedUser.id,
      type:
        NotificationType.ASSIGNMENT,
      title:
        "Inspection corrective action assigned",
      message:
        `You were assigned a corrective action from inspection ` +
        `"${finding.inspection.title}": ${correctiveAction.title}`,
      link:
        `/inspections/${finding.inspection.id}`,
    });
  } catch (error) {
    console.error(
      `Inspection corrective-action notification failed for action ${correctiveAction.id}:`,
      error
    );
  }

  if (assignedUser.email) {
    try {
      await sendCorrectiveActionAssignmentEmail({
        recipientEmail:
          assignedUser.email,
        recipientName:
          assignedUser.name,
        actionId:
          correctiveAction.id,
        actionTitle:
          correctiveAction.title,
        actionDescription:
          correctiveAction.description,
        incidentId: null,
        incidentTitle:
          `Inspection: ${finding.inspection.title}`,
        dueDate:
          correctiveAction.dueDate,
        riskLevel:
          correctiveAction.riskLevel,
        assignedByName:
          createdByUser.name,
      });
    } catch (error) {
      console.error(
        `Inspection corrective-action assignment email failed for action ${correctiveAction.id}:`,
        error
      );
    }
  }

  return correctiveAction;
}