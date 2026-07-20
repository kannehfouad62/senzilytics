import { logActivity } from "@/core/activity-log/activity-log.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { startWorkflowForEntity } from "@/core/workflow/workflow.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  InspectionTeamRole,
  InspectionType,
  NotificationType,
  RiskLevel,
  Status,
  UserRole,
  WorkflowEntityType,
  ConfigurableFormModule,
} from "@prisma/client";
import {
  createPreparedSubmissions,
  type PreparedSubmission,
} from "@/modules/forms/runtime-form.service";
import {
  addTenantInspectionTeamMember,
  createInspectionChecklistSnapshot,
  createTenantInspection,
  createTenantInspectionFinding,
  findTenantInspectionById,
  findTenantInspectionFinding,
  removeTenantInspectionTeamMember,
  updateTenantInspectionFindingStatus,
  updateTenantInspectionStatus,
} from "./inspection.repository";

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

async function notifyInspectionCreated(input: {
  organizationId: string;
  createdById: string;
  inspectionId: string;
  inspectionTitle: string;
  siteName: string;
  leadInspectorId?: string | null;
}) {
  const recipientIds =
    new Set<string>();

  recipientIds.add(
    input.createdById
  );

  if (input.leadInspectorId) {
    recipientIds.add(
      input.leadInspectorId
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

  await Promise.all(
    Array.from(
      recipientIds
    ).map(async (recipientId) => {
      const isCreator =
        recipientId ===
        input.createdById;

      const isLeadInspector =
        recipientId ===
        input.leadInspectorId;

      await createNotificationSafely({
        organizationId:
          input.organizationId,
        userId: recipientId,
        type: isLeadInspector
          ? NotificationType.ASSIGNMENT
          : isCreator
            ? NotificationType.SUCCESS
            : NotificationType.INFO,
        title: isLeadInspector
          ? "Inspection assigned"
          : isCreator
            ? "Inspection created"
            : "New inspection scheduled",
        message: isLeadInspector
          ? `You were assigned as lead inspector for "${input.inspectionTitle}".`
          : `"${input.inspectionTitle}" was created for ${input.siteName}.`,
        link:
          `/inspections/${input.inspectionId}`,
        context:
          "Inspection-created",
      });
    })
  );
}

async function notifyInspectionFindingCreated(input: {
  organizationId: string;
  inspectionId: string;
  inspectionTitle: string;
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
            UserRole.SUPERVISOR,
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
              ? "Critical inspection finding"
              : input.riskLevel ===
                  RiskLevel.HIGH
                ? "High-risk inspection finding"
                : "Inspection finding recorded",
          message:
            `"${input.findingTitle}" was recorded during ` +
            `"${input.inspectionTitle}".`,
          link:
            `/inspections/${input.inspectionId}`,
          context:
            "Inspection-finding",
        });
      }
    )
  );
}

