import { logActivity } from "@/core/activity-log/activity-log.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { startWorkflowForEntity } from "@/core/workflow/workflow.service";
import { prisma } from "@/lib/prisma";
import { sendCorrectiveActionAssignmentEmail } from "@/core/notifications/notification-email.service";
import {
  ActivityAction,
  AuditResponseResult,
  AuditTeamRole,
  AuditType,
  NotificationType,
  RiskLevel,
  Status,
  UserRole,
  WorkflowEntityType,
} from "@prisma/client";
import {
  addTenantAuditTeamMember,
  createAuditChecklistSnapshot,
  createOrUpdateAuditFindingForResponse,
  createTenantAudit,
  createTenantAuditFinding,
  findTenantAuditById,
  findTenantAuditChecklistItem,
  findTenantAuditFinding,
  removeTenantAuditTeamMember,
  updateTenantAuditFindingStatus,
  updateTenantAuditStatus,
  upsertTenantAuditResponse,
  createCorrectiveActionFromAuditFinding,
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
  leadAuditorId?: string | null;
}) {
  const recipientIds = new Set<string>();

  recipientIds.add(input.createdById);

  if (input.leadAuditorId) {
    recipientIds.add(input.leadAuditorId);
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

  for (const user of managementUsers) {
    recipientIds.add(user.id);
  }

  await Promise.all(
    Array.from(recipientIds).map(
      async (recipientId) => {
        const isCreator =
          recipientId ===
          input.createdById;

        const isLeadAuditor =
          recipientId ===
          input.leadAuditorId;

        await createNotificationSafely({
          organizationId:
            input.organizationId,
          userId: recipientId,
          type: isLeadAuditor
            ? NotificationType.ASSIGNMENT
            : isCreator
              ? NotificationType.SUCCESS
              : NotificationType.INFO,
          title: isLeadAuditor
            ? "Audit assigned"
            : isCreator
              ? "Audit created"
              : "New audit scheduled",
          message: isLeadAuditor
            ? `You were assigned as lead auditor for "${input.auditTitle}".`
            : `"${input.auditTitle}" was created for ${input.siteName}.`,
          link:
            `/audits/${input.auditId}`,
          context:
            "Audit-created",
        });
      }
    )
  );
}

async function notifyAuditTeamMemberAssigned(input: {
  organizationId: string;
  auditId: string;
  auditTitle: string;
  userId: string;
  teamRole: AuditTeamRole;
}) {
  await createNotificationSafely({
    organizationId:
      input.organizationId,
    userId: input.userId,
    type:
      NotificationType.ASSIGNMENT,
    title:
      "Audit team assignment",
    message:
      `You were assigned to "${input.auditTitle}" as ` +
      `${input.teamRole.replaceAll("_", " ")}.`,
    link: `/audits/${input.auditId}`,
    context:
      "Audit-team-assignment",
  });
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
  reference?: string | null;
  scope?: string | null;
  type: AuditType;
  siteId: string;
  scheduledAt?: Date | null;
  dueDate?: Date | null;
  leadAuditorId?: string | null;
  checklistTemplateId?: string | null;
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

  let leadAuditorId:
    | string
    | null = null;

  if (input.leadAuditorId) {
    const leadAuditor =
      await prisma.user.findFirst({
        where: {
          id: input.leadAuditorId,
          organizationId:
            input.organizationId,
        },
        select: {
          id: true,
        },
      });

    if (!leadAuditor) {
      throw new Error(
        "The selected lead auditor was not found in this organization."
      );
    }

    leadAuditorId =
      leadAuditor.id;
  }

  let checklistTemplateId:
    | string
    | null = null;

  if (input.checklistTemplateId) {
    const checklistTemplate =
      await prisma.auditChecklistTemplate.findFirst({
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
        "The selected checklist template is invalid or inactive."
      );
    }

    checklistTemplateId =
      checklistTemplate.id;
  }

  const audit =
    await createTenantAudit({
      title: input.title,
      reference: input.reference,
      scope: input.scope,
      type: input.type,
      siteId: site.id,
      scheduledAt:
        input.scheduledAt,
      dueDate: input.dueDate,
      leadAuditorId,
      checklistTemplateId,
    });

  if (leadAuditorId) {
    await addTenantAuditTeamMember({
      auditId: audit.id,
      userId: leadAuditorId,
      role:
        AuditTeamRole.LEAD_AUDITOR,
    });
  }

  let checklistItemCount = 0;

  if (checklistTemplateId) {
    const snapshotResult =
      await createAuditChecklistSnapshot({
        auditId: audit.id,
        checklistTemplateId,
      });

    checklistItemCount =
      snapshotResult.count;
  }

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
      reference:
        audit.reference,
      type: audit.type,
      siteId: site.id,
      scheduledAt:
        audit.scheduledAt?.toISOString() ??
        null,
      dueDate:
        audit.dueDate?.toISOString() ??
        null,
      leadAuditorId,
      checklistTemplateId,
      checklistItemCount,
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
      leadAuditorId,
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

  const previousStatus =
    audit.status;

  if (
    previousStatus === input.status
  ) {
    return audit;
  }

  const startedAt =
    input.status ===
      Status.IN_PROGRESS
      ? audit.startedAt ??
        new Date()
      : audit.startedAt;

  const completedAt =
    input.status ===
        Status.COMPLETED ||
      input.status === Status.CLOSED
      ? audit.completedAt ??
        new Date()
      : null;

  const updatedAudit =
    await updateTenantAuditStatus({
      auditId: audit.id,
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
    entityType: "Audit",
    entityId: audit.id,
    title:
      "Audit status changed",
    description:
      `${previousStatus} → ${input.status}`,
    metadata: {
      previousStatus,
      newStatus: input.status,
      startedAt:
        startedAt?.toISOString() ??
        null,
      completedAt:
        completedAt?.toISOString() ??
        null,
    },
  });

  return updatedAudit;
}

export async function addAuditTeamMemberService(input: {
  organizationId: string;
  userId: string;
  auditId: string;
  teamMemberId: string;
  teamRole: AuditTeamRole;
}) {
  const [audit, teamMember] =
    await Promise.all([
      findTenantAuditById(
        input.auditId,
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

  if (!audit) {
    throw new Error(
      "Invalid audit for this organization."
    );
  }

  if (!teamMember) {
    throw new Error(
      "The selected audit team member was not found in this organization."
    );
  }

  const membership =
    await addTenantAuditTeamMember({
      auditId: audit.id,
      userId: teamMember.id,
      role: input.teamRole,
    });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action: ActivityAction.ASSIGN,
    entityType: "Audit",
    entityId: audit.id,
    title:
      "Audit team member assigned",
    description:
      `${teamMember.name} was assigned as ${input.teamRole.replaceAll(
        "_",
        " "
      )}.`,
    metadata: {
      teamMemberId:
        teamMember.id,
      teamRole: input.teamRole,
    },
  });

  await notifyAuditTeamMemberAssigned({
    organizationId:
      input.organizationId,
    auditId: audit.id,
    auditTitle: audit.title,
    userId: teamMember.id,
    teamRole: input.teamRole,
  });

  return membership;
}

export async function removeAuditTeamMemberService(input: {
  organizationId: string;
  userId: string;
  auditId: string;
  teamMemberId: string;
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
    audit.leadAuditorId ===
    input.teamMemberId
  ) {
    throw new Error(
      "The lead auditor cannot be removed from the audit team."
    );
  }

  await removeTenantAuditTeamMember({
    auditId: audit.id,
    userId: input.teamMemberId,
  });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action: ActivityAction.DELETE,
    entityType:
      "AuditTeamMember",
    entityId:
      input.teamMemberId,
    title:
      "Audit team member removed",
    description:
      "A team member was removed from the audit.",
    metadata: {
      auditId: audit.id,
      teamMemberId:
        input.teamMemberId,
    },
  });
}

