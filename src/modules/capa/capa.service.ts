import {
  sendCorrectiveActionAssignmentEmail,
  sendCorrectiveActionStatusEmail,
} from "@/core/notifications/notification-email.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import {
  createPreparedSubmissions,
  type PreparedSubmission,
} from "@/modules/forms/runtime-form.service";
import {
  ActivityAction,
  ConfigurableFormModule,
  NotificationType,
  RiskLevel,
  Status,
} from "@prisma/client";

const capaInclude = {
  assignedTo: true,
  incident: {
    include: {
      site: true,
    },
  },
  auditFinding: {
    include: {
      audit: {
        include: {
          site: true,
        },
      },
    },
  },
  inspectionFinding: {
    include: {
      inspection: {
        include: {
          site: true,
        },
      },
    },
  },
  enterpriseAuditFindingLinks: {
    include: {
      finding: {
        include: {
          audit: {
            include: {
              site: true,
            },
          },
        },
      },
    },
  },
  criticalControlVerifications: {
    include: { control: true },
  },
  certificationReviewActions: {
    include: { review: { include: { program: true } } },
  },
  assetDefects: {
    include: { asset: { include: { site: true } } },
  },
  behaviorSessions: {
    include: { program: true, site: true },
  },
} as const;

export async function findTenantCapas(
  organizationId: string
) {
  return prisma.correctiveAction.findMany({
    where: {
      assignedTo: {
        organizationId,
      },
    },
    include: capaInclude,
    orderBy: [
      {
        dueDate: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
  });
}

export async function findTenantCapaById(
  organizationId: string,
  actionId: string
) {
  return prisma.correctiveAction.findFirst({
    where: {
      id: actionId,
      assignedTo: {
        organizationId,
      },
    },
    include: capaInclude,
  });
}

export async function createStandaloneCapaService(
  input: {
    organizationId: string;
    userId: string;
    title: string;
    description?: string | null;
    riskLevel: RiskLevel;
    dueDate: Date;
    assignedToId: string;
    customSubmissions?: PreparedSubmission[];
  }
) {
  const [assignedUser, creator] =
    await Promise.all([
      prisma.user.findFirst({
        where: {
          id: input.assignedToId,
          organizationId:
            input.organizationId,
        },
      }),
      prisma.user.findFirst({
        where: {
          id: input.userId,
          organizationId:
            input.organizationId,
        },
      }),
    ]);

  if (!assignedUser || !creator) {
    throw new Error(
      "The corrective-action owner or creator is invalid."
    );
  }

  if (input.dueDate <= new Date()) {
    throw new Error(
      "Corrective-action due date must be in the future."
    );
  }

  const action =
    await prisma.$transaction(
      async (tx) => {
        const created =
          await tx.correctiveAction.create({
            data: {
              title: input.title,
              description:
                input.description,
              riskLevel:
                input.riskLevel,
              status: Status.OPEN,
              dueDate:
                input.dueDate,
              assignedToId:
                assignedUser.id,
            },
          });

        await createPreparedSubmissions(
          tx,
          {
            organizationId:
              input.organizationId,
            userId: input.userId,
            module:
              ConfigurableFormModule.CAPA,
            entityId: created.id,
            submissions:
              input.customSubmissions ??
              [],
          }
        );

        await tx.activityLog.create({
          data: {
            organizationId:
              input.organizationId,
            userId: input.userId,
            action:
              ActivityAction.CREATE,
            entityType:
              "CorrectiveAction",
            entityId: created.id,
            title:
              "Standalone corrective action created",
            description:
              created.title,
            metadata: {
              riskLevel:
                created.riskLevel,
              status:
                created.status,
              assignedToId:
                created.assignedToId,
              dueDate:
                created.dueDate.toISOString(),
              customFormCount:
                input.customSubmissions
                  ?.length ?? 0,
            },
          },
        });

        return created;
      }
    );

  try {
    await createNotification({
      organizationId:
        input.organizationId,
      userId: assignedUser.id,
      type:
        NotificationType.ASSIGNMENT,
      title:
        "Corrective action assigned",
      message:
        `You were assigned: ${action.title}`,
      link: `/actions/${action.id}`,
    });
  } catch (error) {
    console.error(
      `CAPA assignment notification failed for ${action.id}:`,
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
        actionId: action.id,
        actionTitle:
          action.title,
        actionDescription:
          action.description,
        incidentId: null,
        incidentTitle:
          "Standalone corrective action",
        dueDate: action.dueDate,
        riskLevel:
          action.riskLevel,
        assignedByName:
          creator.name,
      });
    } catch (error) {
      console.error(
        `CAPA assignment email failed for ${action.id}:`,
        error
      );
    }
  }

  return action;
}

