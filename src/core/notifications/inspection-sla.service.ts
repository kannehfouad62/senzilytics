import { logActivity } from "@/core/activity-log/activity-log.service";
import {
  sendInspectionFindingSlaEmail,
  sendInspectionSlaEmail,
} from "@/core/notifications/inspection-sla-email.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  NotificationType,
  Status,
  UserRole,
} from "@prisma/client";

const REMINDER_WINDOW_HOURS = 24;

async function getInspectionRecipients(input: {
  organizationId: string;
  leadInspectorId?: string | null;
  teamMemberIds: string[];
}) {
  const recipientIds =
    new Set<string>(
      input.teamMemberIds
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

  if (recipientIds.size === 0) {
    return [];
  }

  return prisma.user.findMany({
    where: {
      organizationId:
        input.organizationId,
      id: {
        in: Array.from(
          recipientIds
        ),
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
}

async function wasFindingNotificationProcessed(input: {
  organizationId: string;
  findingId: string;
  title: string;
}) {
  const existingLog =
    await prisma.activityLog.findFirst({
      where: {
        organizationId:
          input.organizationId,
        entityType:
          "InspectionFinding",
        entityId:
          input.findingId,
        title: input.title,
      },
      select: {
        id: true,
      },
    });

  return Boolean(existingLog);
}

export async function processInspectionSlaNotifications() {
  const now = new Date();

  const reminderWindowEnd =
    new Date(
      now.getTime() +
        REMINDER_WINDOW_HOURS *
          60 *
          60 *
          1000
    );

  const [inspections, findings] =
    await Promise.all([
      prisma.inspection.findMany({
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
          site: {
            organizationId: {
              not: "",
            },
          },
        },
        include: {
          site: {
            select: {
              name: true,
              organizationId: true,
            },
          },
          leadInspector: {
            select: {
              id: true,
            },
          },
          teamMembers: {
            select: {
              userId: true,
            },
          },
        },
        orderBy: {
          dueDate: "asc",
        },
      }),

      prisma.inspectionFinding.findMany({
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
          inspection: {
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
          inspection: {
            include: {
              site: {
                select: {
                  name: true,
                  organizationId: true,
                },
              },
              leadInspector: {
                select: {
                  id: true,
                },
              },
              teamMembers: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
        orderBy: {
          dueDate: "asc",
        },
      }),
    ]);

  let inspectionRemindersSent = 0;
  let inspectionOverdueAlertsSent = 0;
  let findingRemindersSent = 0;
  let findingOverdueAlertsSent = 0;
  let inAppNotificationsSent = 0;
  let emailsSent = 0;
  let skipped = 0;

  for (
    const inspection
    of inspections
  ) {
    if (!inspection.dueDate) {
      skipped += 1;
      continue;
    }

    const isOverdue =
      inspection.dueDate < now;

    if (
      isOverdue &&
      inspection.overdueNotifiedAt
    ) {
      skipped += 1;
      continue;
    }

    if (
      !isOverdue &&
      inspection.reminderSentAt
    ) {
      skipped += 1;
      continue;
    }

    const organizationId =
      inspection.site.organizationId;

    const recipients =
      await getInspectionRecipients({
        organizationId,
        leadInspectorId:
          inspection.leadInspector
            ?.id,
        teamMemberIds:
          inspection.teamMembers.map(
            (member) =>
              member.userId
          ),
      });

    if (recipients.length === 0) {
      skipped += 1;
      continue;
    }

    let successfulDeliveries = 0;

    for (
      const recipient
      of recipients
    ) {
      try {
        await createNotification({
          organizationId,
          userId:
            recipient.id,
          type:
            NotificationType.DUE_DATE,
          title: isOverdue
            ? "Inspection overdue"
            : "Inspection due soon",
          message: isOverdue
            ? `"${inspection.title}" is overdue.`
            : `"${inspection.title}" is due within 24 hours.`,
          link:
            `/inspections/${inspection.id}`,
        });

        successfulDeliveries += 1;
        inAppNotificationsSent += 1;
      } catch (error) {
        console.error(
          `Inspection in-app SLA notification failed for inspection ${inspection.id} and user ${recipient.id}:`,
          error
        );
      }

      if (!recipient.email) {
        continue;
      }

      try {
        const result =
          await sendInspectionSlaEmail({
            recipientEmail:
              recipient.email,
            recipientName:
              recipient.name,
            inspectionId:
              inspection.id,
            inspectionTitle:
              inspection.title,
            inspectionReference:
              inspection.reference,
            inspectionType:
              inspection.type,
            inspectionArea:
              inspection.area,
            siteName:
              inspection.site.name,
            dueDate:
              inspection.dueDate,
            notificationKind:
              isOverdue
                ? "OVERDUE"
                : "REMINDER",
          });

        if (result.success) {
          successfulDeliveries += 1;
          emailsSent += 1;
        }
      } catch (error) {
        console.error(
          `Inspection SLA email failed for inspection ${inspection.id} and user ${recipient.id}:`,
          error
        );
      }
    }

    if (successfulDeliveries === 0) {
      skipped += 1;
      continue;
    }

    if (isOverdue) {
      await prisma.inspection.update({
        where: {
          id: inspection.id,
        },
        data: {
          status:
            Status.OVERDUE,
          overdueNotifiedAt:
            now,
        },
      });

      inspectionOverdueAlertsSent += 1;
    } else {
      await prisma.inspection.update({
        where: {
          id: inspection.id,
        },
        data: {
          reminderSentAt:
            now,
        },
      });

      inspectionRemindersSent += 1;
    }

    await logActivity({
      organizationId,
      userId: null,
      action:
        ActivityAction.SYSTEM,
      entityType:
        "Inspection",
      entityId:
        inspection.id,
      title: isOverdue
        ? "Inspection overdue alert sent"
        : "Inspection reminder sent",
      description: isOverdue
        ? `An overdue alert was sent for ${inspection.title}.`
        : `A due-date reminder was sent for ${inspection.title}.`,
      metadata: {
        inspectionId:
          inspection.id,
        dueDate:
          inspection.dueDate.toISOString(),
        notificationKind:
          isOverdue
            ? "OVERDUE"
            : "REMINDER",
        recipientCount:
          recipients.length,
        processedAt:
          now.toISOString(),
      },
    });
  }

  for (
    const finding
    of findings
  ) {
    if (!finding.dueDate) {
      skipped += 1;
      continue;
    }

    const isOverdue =
      finding.dueDate < now;

    const activityTitle =
      isOverdue
        ? `Inspection finding overdue alert sent:${finding.id}`
        : `Inspection finding reminder sent:${finding.id}`;

    const alreadyProcessed =
      await wasFindingNotificationProcessed({
        organizationId:
          finding.inspection.site
            .organizationId,
        findingId:
          finding.id,
        title:
          activityTitle,
      });

    if (alreadyProcessed) {
      skipped += 1;
      continue;
    }

    const organizationId =
      finding.inspection.site
        .organizationId;

    const recipients =
      await getInspectionRecipients({
        organizationId,
        leadInspectorId:
          finding.inspection
            .leadInspector?.id,
        teamMemberIds:
          finding.inspection.teamMembers.map(
            (member) =>
              member.userId
          ),
      });

    if (recipients.length === 0) {
      skipped += 1;
      continue;
    }

    let successfulDeliveries = 0;

    for (
      const recipient
      of recipients
    ) {
      try {
        await createNotification({
          organizationId,
          userId:
            recipient.id,
          type:
            finding.riskLevel ===
            "CRITICAL"
              ? NotificationType.CRITICAL
              : finding.riskLevel ===
                  "HIGH"
                ? NotificationType.WARNING
                : NotificationType.DUE_DATE,
          title: isOverdue
            ? "Inspection finding overdue"
            : "Inspection finding due soon",
          message: isOverdue
            ? `"${finding.title}" is overdue.`
            : `"${finding.title}" is due within 24 hours.`,
          link:
            `/inspections/${finding.inspection.id}`,
        });

        successfulDeliveries += 1;
        inAppNotificationsSent += 1;
      } catch (error) {
        console.error(
          `Inspection-finding notification failed for finding ${finding.id} and user ${recipient.id}:`,
          error
        );
      }

      if (!recipient.email) {
        continue;
      }

      try {
        const result =
          await sendInspectionFindingSlaEmail({
            recipientEmail:
              recipient.email,
            recipientName:
              recipient.name,
            inspectionId:
              finding.inspection.id,
            inspectionTitle:
              finding.inspection.title,
            findingId:
              finding.id,
            findingTitle:
              finding.title,
            findingDescription:
              finding.description,
            riskLevel:
              finding.riskLevel,
            siteName:
              finding.inspection.site
                .name,
            dueDate:
              finding.dueDate,
            notificationKind:
              isOverdue
                ? "OVERDUE"
                : "REMINDER",
          });

        if (result.success) {
          successfulDeliveries += 1;
          emailsSent += 1;
        }
      } catch (error) {
        console.error(
          `Inspection-finding SLA email failed for finding ${finding.id} and user ${recipient.id}:`,
          error
        );
      }
    }

    if (successfulDeliveries === 0) {
      skipped += 1;
      continue;
    }

    if (isOverdue) {
      await prisma.inspectionFinding.update({
        where: {
          id: finding.id,
        },
        data: {
          status:
            Status.OVERDUE,
        },
      });

      findingOverdueAlertsSent += 1;
    } else {
      findingRemindersSent += 1;
    }

    await logActivity({
      organizationId,
      userId: null,
      action:
        ActivityAction.SYSTEM,
      entityType:
        "InspectionFinding",
      entityId:
        finding.id,
      title:
        activityTitle,
      description: isOverdue
        ? `An overdue alert was sent for ${finding.title}.`
        : `A due-date reminder was sent for ${finding.title}.`,
      metadata: {
        inspectionId:
          finding.inspection.id,
        findingId:
          finding.id,
        riskLevel:
          finding.riskLevel,
        dueDate:
          finding.dueDate.toISOString(),
        notificationKind:
          isOverdue
            ? "OVERDUE"
            : "REMINDER",
        recipientCount:
          recipients.length,
        processedAt:
          now.toISOString(),
      },
    });
  }

  return {
    checked:
      inspections.length +
      findings.length,
    inspectionRemindersSent,
    inspectionOverdueAlertsSent,
    findingRemindersSent,
    findingOverdueAlertsSent,
    inAppNotificationsSent,
    emailsSent,
    skipped,
  };
}