export async function saveAuditResponseService(input: {
  organizationId: string;
  userId: string;
  auditId: string;
  checklistItemId: string;
  result: AuditResponseResult;
  responseText?: string | null;
  numericValue?: number | null;
  booleanValue?: boolean | null;
  score?: number | null;
  comments?: string | null;
  createFinding: boolean;
  findingTitle?: string | null;
  findingDescription?: string | null;
  findingRiskLevel?: RiskLevel | null;
  findingDueDate?: Date | null;
}) {
  const checklistItem =
    await findTenantAuditChecklistItem({
      auditId: input.auditId,
      checklistItemId:
        input.checklistItemId,
      organizationId:
        input.organizationId,
    });

  if (!checklistItem) {
    throw new Error(
      "Invalid audit checklist item for this organization."
    );
  }

  if (
    checklistItem.audit.status ===
      Status.COMPLETED ||
    checklistItem.audit.status ===
      Status.CLOSED
  ) {
    throw new Error(
      "Responses cannot be changed after an audit is completed or closed."
    );
  }

  const response =
    await upsertTenantAuditResponse({
      auditId: input.auditId,
      checklistItemId:
        input.checklistItemId,
      answeredById: input.userId,
      result: input.result,
      responseText:
        input.responseText,
      numericValue:
        input.numericValue,
      booleanValue:
        input.booleanValue,
      score: input.score,
      comments: input.comments,
    });

  if (
    checklistItem.audit.status ===
    Status.OPEN
  ) {
    await updateTenantAuditStatus({
      auditId: input.auditId,
      status: Status.IN_PROGRESS,
      startedAt:
        checklistItem.audit
          .startedAt ?? new Date(),
      completedAt: null,
    });
  }

  let findingId:
    | string
    | null = null;

  if (
    input.result ===
      AuditResponseResult.NON_COMPLIANT &&
    input.createFinding
  ) {
    const findingTitle =
      input.findingTitle?.trim() ||
      `Noncompliance: ${checklistItem.questionText}`;

    const finding =
      await createOrUpdateAuditFindingForResponse({
        auditId: input.auditId,
        responseId: response.id,
        title: findingTitle,
        description:
          input.findingDescription ||
          input.comments ||
          `Noncompliance identified for checklist question: ${checklistItem.questionText}`,
        riskLevel:
          input.findingRiskLevel ??
          RiskLevel.MEDIUM,
        dueDate:
          input.findingDueDate,
      });

    findingId = finding.id;

    try {
      await notifyAuditFindingCreated({
        organizationId:
          input.organizationId,
        auditId: input.auditId,
        auditTitle:
          checklistItem.audit.title,
        findingTitle:
          finding.title,
        riskLevel:
          finding.riskLevel,
      });
    } catch (error) {
      console.error(
        `Audit finding notification failed for ${finding.id}:`,
        error
      );
    }
  }

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action: ActivityAction.UPDATE,
    entityType: "AuditResponse",
    entityId: response.id,
    title:
      "Audit checklist response saved",
    description:
      checklistItem.questionText,
    metadata: {
      auditId: input.auditId,
      checklistItemId:
        checklistItem.id,
      result: response.result,
      score:
        response.score?.toString() ??
        null,
      findingId,
      answeredAt:
        response.answeredAt?.toISOString() ??
        null,
    },
  });

  return response;
}

