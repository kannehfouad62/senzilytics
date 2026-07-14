import { logActivity } from "@/core/activity-log/activity-log.service";
import {
  sendHighRiskIncidentAlertEmail,
  sendIncidentReporterConfirmationEmail,
} from "@/core/notifications/notification-email.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { startWorkflowForEntity } from "@/core/workflow/workflow.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  IncidentType,
  NotificationType,
  RiskLevel,
  Status,
  UserRole,
  WorkflowEntityType,
} from "@prisma/client";
import {
  createTenantCorrectiveAction,
  createTenantIncident,
  findTenantCorrectiveAction,
  findTenantIncidentById,
  updateTenantCorrectiveActionStatus,
  updateTenantIncidentStatus,
  upsertTenantInvestigation,
} from "./incident.repository";

type IncidentNotificationRecipient = {
  id: string;
  name: string;
  email: string;
};

function isEscalationRiskLevel(
  riskLevel: RiskLevel
) {
  return (
    riskLevel === RiskLevel.HIGH ||
    riskLevel === RiskLevel.CRITICAL
  );
}

function getIncidentNotificationType(
  riskLevel: RiskLevel
) {
  if (riskLevel === RiskLevel.CRITICAL) {
    return NotificationType.CRITICAL;
  }

  if (riskLevel === RiskLevel.HIGH) {
    return NotificationType.WARNING;
  }

  return NotificationType.INFO;
}

function getIncidentNotificationTitle(
  riskLevel: RiskLevel
) {
  if (riskLevel === RiskLevel.CRITICAL) {
    return "Critical incident reported";
  }

  if (riskLevel === RiskLevel.HIGH) {
    return "High-risk incident reported";
  }

  return "New incident reported";
}

function getIncidentNotificationMessage(input: {
  incidentTitle: string;
  siteName: string;
  riskLevel: RiskLevel;
}) {
  if (input.riskLevel === RiskLevel.CRITICAL) {
    return `A critical incident, "${input.incidentTitle}", was reported at ${input.siteName}. Immediate review is required.`;
  }

  if (input.riskLevel === RiskLevel.HIGH) {
    return `A high-risk incident, "${input.incidentTitle}", was reported at ${input.siteName}. Prompt review is required.`;
  }

  return `A new incident, "${input.incidentTitle}", was reported at ${input.siteName}.`;
}

async function createIncidentNotificationSafely(input: {
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
      organizationId: input.organizationId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
    });

    return true;
  } catch (error) {
    console.error(
      `${input.context} in-app notification failed for user ${input.userId}:`,
      error
    );

    return false;
  }
}

