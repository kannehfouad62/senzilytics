import { logActivity } from "@/core/activity-log/activity-log.service";
import { sendIncidentEscalationEmail } from "@/core/notifications/incident-escalation-email.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  NotificationType,
  RiskLevel,
  Status,
  UserRole,
} from "@prisma/client";

type EscalationRule = {
  level: number;
  minimumAgeHours: number;
};

type IncidentEscalationCandidate = {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  type: string;
  riskLevel: RiskLevel;
  status: Status;
  location: string | null;
  occurredAt: Date;
  createdAt: Date;
  siteName: string;
  reportedByName: string;
};

type EscalationRecipient = {
  id: string;
  organizationId: string | null;
  name: string;
  email: string;
};

const ESCALATION_RULES: Record<
  "HIGH" | "CRITICAL",
  EscalationRule[]
> = {
  [RiskLevel.HIGH]: [
    {
      level: 1,
      minimumAgeHours: 4,
    },
    {
      level: 2,
      minimumAgeHours: 12,
    },
    {
      level: 3,
      minimumAgeHours: 24,
    },
  ],

  [RiskLevel.CRITICAL]: [
    {
      level: 1,
      minimumAgeHours: 1,
    },
    {
      level: 2,
      minimumAgeHours: 4,
    },
    {
      level: 3,
      minimumAgeHours: 12,
    },
  ],
};

function getEscalationActivityTitle(
  level: number
) {
  return `Incident escalation level ${level} sent`;
}

function getIncidentAgeHours(
  incidentCreatedAt: Date,
  now: Date
) {
  return (
    now.getTime() -
    incidentCreatedAt.getTime()
  ) / (60 * 60 * 1000);
}

function getRequiredEscalationRules(input: {
  riskLevel: "HIGH" | "CRITICAL";
  incidentAgeHours: number;
}) {
  return ESCALATION_RULES[
    input.riskLevel
  ].filter(
    (rule) =>
      input.incidentAgeHours >=
      rule.minimumAgeHours
  );
}

function getNotificationType(
  riskLevel: RiskLevel
) {
  return riskLevel === "CRITICAL"
    ? NotificationType.CRITICAL
    : NotificationType.WARNING;
}

function getNotificationTitle(input: {
  riskLevel: RiskLevel;
  escalationLevel: number;
}) {
  return (
    `${input.riskLevel.replaceAll("_", " ")} incident ` +
    `escalation level ${input.escalationLevel}`
  );
}

function getNotificationMessage(input: {
  incidentTitle: string;
  siteName: string;
  escalationLevel: number;
}) {
  return (
    `"${input.incidentTitle}" at ${input.siteName} remains unresolved ` +
    `and has reached escalation level ${input.escalationLevel}.`
  );
}

function getEscalationKey(input: {
  incidentId: string;
  escalationLevel: number;
}) {
  return (
    `${input.incidentId}:` +
    `${input.escalationLevel}`
  );
}

async function createEscalationNotification(input: {
  incident: IncidentEscalationCandidate;
  recipient: EscalationRecipient;
  escalationLevel: number;
}) {
  try {
    await createNotification({
      organizationId:
        input.incident.organizationId,
      userId: input.recipient.id,
      type: getNotificationType(
        input.incident.riskLevel
      ),
      title: getNotificationTitle({
        riskLevel:
          input.incident.riskLevel,
        escalationLevel:
          input.escalationLevel,
      }),
      message: getNotificationMessage({
        incidentTitle:
          input.incident.title,
        siteName:
          input.incident.siteName,
        escalationLevel:
          input.escalationLevel,
      }),
      link:
        `/incidents/${input.incident.id}`,
    });

    return true;
  } catch (error) {
    console.error(
      `Incident escalation in-app notification failed for incident ` +
        `${input.incident.id} and user ${input.recipient.id}:`,
      error
    );

    return false;
  }
}

async function sendEscalationEmail(input: {
  incident: IncidentEscalationCandidate;
  recipient: EscalationRecipient;
  escalationLevel: number;
}) {
  if (!input.recipient.email) {
    return false;
  }

  try {
    const result =
      await sendIncidentEscalationEmail({
        recipientEmail:
          input.recipient.email,
        recipientName:
          input.recipient.name,
        incidentId:
          input.incident.id,
        incidentTitle:
          input.incident.title,
        incidentDescription:
          input.incident.description,
        incidentType:
          input.incident.type,
        riskLevel:
          input.incident.riskLevel,
        status:
          input.incident.status,
        escalationLevel:
          input.escalationLevel,
        siteName:
          input.incident.siteName,
        location:
          input.incident.location,
        occurredAt:
          input.incident.occurredAt,
        reportedAt:
          input.incident.createdAt,
        reportedByName:
          input.incident.reportedByName,
      });

    return result.success;
  } catch (error) {
    console.error(
      `Incident escalation email failed for incident ` +
        `${input.incident.id} and user ${input.recipient.id}:`,
      error
    );

    return false;
  }
}