export async function createAuditFindingService(input: {
  organizationId: string;
  userId: string;
  auditId: string;
  title: string;
  description?: string | null;
  riskLevel: RiskLevel;
  dueDate?: Date | null;
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
      dueDate:
        finding.dueDate?.toISOString() ??
        null,
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

  if (
    previousStatus === input.status
  ) {
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

export async function convertAuditFindingToCorrectiveActionService(input: {
  organizationId: string;
  userId: string;
  auditId: string;
  findingId: string;
  title: string;
  description?: string | null;
  riskLevel: RiskLevel;
  assignedToId: string;
  dueDate: Date;
}) {
  const [finding, assignedUser] =
    await Promise.all([
      findTenantAuditFinding({
        findingId: input.findingId,
        auditId: input.auditId,
        organizationId:
          input.organizationId,
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
    ]);

  if (!finding) {
    throw new Error(
      "Invalid audit finding for this organization."
    );
  }

  if (!assignedUser) {
    throw new Error(
      "The selected corrective-action assignee was not found in this organization."
    );
  }

  if (finding.correctiveAction) {
    throw new Error(
      "This audit finding already has a corrective action."
    );
  }

  if (
    finding.status === Status.CLOSED ||
    finding.status === Status.COMPLETED
  ) {
    throw new Error(
      "A corrective action cannot be created from a closed or completed finding."
    );
  }

  const action =
    await createCorrectiveActionFromAuditFinding({
      auditFindingId:
        finding.id,
      title: input.title,
      description:
        input.description,
      riskLevel:
        input.riskLevel,
      assignedToId:
        assignedUser.id,
      dueDate: input.dueDate,
    });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType:
      "CorrectiveAction",
    entityId: action.id,
    title:
      "Corrective action created from audit finding",
    description: action.title,
    metadata: {
      auditId:
        finding.audit.id,
      auditFindingId:
        finding.id,
      assignedToId:
        assignedUser.id,
      riskLevel:
        action.riskLevel,
      dueDate:
        action.dueDate.toISOString(),
      status: action.status,
    },
  });

  await createNotificationSafely({
    organizationId:
      input.organizationId,
    userId: assignedUser.id,
    type:
      NotificationType.ASSIGNMENT,
    title:
      "Audit corrective action assigned",
    message:
      `You were assigned a corrective action from audit ` +
      `"${finding.audit.title}": ${action.title}`,
    link:
      `/audits/${finding.audit.id}`,
    context:
      "Audit-corrective-action",
  });

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
          `Audit: ${finding.audit.title}`,
        dueDate:
          action.dueDate,
        riskLevel:
          action.riskLevel,
        assignedByName:
          (
            await prisma.user.findFirst({
              where: {
                id: input.userId,
                organizationId:
                  input.organizationId,
              },
              select: {
                name: true,
              },
            })
          )?.name || "System",
      });
    } catch (error) {
      console.error(
        `Audit corrective-action assignment email failed for action ${action.id}:`,
        error
      );
    }
  }

  return action;
}