async function notifyIncidentCreated(input: {
  organizationId: string;
  reporterId: string;
  incident: {
    id: string;
    title: string;
    description: string;
    type: IncidentType;
    riskLevel: RiskLevel;
    status: Status;
    location: string | null;
    occurredAt: Date;
  };
  site: {
    id: string;
    name: string;
  };
}) {
  const incidentLink = `/incidents/${input.incident.id}`;

  const [reporter, managementRecipients] =
    await Promise.all([
      prisma.user.findFirst({
        where: {
          id: input.reporterId,
          organizationId: input.organizationId,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      }),

      prisma.user.findMany({
        where: {
          organizationId: input.organizationId,
          id: {
            not: input.reporterId,
          },
          role: {
            in: [
              UserRole.ORG_ADMIN,
              UserRole.EHS_MANAGER,
            ],
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
        orderBy: [
          {
            role: "asc",
          },
          {
            name: "asc",
          },
        ],
      }),
    ]);

  if (!reporter) {
    console.error(
      `Incident reporter ${input.reporterId} could not be found for incident ${input.incident.id}.`
    );
  } else {
    await createIncidentNotificationSafely({
      organizationId: input.organizationId,
      userId: reporter.id,
      type: NotificationType.SUCCESS,
      title: "Incident submitted",
      message: `Your incident "${input.incident.title}" was submitted successfully.`,
      link: incidentLink,
      context: "Incident reporter confirmation",
    });

    if (reporter.email) {
      try {
        await sendIncidentReporterConfirmationEmail({
          recipientEmail: reporter.email,
          recipientName: reporter.name,
          incidentId: input.incident.id,
          incidentTitle: input.incident.title,
          incidentDescription:
            input.incident.description,
          incidentType: input.incident.type,
          riskLevel: input.incident.riskLevel,
          status: input.incident.status,
          siteName: input.site.name,
          location: input.incident.location,
          occurredAt: input.incident.occurredAt,
        });
      } catch (error) {
        console.error(
          `Incident reporter confirmation email failed for incident ${input.incident.id}:`,
          error
        );
      }
    }
  }

  const notificationType =
    getIncidentNotificationType(
      input.incident.riskLevel
    );

  const notificationTitle =
    getIncidentNotificationTitle(
      input.incident.riskLevel
    );

  const notificationMessage =
    getIncidentNotificationMessage({
      incidentTitle: input.incident.title,
      siteName: input.site.name,
      riskLevel: input.incident.riskLevel,
    });

  await Promise.all(
    managementRecipients.map(
      async (
        recipient: IncidentNotificationRecipient
      ) => {
        await createIncidentNotificationSafely({
          organizationId: input.organizationId,
          userId: recipient.id,
          type: notificationType,
          title: notificationTitle,
          message: notificationMessage,
          link: incidentLink,
          context: "Incident management alert",
        });

        if (
          !isEscalationRiskLevel(
            input.incident.riskLevel
          ) ||
          !recipient.email
        ) {
          return;
        }

        try {
          await sendHighRiskIncidentAlertEmail({
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            incidentId: input.incident.id,
            incidentTitle: input.incident.title,
            incidentDescription:
              input.incident.description,
            incidentType: input.incident.type,
            riskLevel: input.incident.riskLevel,
            status: input.incident.status,
            siteName: input.site.name,
            location: input.incident.location,
            occurredAt:
              input.incident.occurredAt,
            reportedByName:
              reporter?.name || "Unknown reporter",
          });
        } catch (error) {
          console.error(
            `Incident escalation email failed for recipient ${recipient.id} and incident ${input.incident.id}:`,
            error
          );
        }
      }
    )
  );
}

export async function createIncidentService(input: {
  organizationId: string;
  userId: string;
  title: string;
  description: string;
  type: IncidentType;
  riskLevel: RiskLevel;
  siteId: string;
  location: string;
}) {
  const site = await prisma.site.findFirst({
    where: {
      id: input.siteId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      name: true,
      organizationId: true,
    },
  });

  if (!site) {
    throw new Error(
      "Invalid site for this organization."
    );
  }

  const incident = await createTenantIncident({
    title: input.title,
    description: input.description,
    type: input.type,
    riskLevel: input.riskLevel,
    location: input.location,
    siteId: input.siteId,
    reportedById: input.userId,
  });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType: "Incident",
    entityId: incident.id,
    title: "Incident created",
    description: incident.title,
    metadata: {
      riskLevel: incident.riskLevel,
      status: incident.status,
      siteId: incident.siteId,
    },
  });

  try {
    await notifyIncidentCreated({
      organizationId: input.organizationId,
      reporterId: input.userId,
      incident: {
        id: incident.id,
        title: incident.title,
        description: incident.description,
        type: incident.type,
        riskLevel: incident.riskLevel,
        status: incident.status,
        location: incident.location,
        occurredAt: incident.occurredAt,
      },
      site: {
        id: site.id,
        name: site.name,
      },
    });
  } catch (error) {
    console.error(
      `Automatic incident notification processing failed for incident ${incident.id}:`,
      error
    );
  }

  await startWorkflowForEntity({
    organizationId: input.organizationId,
    userId: input.userId,
    entityType: WorkflowEntityType.INCIDENT,
    entityId: incident.id,
  });

  return incident;
}

export async function updateIncidentStatusService(input: {
  organizationId: string;
  userId: string;
  incidentId: string;
  status: Status;
}) {
  const incident = await findTenantIncidentById(
    input.incidentId,
    input.organizationId
  );

  if (!incident) {
    throw new Error(
      "Invalid incident for this organization."
    );
  }

  const previousStatus = incident.status;

  const updatedIncident =
    await updateTenantIncidentStatus({
      incidentId: input.incidentId,
      status: input.status,
    });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.STATUS_CHANGE,
    entityType: "Incident",
    entityId: input.incidentId,
    title: "Incident status changed",
    description: `${previousStatus} → ${input.status}`,
    metadata: {
      previousStatus,
      newStatus: input.status,
    },
  });

  return updatedIncident;
}