export async function processIncidentEscalations() {
  const now = new Date();


  const incidents =
    await prisma.incident.findMany({
      where: {
        riskLevel: {
          in: [
            "HIGH",
            "CRITICAL",
          ],
        },
        status: {
          notIn: [
            Status.COMPLETED,
            Status.CLOSED,
          ],
        },
        createdAt: {
          lte: now,
        },
        site: {
          organizationId: {
            not: "",
          },
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        riskLevel: true,
        status: true,
        location: true,
        occurredAt: true,
        createdAt: true,
        site: {
          select: {
            name: true,
            organizationId: true,
          },
        },
        reportedBy: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

  if (incidents.length === 0) {
    return {
      checked: 0,
      escalationLevelsProcessed: 0,
      inAppNotificationsSent: 0,
      emailsSent: 0,
      skipped: 0,
    };
  }

  const candidates: IncidentEscalationCandidate[] =
    incidents.map((incident) => ({
      id: incident.id,
      organizationId:
        incident.site.organizationId,
      title: incident.title,
      description: incident.description,
      type: incident.type,
      riskLevel: incident.riskLevel,
      status: incident.status,
      location: incident.location,
      occurredAt: incident.occurredAt,
      createdAt: incident.createdAt,
      siteName: incident.site.name,
      reportedByName:
        incident.reportedBy.name,
    }));

  const organizationIds = Array.from(
    new Set(
      candidates.map(
        (incident) =>
          incident.organizationId
      )
    )
  );

  const [recipients, existingEscalationLogs] =
    await Promise.all([
      prisma.user.findMany({
        where: {
          organizationId: {
            in: organizationIds,
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
          organizationId: true,
          name: true,
          email: true,
        },
        orderBy: {
          name: "asc",
        },
      }),

      prisma.activityLog.findMany({
        where: {
          action:
            ActivityAction.SYSTEM,
          entityType: "Incident",
          entityId: {
            in: candidates.map(
              (incident) => incident.id
            ),
          },
          title: {
            startsWith:
              "Incident escalation level ",
          },
        },
        select: {
          entityId: true,
          title: true,
        },
      }),
    ]);

  const recipientsByOrganization =
    new Map<
      string,
      EscalationRecipient[]
    >();

  for (const recipient of recipients) {
    if (!recipient.organizationId) {
      continue;
    }

    const organizationRecipients =
      recipientsByOrganization.get(
        recipient.organizationId
      ) ?? [];

    organizationRecipients.push(recipient);

    recipientsByOrganization.set(
      recipient.organizationId,
      organizationRecipients
    );
  }

  const processedEscalations =
    new Set<string>();

  for (
    const escalationLog
    of existingEscalationLogs
  ) {
    if (!escalationLog.entityId) {
      continue;
    }

    const levelMatch =
      escalationLog.title.match(
        /^Incident escalation level (\d+) sent$/
      );

    if (!levelMatch) {
      continue;
    }

    processedEscalations.add(
      getEscalationKey({
        incidentId:
          escalationLog.entityId,
        escalationLevel:
          Number(levelMatch[1]),
      })
    );
  }

  let escalationLevelsProcessed = 0;
  let inAppNotificationsSent = 0;
  let emailsSent = 0;
  let skipped = 0;

  for (const incident of candidates) {
    const incidentAgeHours =
      getIncidentAgeHours(
        incident.createdAt,
        now
      );

      if (
        incident.riskLevel !== "HIGH" &&
        incident.riskLevel !== "CRITICAL"
      ) {
        continue;
      }
      
      const requiredRules = getRequiredEscalationRules({
        riskLevel: incident.riskLevel,
        incidentAgeHours,
      });

    if (requiredRules.length === 0) {
      skipped += 1;
      continue;
    }

    const incidentRecipients =
      recipientsByOrganization.get(
        incident.organizationId
      ) ?? [];

    if (incidentRecipients.length === 0) {
      console.error(
        `No organization administrators or EHS managers were found for ` +
          `incident ${incident.id}.`
      );

      skipped += 1;
      continue;
    }

    for (const rule of requiredRules) {
      const escalationKey =
        getEscalationKey({
          incidentId: incident.id,
          escalationLevel: rule.level,
        });

      if (
        processedEscalations.has(
          escalationKey
        )
      ) {
        skipped += 1;
        continue;
      }

      let successfulDeliveries = 0;
      let levelInAppNotifications = 0;
      let levelEmails = 0;

      await Promise.all(
        incidentRecipients.map(
          async (recipient) => {
            const [
              notificationCreated,
              emailSent,
            ] = await Promise.all([
              createEscalationNotification({
                incident,
                recipient,
                escalationLevel:
                  rule.level,
              }),

              sendEscalationEmail({
                incident,
                recipient,
                escalationLevel:
                  rule.level,
              }),
            ]);

            if (notificationCreated) {
              successfulDeliveries += 1;
              levelInAppNotifications += 1;
            }

            if (emailSent) {
              successfulDeliveries += 1;
              levelEmails += 1;
            }
          }
        )
      );

      if (successfulDeliveries === 0) {
        console.error(
          `Incident escalation level ${rule.level} had no successful ` +
            `deliveries for incident ${incident.id}.`
        );

        skipped += 1;
        continue;
      }

      await logActivity({
        organizationId:
          incident.organizationId,
        userId: null,
        action:
          ActivityAction.SYSTEM,
        entityType: "Incident",
        entityId: incident.id,
        title:
          getEscalationActivityTitle(
            rule.level
          ),
        description:
          `${incident.riskLevel} incident escalation level ` +
          `${rule.level} was sent.`,
        metadata: {
          incidentId: incident.id,
          riskLevel:
            incident.riskLevel,
          status: incident.status,
          escalationLevel:
            rule.level,
          incidentAgeHours:
            Math.floor(
              incidentAgeHours
            ),
          minimumAgeHours:
            rule.minimumAgeHours,
          recipientCount:
            incidentRecipients.length,
          inAppNotificationsSent:
            levelInAppNotifications,
          emailsSent: levelEmails,
          processedAt:
            now.toISOString(),
        },
      });

      processedEscalations.add(
        escalationKey
      );

      escalationLevelsProcessed += 1;
      inAppNotificationsSent +=
        levelInAppNotifications;
      emailsSent += levelEmails;
    }
  }

  return {
    checked: candidates.length,
    escalationLevelsProcessed,
    inAppNotificationsSent,
    emailsSent,
    skipped,
  };
}