export async function createInspectionService(input: {
  organizationId: string;
  userId: string;
  title: string;
  reference?: string | null;
  description?: string | null;
  area?: string | null;
  type: InspectionType;
  siteId: string;
  scheduledAt?: Date | null;
  dueDate?: Date | null;
  leadInspectorId?: string | null;
  checklistTemplateId?: string | null;
  customSubmissions?: PreparedSubmission[];
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

  let leadInspectorId:
    | string
    | null = null;

  if (input.leadInspectorId) {
    const leadInspector =
      await prisma.user.findFirst({
        where: {
          id: input.leadInspectorId,
          organizationId:
            input.organizationId,
        },
        select: {
          id: true,
        },
      });

    if (!leadInspector) {
      throw new Error(
        "The selected lead inspector was not found in this organization."
      );
    }

    leadInspectorId =
      leadInspector.id;
  }

  let checklistTemplateId:
    | string
    | null = null;

  if (
    input.checklistTemplateId
  ) {
    const checklistTemplate =
      await prisma.inspectionChecklistTemplate.findFirst({
        where: {
          id:
            input.checklistTemplateId,
          organizationId:
            input.organizationId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

    if (!checklistTemplate) {
      throw new Error(
        "The selected inspection checklist template is invalid or inactive."
      );
    }

    checklistTemplateId =
      checklistTemplate.id;
  }

  const inspection =
    await prisma.$transaction(
      async (tx) => {
        const created =
          await createTenantInspection(
            {
              title: input.title,
              reference:
                input.reference,
              description:
                input.description,
              area: input.area,
              type: input.type,
              siteId: site.id,
              scheduledAt:
                input.scheduledAt,
              dueDate: input.dueDate,
              leadInspectorId,
              checklistTemplateId,
            },
            tx
          );

        if (leadInspectorId) {
          await addTenantInspectionTeamMember(
            {
              inspectionId:
                created.id,
              userId:
                leadInspectorId,
              role:
                InspectionTeamRole.LEAD_INSPECTOR,
            },
            tx
          );
        }

        let checklistItemCount = 0;

        if (checklistTemplateId) {
          const snapshot =
            await createInspectionChecklistSnapshot(
              {
                inspectionId:
                  created.id,
                checklistTemplateId,
              },
              tx
            );

          checklistItemCount =
            snapshot.count;
        }

        await createPreparedSubmissions(
          tx,
          {
            organizationId:
              input.organizationId,
            userId: input.userId,
            module:
              ConfigurableFormModule.INSPECTION,
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
              "Inspection",
            entityId: created.id,
            title:
              "Inspection created",
            description:
              created.title,
            metadata: {
              reference:
                created.reference,
              type: created.type,
              siteId: site.id,
              area: created.area,
              scheduledAt:
                created.scheduledAt?.toISOString() ??
                null,
              dueDate:
                created.dueDate?.toISOString() ??
                null,
              leadInspectorId,
              checklistTemplateId,
              checklistItemCount,
              status: created.status,
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
    await notifyInspectionCreated({
      organizationId:
        input.organizationId,
      createdById:
        input.userId,
      inspectionId:
        inspection.id,
      inspectionTitle:
        inspection.title,
      siteName: site.name,
      leadInspectorId,
    });
  } catch (error) {
    console.error(
      `Automatic inspection notifications failed for inspection ${inspection.id}:`,
      error
    );
  }

  try {
    await startWorkflowForEntity({
      organizationId:
        input.organizationId,
      userId: input.userId,
      entityType:
        WorkflowEntityType.INSPECTION,
      entityId:
        inspection.id,
    });
  } catch (error) {
    console.error(
      `Automatic workflow startup failed for inspection ${inspection.id}:`,
      error
    );
  }

  return inspection;
}

export async function updateInspectionStatusService(input: {
  organizationId: string;
  userId: string;
  inspectionId: string;
  status: Status;
}) {
  const inspection =
    await findTenantInspectionById(
      input.inspectionId,
      input.organizationId
    );

  if (!inspection) {
    throw new Error(
      "Invalid inspection for this organization."
    );
  }

  const previousStatus =
    inspection.status;

  if (
    previousStatus === input.status
  ) {
    return inspection;
  }

  const startedAt =
    input.status ===
    Status.IN_PROGRESS
      ? inspection.startedAt ??
        new Date()
      : inspection.startedAt;

  const completedAt =
    input.status ===
        Status.COMPLETED ||
      input.status === Status.CLOSED
      ? inspection.completedAt ??
        new Date()
      : null;

  const updatedInspection =
    await updateTenantInspectionStatus({
      inspectionId:
        inspection.id,
      status: input.status,
      startedAt,
      completedAt,
    });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action:
      ActivityAction.STATUS_CHANGE,
    entityType: "Inspection",
    entityId:
      inspection.id,
    title:
      "Inspection status changed",
    description:
      `${previousStatus} → ${input.status}`,
    metadata: {
      previousStatus,
      newStatus:
        input.status,
      startedAt:
        startedAt?.toISOString() ??
        null,
      completedAt:
        completedAt?.toISOString() ??
        null,
    },
  });

  return updatedInspection;
}

export async function addInspectionTeamMemberService(input: {
  organizationId: string;
  userId: string;
  inspectionId: string;
  teamMemberId: string;
  teamRole: InspectionTeamRole;
}) {
  const [inspection, teamMember] =
    await Promise.all([
      findTenantInspectionById(
        input.inspectionId,
        input.organizationId
      ),

      prisma.user.findFirst({
        where: {
          id: input.teamMemberId,
          organizationId:
            input.organizationId,
        },
        select: {
          id: true,
          name: true,
        },
      }),
    ]);

  if (!inspection) {
    throw new Error(
      "Invalid inspection for this organization."
    );
  }

  if (!teamMember) {
    throw new Error(
      "The selected inspection team member was not found in this organization."
    );
  }

  const membership =
    await addTenantInspectionTeamMember({
      inspectionId:
        inspection.id,
      userId:
        teamMember.id,
      role: input.teamRole,
    });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action:
      ActivityAction.ASSIGN,
    entityType: "Inspection",
    entityId:
      inspection.id,
    title:
      "Inspection team member assigned",
    description:
      `${teamMember.name} was assigned as ` +
      `${input.teamRole.replaceAll("_", " ")}.`,
    metadata: {
      teamMemberId:
        teamMember.id,
      teamRole:
        input.teamRole,
    },
  });

  await createNotificationSafely({
    organizationId:
      input.organizationId,
    userId:
      teamMember.id,
    type:
      NotificationType.ASSIGNMENT,
    title:
      "Inspection team assignment",
    message:
      `You were assigned to "${inspection.title}" as ` +
      `${input.teamRole.replaceAll("_", " ")}.`,
    link:
      `/inspections/${inspection.id}`,
    context:
      "Inspection-team-assignment",
  });

  return membership;
}

export async function removeInspectionTeamMemberService(input: {
  organizationId: string;
  userId: string;
  inspectionId: string;
  teamMemberId: string;
}) {
  const inspection =
    await findTenantInspectionById(
      input.inspectionId,
      input.organizationId
    );

  if (!inspection) {
    throw new Error(
      "Invalid inspection for this organization."
    );
  }

  if (
    inspection.leadInspectorId ===
    input.teamMemberId
  ) {
    throw new Error(
      "The lead inspector cannot be removed from the inspection team."
    );
  }

  await removeTenantInspectionTeamMember({
    inspectionId:
      inspection.id,
    userId:
      input.teamMemberId,
  });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action:
      ActivityAction.DELETE,
    entityType:
      "InspectionTeamMember",
    entityId:
      input.teamMemberId,
    title:
      "Inspection team member removed",
    description:
      "A team member was removed from the inspection.",
    metadata: {
      inspectionId:
        inspection.id,
      teamMemberId:
        input.teamMemberId,
    },
  });
}

export async function createInspectionFindingService(input: {
  organizationId: string;
  userId: string;
  inspectionId: string;
  title: string;
  description?: string | null;
  riskLevel: RiskLevel;
  dueDate?: Date | null;
}) {
  const inspection =
    await findTenantInspectionById(
      input.inspectionId,
      input.organizationId
    );

  if (!inspection) {
    throw new Error(
      "Invalid inspection for this organization."
    );
  }

  if (
    inspection.status ===
      Status.COMPLETED ||
    inspection.status ===
      Status.CLOSED
  ) {
    throw new Error(
      "Findings cannot be added to a completed or closed inspection."
    );
  }

  const finding =
    await createTenantInspectionFinding({
      inspectionId:
        inspection.id,
      title: input.title,
      description:
        input.description,
      riskLevel:
        input.riskLevel,
      dueDate: input.dueDate,
    });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType:
      "InspectionFinding",
    entityId: finding.id,
    title:
      "Inspection finding created",
    description:
      finding.title,
    metadata: {
      inspectionId:
        inspection.id,
      riskLevel:
        finding.riskLevel,
      status:
        finding.status,
      dueDate:
        finding.dueDate?.toISOString() ??
        null,
    },
  });

  try {
    await notifyInspectionFindingCreated({
      organizationId:
        input.organizationId,
      inspectionId:
        inspection.id,
      inspectionTitle:
        inspection.title,
      findingTitle:
        finding.title,
      riskLevel:
        finding.riskLevel,
    });
  } catch (error) {
    console.error(
      `Inspection finding notifications failed for finding ${finding.id}:`,
      error
    );
  }

  return finding;
}

export async function updateInspectionFindingStatusService(input: {
  organizationId: string;
  userId: string;
  inspectionId: string;
  findingId: string;
  status: Status;
}) {
  const finding =
    await findTenantInspectionFinding({
      inspectionId:
        input.inspectionId,
      findingId:
        input.findingId,
      organizationId:
        input.organizationId,
    });

  if (!finding) {
    throw new Error(
      "Invalid inspection finding for this organization."
    );
  }

  const previousStatus =
    finding.status;

  if (
    previousStatus === input.status
  ) {
    return finding;
  }

  const updatedFinding =
    await updateTenantInspectionFindingStatus({
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
    entityType:
      "InspectionFinding",
    entityId:
      input.findingId,
    title:
      "Inspection finding status changed",
    description:
      `${previousStatus} → ${input.status}`,
    metadata: {
      inspectionId:
        input.inspectionId,
      previousStatus,
      newStatus:
        input.status,
    },
  });

  return updatedFinding;
}