export async function createCorrectiveActionService(input: {
  organizationId: string;
  userId: string;
  incidentId: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  assignedToId: string;
  dueDate: Date;
}) {
  const incident = await findTenantIncidentById(
    input.incidentId,
    input.organizationId
  );

  if (!incident) {
    throw new Error(
      "Invalid incident for this organization."
    );
  }

  const assignedUser = await prisma.user.findFirst({
    where: {
      id: input.assignedToId,
      organizationId: input.organizationId,
    },
  });

  if (!assignedUser) {
    throw new Error(
      "Invalid assigned user for this organization."
    );
  }

  const action = await createTenantCorrectiveAction({
    title: input.title,
    description: input.description,
    riskLevel: input.riskLevel,
    dueDate: input.dueDate,
    incidentId: input.incidentId,
    assignedToId: input.assignedToId,
  });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType: "CorrectiveAction",
    entityId: action.id,
    title: "Corrective action created",
    description: action.title,
    metadata: {
      incidentId: input.incidentId,
      riskLevel: action.riskLevel,
      status: action.status,
      assignedToId: input.assignedToId,
    },
  });

  await createNotification({
    organizationId: input.organizationId,
    userId: input.assignedToId,
    type: NotificationType.ASSIGNMENT,
    title: "Corrective action assigned",
    message: `You were assigned: ${action.title}`,
    link: `/incidents/${input.incidentId}`,
  });

  return action;
}

export async function upsertInvestigationService(input: {
  organizationId: string;
  userId: string;
  incidentId: string;
  summary: string;
  rootCause: string;
  immediateCause: string;
  contributingFactors: string;
}) {
  const incident = await findTenantIncidentById(
    input.incidentId,
    input.organizationId
  );

  if (!incident) {
    throw new Error(
      "Invalid incident for this organization."
    );
  }

  const investigation =
    await upsertTenantInvestigation({
      incidentId: input.incidentId,
      summary: input.summary,
      rootCause: input.rootCause,
      immediateCause: input.immediateCause,
      contributingFactors:
        input.contributingFactors,
    });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.UPDATE,
    entityType: "Investigation",
    entityId: input.incidentId,
    title: "Investigation updated",
    description:
      "Incident investigation details were saved.",
    metadata: {
      incidentId: input.incidentId,
    },
  });

  return investigation;
}

export async function updateCorrectiveActionStatusService(input: {
  organizationId: string;
  userId: string;
  actionId: string;
  incidentId: string;
  status: Status;
}) {
  const action = await findTenantCorrectiveAction({
    actionId: input.actionId,
    incidentId: input.incidentId,
    organizationId: input.organizationId,
  });

  if (!action) {
    throw new Error(
      "Invalid corrective action for this organization."
    );
  }

  const previousStatus = action.status;

  const updatedAction =
    await updateTenantCorrectiveActionStatus({
      actionId: input.actionId,
      status: input.status,
    });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.STATUS_CHANGE,
    entityType: "CorrectiveAction",
    entityId: input.actionId,
    title: "Corrective action status changed",
    description: `${previousStatus} → ${input.status}`,
    metadata: {
      incidentId: input.incidentId,
      previousStatus,
      newStatus: input.status,
    },
  });

  return updatedAction;
}