export async function updateCapaStatusService(
  input: {
    organizationId: string;
    userId: string;
    actionId: string;
    status: Status;
  }
) {
  const [action, updater] =
    await Promise.all([
      findTenantCapaById(
        input.organizationId,
        input.actionId
      ),
      prisma.user.findFirst({
        where: {
          id: input.userId,
          organizationId:
            input.organizationId,
        },
      }),
    ]);

  if (!action || !updater) {
    throw new Error(
      "Corrective action not found in this organization."
    );
  }

  if (action.status === input.status) {
    return action;
  }

  const previousStatus =
    action.status;

  const updated =
    await prisma.$transaction(
      async (tx) => {
        const record =
          await tx.correctiveAction.update({
            where: {
              id: action.id,
            },
            data: {
              status: input.status,
            },
          });

        await tx.activityLog.create({
          data: {
            organizationId:
              input.organizationId,
            userId: input.userId,
            action:
              ActivityAction.STATUS_CHANGE,
            entityType:
              "CorrectiveAction",
            entityId: action.id,
            title:
              "Corrective action status changed",
            description:
              `${previousStatus} → ${input.status}`,
            metadata: {
              previousStatus,
              newStatus:
                input.status,
            },
          },
        });

        return record;
      }
    );

  try {
    await createNotification({
      organizationId:
        input.organizationId,
      userId:
        action.assignedTo.id,
      type:
        input.status ===
          Status.COMPLETED ||
        input.status === Status.CLOSED
          ? NotificationType.SUCCESS
          : NotificationType.INFO,
      title:
        "Corrective action updated",
      message:
        `${action.title} is now ${input.status.replaceAll("_", " ")}.`,
      link: `/actions/${action.id}`,
    });
  } catch (error) {
    console.error(
      `CAPA status notification failed for ${action.id}:`,
      error
    );
  }

  if (action.assignedTo.email) {
    try {
      await sendCorrectiveActionStatusEmail({
        recipientEmail:
          action.assignedTo.email,
        recipientName:
          action.assignedTo.name,
        actionId: action.id,
        actionTitle:
          action.title,
        incidentId:
          action.incidentId,
        previousStatus,
        newStatus:
          input.status,
        updatedByName:
          updater.name,
      });
    } catch (error) {
      console.error(
        `CAPA status email failed for ${action.id}:`,
        error
      );
    }
  }

  return updated;
}

export async function completeCapaFormsService(
  input: {
    organizationId: string;
    userId: string;
    actionId: string;
    submissions: PreparedSubmission[];
  }
) {
  const action =
    await findTenantCapaById(
      input.organizationId,
      input.actionId
    );

  if (!action) {
    throw new Error(
      "Corrective action not found in this organization."
    );
  }

  const existing =
    await prisma.configurableFormSubmission.findMany(
      {
        where: {
          organizationId:
            input.organizationId,
          entityType:
            ConfigurableFormModule.CAPA,
          entityId: action.id,
        },
        select: {
          definitionId: true,
        },
      }
    );

  const completedDefinitions =
    new Set(
      existing.map(
        (submission) =>
          submission.definitionId
      )
    );

  const missing =
    input.submissions.filter(
      (submission) =>
        !completedDefinitions.has(
          submission.definitionId
        )
    );

  if (missing.length === 0) {
    throw new Error(
      "All published CAPA forms have already been captured."
    );
  }

  await prisma.$transaction(
    async (tx) => {
      await createPreparedSubmissions(
        tx,
        {
          organizationId:
            input.organizationId,
          userId: input.userId,
          module:
            ConfigurableFormModule.CAPA,
          entityId: action.id,
          submissions: missing,
        }
      );

      await tx.activityLog.create({
        data: {
          organizationId:
            input.organizationId,
          userId: input.userId,
          action:
            ActivityAction.UPDATE,
          entityType:
            "CorrectiveAction",
          entityId: action.id,
          title:
            "Corrective-action forms captured",
          description:
            `${missing.length} tenant form${missing.length === 1 ? "" : "s"} completed.`,
          metadata: {
            formCount:
              missing.length,
          },
        },
      });
    }
  );
}
