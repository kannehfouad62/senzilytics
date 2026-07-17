import { logActivity } from "@/core/activity-log/activity-log.service";
import {
  sendMocApprovalSlaEmail,
  sendMocPlannedCompletionSlaEmail,
  sendMocTaskSlaEmail,
  sendMocVerificationSlaEmail,
  sendTemporaryMocSlaEmail,
} from "@/core/notifications/moc-sla-email.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  MocApprovalStatus,
  MocChangeDuration,
  MocStatus,
  MocTaskStatus,
  NotificationType,
  UserRole,
} from "@prisma/client";

const TASK_REMINDER_WINDOW_DAYS = 7;
const APPROVAL_REMINDER_AFTER_HOURS = 24;
const TEMPORARY_CHANGE_30_DAY_WINDOW = 30;
const TEMPORARY_CHANGE_7_DAY_WINDOW = 7;
const COMPLETION_REMINDER_WINDOW_DAYS = 7;

type NotificationRecipient = {
  id: string;
  name: string;
  email: string | null;
};

function addDays(
  value: Date,
  days: number
) {
  return new Date(
    value.getTime() +
      days * 24 * 60 * 60 * 1000
  );
}

function startOfDay(
  value: Date
) {
  const result = new Date(value);

  result.setHours(
    0,
    0,
    0,
    0
  );

  return result;
}

function differenceInCalendarDays(
  laterDate: Date,
  earlierDate: Date
) {
  const later =
    startOfDay(laterDate);

  const earlier =
    startOfDay(earlierDate);

  return Math.round(
    (later.getTime() -
      earlier.getTime()) /
      (24 * 60 * 60 * 1000)
  );
}

function formatEnum(
  value: string
) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function getTaskReminderTitle(
  taskId: string
) {
  return `MOC task reminder sent:${taskId}`;
}

function getTaskOverdueTitle(
  taskId: string
) {
  return `MOC task overdue alert sent:${taskId}`;
}

function getApprovalReminderTitle(
  approvalId: string
) {
  return `MOC approval reminder sent:${approvalId}`;
}

function getTemporary30DayTitle(
  mocId: string
) {
  return `MOC temporary 30-day reminder sent:${mocId}`;
}

function getTemporary7DayTitle(
  mocId: string
) {
  return `MOC temporary 7-day reminder sent:${mocId}`;
}

function getTemporaryExpiredTitle(
  mocId: string
) {
  return `MOC temporary expiration alert sent:${mocId}`;
}

function getPlannedCompletionReminderTitle(
  mocId: string
) {
  return `MOC planned-completion reminder sent:${mocId}`;
}

function getPlannedCompletionOverdueTitle(
  mocId: string
) {
  return `MOC planned-completion overdue alert sent:${mocId}`;
}

function getVerificationOverdueTitle(
  mocId: string
) {
  return `MOC verification overdue alert sent:${mocId}`;
}

async function activityAlreadyExists(
  input: {
    organizationId: string;
    entityType: string;
    entityId: string;
    title: string;
  }
) {
  const existingLog =
    await prisma.activityLog.findFirst({
      where: {
        organizationId:
          input.organizationId,

        entityType:
          input.entityType,

        entityId:
          input.entityId,

        title:
          input.title,
      },

      select: {
        id: true,
      },
    });

  return Boolean(existingLog);
}

async function getMocRecipients(
  input: {
    organizationId: string;
    requestorId: string;
    ownerId?: string | null;

    additionalUserIds?: Array<
      string | null | undefined
    >;

    includeManagement?: boolean;
  }
): Promise<NotificationRecipient[]> {
  const recipientIds =
    new Set<string>();

  recipientIds.add(
    input.requestorId
  );

  if (input.ownerId) {
    recipientIds.add(
      input.ownerId
    );
  }

  for (
    const userId
    of input.additionalUserIds ?? []
  ) {
    if (userId) {
      recipientIds.add(
        userId
      );
    }
  }

  if (input.includeManagement) {
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
  }

  if (
    recipientIds.size === 0
  ) {
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

export async function processMocSlaNotifications() {
  const now = new Date();

  const taskReminderWindowEnd =
    addDays(
      now,
      TASK_REMINDER_WINDOW_DAYS
    );

  const plannedCompletionWindowEnd =
    addDays(
      now,
      COMPLETION_REMINDER_WINDOW_DAYS
    );

  const approvalReminderCutoff =
    new Date(
      now.getTime() -
        APPROVAL_REMINDER_AFTER_HOURS *
          60 *
          60 *
          1000
    );

  const activeMocStatuses: MocStatus[] =
    [
      MocStatus.DRAFT,
      MocStatus.TECHNICAL_REVIEW,
      MocStatus.RISK_REVIEW,
      MocStatus.PENDING_APPROVAL,
      MocStatus.APPROVED,
      MocStatus.IMPLEMENTATION,
      MocStatus.VERIFICATION,
    ];

  const [
    tasks,
    approvals,
    temporaryChanges,
    scheduledChanges,
    verificationChanges,
  ] = await Promise.all([
    prisma.mocTask.findMany({
      where: {
        status: {
          notIn: [
            MocTaskStatus.COMPLETED,
            MocTaskStatus.CANCELLED,
          ],
        },

        dueDate: {
          not: null,
          lte:
            taskReminderWindowEnd,
        },

        moc: {
          status: {
            in: activeMocStatuses,
          },

          organizationId: {
            not: "",
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

        moc: {
          select: {
            id: true,
            organizationId: true,
            reference: true,
            title: true,
            requestorId: true,
            ownerId: true,

            site: {
              select: {
                name: true,
              },
            },
          },
        },
      },

      orderBy: {
        dueDate: "asc",
      },
    }),

    prisma.mocApproval.findMany({
      where: {
        status:
          MocApprovalStatus.PENDING,

        requestedAt: {
          lte:
            approvalReminderCutoff,
        },

        moc: {
          status: {
            in: [
              MocStatus.TECHNICAL_REVIEW,
              MocStatus.RISK_REVIEW,
              MocStatus.PENDING_APPROVAL,
            ],
          },

          organizationId: {
            not: "",
          },
        },
      },

      include: {
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },

        moc: {
          select: {
            id: true,
            organizationId: true,
            reference: true,
            title: true,
            requestorId: true,
            ownerId: true,

            site: {
              select: {
                name: true,
              },
            },
          },
        },
      },

      orderBy: {
        requestedAt: "asc",
      },
    }),

    prisma.managementOfChange.findMany({
      where: {
        changeDuration:
          MocChangeDuration.TEMPORARY,

        status: {
          in: activeMocStatuses,
        },

        temporaryExpirationDate: {
          not: null,

          lte: addDays(
            now,
            TEMPORARY_CHANGE_30_DAY_WINDOW
          ),
        },

        organizationId: {
          not: "",
        },
      },

      select: {
        id: true,
        organizationId: true,
        reference: true,
        title: true,
        requestorId: true,
        ownerId: true,
        temporaryExpirationDate: true,

        site: {
          select: {
            name: true,
          },
        },
      },

      orderBy: {
        temporaryExpirationDate:
          "asc",
      },
    }),

    prisma.managementOfChange.findMany({
      where: {
        status: {
          in: activeMocStatuses,
        },

        plannedCompletionDate: {
          not: null,

          lte:
            plannedCompletionWindowEnd,
        },

        organizationId: {
          not: "",
        },
      },

      select: {
        id: true,
        organizationId: true,
        reference: true,
        title: true,
        status: true,
        requestorId: true,
        ownerId: true,
        plannedCompletionDate: true,

        site: {
          select: {
            name: true,
          },
        },
      },

      orderBy: {
        plannedCompletionDate:
          "asc",
      },
    }),

    prisma.managementOfChange.findMany({
      where: {
        status:
          MocStatus.VERIFICATION,

        plannedCompletionDate: {
          not: null,
          lt: now,
        },

        organizationId: {
          not: "",
        },
      },

      select: {
        id: true,
        organizationId: true,
        reference: true,
        title: true,
        requestorId: true,
        ownerId: true,
        plannedCompletionDate: true,

        site: {
          select: {
            name: true,
          },
        },
      },

      orderBy: {
        plannedCompletionDate:
          "asc",
      },
    }),
  ]);

  let taskRemindersSent = 0;
  let taskOverdueAlertsSent = 0;
  let approvalRemindersSent = 0;

  let temporary30DayRemindersSent =
    0;

  let temporary7DayRemindersSent =
    0;

  let temporaryExpirationAlertsSent =
    0;

  let plannedCompletionRemindersSent =
    0;

  let plannedCompletionOverdueAlertsSent =
    0;

  let verificationOverdueAlertsSent =
    0;

  let inAppNotificationsSent = 0;
  let emailsSent = 0;
  let skipped = 0;

  /*
   * MOC task reminders and overdue alerts
   */
  for (const task of tasks) {
    if (!task.dueDate) {
      skipped += 1;
      continue;
    }

    const isOverdue =
      task.dueDate < now;

    const activityTitle =
      isOverdue
        ? getTaskOverdueTitle(
            task.id
          )
        : getTaskReminderTitle(
            task.id
          );

    const existingLog =
      await activityAlreadyExists({
        organizationId:
          task.moc.organizationId,

        entityType:
          "MocTask",

        entityId:
          task.id,

        title:
          activityTitle,
      });

    if (existingLog) {
      skipped += 1;
      continue;
    }

    const recipients:
      NotificationRecipient[] =
      task.assignedTo
        ? [task.assignedTo]
        : await getMocRecipients({
            organizationId:
              task.moc
                .organizationId,

            requestorId:
              task.moc
                .requestorId,

            ownerId:
              task.moc.ownerId,

            includeManagement:
              true,
          });

    if (
      recipients.length === 0
    ) {
      skipped += 1;
      continue;
    }

    let successfulDeliveries = 0;

    for (const recipient of recipients) {
      try {
        await createNotification({
          organizationId:
            task.moc.organizationId,

          userId:
            recipient.id,

          type:
            isOverdue
              ? NotificationType.WARNING
              : NotificationType.DUE_DATE,

          title:
            isOverdue
              ? "MOC task overdue"
              : "MOC task due soon",

          message:
            isOverdue
              ? `"${task.title}" is overdue for ${task.moc.reference}: ${task.moc.title}.`
              : `"${task.title}" is due within seven days for ${task.moc.reference}: ${task.moc.title}.`,

          link:
            `/moc/${task.moc.id}`,
        });

        successfulDeliveries += 1;
        inAppNotificationsSent += 1;
      } catch (error) {
        console.error(
          `MOC task in-app SLA notification failed for task ${task.id} and user ${recipient.id}:`,
          error
        );
      }

      if (!recipient.email) {
        continue;
      }

      try {
        const result =
          await sendMocTaskSlaEmail({
            recipientEmail:
              recipient.email,

            recipientName:
              recipient.name,

            mocId:
              task.moc.id,

            mocReference:
              task.moc.reference,

            mocTitle:
              task.moc.title,

            taskId:
              task.id,

            taskTitle:
              task.title,

            taskDescription:
              task.description,

            taskType:
              task.taskType,

            siteName:
              task.moc.site.name,

            dueDate:
              task.dueDate,

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
          `MOC task SLA email failed for task ${task.id} and user ${recipient.id}:`,
          error
        );
      }
    }

    if (
      successfulDeliveries === 0
    ) {
      skipped += 1;
      continue;
    }

    if (isOverdue) {
      taskOverdueAlertsSent += 1;
    } else {
      taskRemindersSent += 1;
    }

    await logActivity({
      organizationId:
        task.moc.organizationId,

      userId: null,

      action:
        ActivityAction.SYSTEM,

      entityType:
        "MocTask",

      entityId:
        task.id,

      title:
        activityTitle,

      description:
        isOverdue
          ? `An overdue alert was sent for MOC task "${task.title}".`
          : `A due-date reminder was sent for MOC task "${task.title}".`,

      metadata: {
        mocId:
          task.moc.id,

        mocReference:
          task.moc.reference,

        taskId:
          task.id,

        dueDate:
          task.dueDate.toISOString(),

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

  /*
   * Pending MOC approval reminders
   */
  for (
    const approval
    of approvals
  ) {
    const activityTitle =
      getApprovalReminderTitle(
        approval.id
      );

    const existingLog =
      await activityAlreadyExists({
        organizationId:
          approval.moc
            .organizationId,

        entityType:
          "MocApproval",

        entityId:
          approval.id,

        title:
          activityTitle,
      });

    if (existingLog) {
      skipped += 1;
      continue;
    }

    const recipients:
      NotificationRecipient[] =
      approval.approver
        ? [approval.approver]
        : await getMocRecipients({
            organizationId:
              approval.moc
                .organizationId,

            requestorId:
              approval.moc
                .requestorId,

            ownerId:
              approval.moc.ownerId,

            includeManagement:
              true,
          });

    if (
      recipients.length === 0
    ) {
      skipped += 1;
      continue;
    }

    let successfulDeliveries = 0;

    for (const recipient of recipients) {
      try {
        await createNotification({
          organizationId:
            approval.moc
              .organizationId,

          userId:
            recipient.id,

          type:
            NotificationType.ASSIGNMENT,

          title:
            "MOC approval pending",

          message:
            `${formatEnum(
              approval.role
            )} approval remains pending for ${approval.moc.reference}: ${approval.moc.title}.`,

          link:
            `/moc/${approval.moc.id}`,
        });

        successfulDeliveries += 1;
        inAppNotificationsSent += 1;
      } catch (error) {
        console.error(
          `MOC approval in-app reminder failed for approval ${approval.id} and user ${recipient.id}:`,
          error
        );
      }

      if (!recipient.email) {
        continue;
      }

      try {
        const result =
          await sendMocApprovalSlaEmail({
            recipientEmail:
              recipient.email,

            recipientName:
              recipient.name,

            mocId:
              approval.moc.id,

            mocReference:
              approval.moc.reference,

            mocTitle:
              approval.moc.title,

            approvalId:
              approval.id,

            approvalRole:
              approval.role,

            requestedAt:
              approval.requestedAt,

            siteName:
              approval.moc.site.name,
          });

        if (result.success) {
          successfulDeliveries += 1;
          emailsSent += 1;
        }
      } catch (error) {
        console.error(
          `MOC approval SLA email failed for approval ${approval.id} and user ${recipient.id}:`,
          error
        );
      }
    }

    if (
      successfulDeliveries === 0
    ) {
      skipped += 1;
      continue;
    }

    approvalRemindersSent += 1;

    await logActivity({
      organizationId:
        approval.moc
          .organizationId,

      userId: null,

      action:
        ActivityAction.SYSTEM,

      entityType:
        "MocApproval",

      entityId:
        approval.id,

      title:
        activityTitle,

      description:
        `A pending approval reminder was sent for ${formatEnum(
          approval.role
        )} approval on ${approval.moc.reference}.`,

      metadata: {
        mocId:
          approval.moc.id,

        mocReference:
          approval.moc.reference,

        approvalId:
          approval.id,

        approvalRole:
          approval.role,

        requestedAt:
          approval.requestedAt.toISOString(),

        recipientCount:
          recipients.length,

        processedAt:
          now.toISOString(),
      },
    });
  }

  /*
   * Temporary MOC expiration reminders
   */
  for (
    const moc
    of temporaryChanges
  ) {
    if (
      !moc.temporaryExpirationDate
    ) {
      skipped += 1;
      continue;
    }

    const daysUntilExpiration =
      differenceInCalendarDays(
        moc.temporaryExpirationDate,
        now
      );

    let activityTitle:
      | string
      | null = null;

    let notificationTitle:
      | string
      | null = null;

    let notificationMessage:
      | string
      | null = null;

    /*
     * Explicitly type this variable as NotificationType.
     * This prevents TypeScript from narrowing it to only
     * NotificationType.DUE_DATE.
     */
    let notificationType: NotificationType =
      NotificationType.DUE_DATE;

    let notificationKind:
      | "30_DAY"
      | "7_DAY"
      | "EXPIRED"
      | null = null;

    if (
      daysUntilExpiration < 0
    ) {
      activityTitle =
        getTemporaryExpiredTitle(
          moc.id
        );

      notificationTitle =
        "Temporary MOC has expired";

      notificationMessage =
        `${moc.reference}: ${moc.title} expired on ${moc.temporaryExpirationDate.toLocaleDateString(
          "en-US"
        )}.`;

      notificationType =
        NotificationType.CRITICAL;

      notificationKind =
        "EXPIRED";
    } else if (
      daysUntilExpiration <=
      TEMPORARY_CHANGE_7_DAY_WINDOW
    ) {
      activityTitle =
        getTemporary7DayTitle(
          moc.id
        );

      notificationTitle =
        "Temporary MOC expires soon";

      notificationMessage =
        `${moc.reference}: ${moc.title} expires in ${daysUntilExpiration} day(s).`;

      notificationType =
        NotificationType.WARNING;

      notificationKind =
        "7_DAY";
    } else if (
      daysUntilExpiration <=
      TEMPORARY_CHANGE_30_DAY_WINDOW
    ) {
      activityTitle =
        getTemporary30DayTitle(
          moc.id
        );

      notificationTitle =
        "Temporary MOC expiration approaching";

      notificationMessage =
        `${moc.reference}: ${moc.title} expires in ${daysUntilExpiration} day(s).`;

      notificationType =
        NotificationType.DUE_DATE;

      notificationKind =
        "30_DAY";
    }

    if (
      !activityTitle ||
      !notificationTitle ||
      !notificationMessage ||
      !notificationKind
    ) {
      skipped += 1;
      continue;
    }

    const existingLog =
      await activityAlreadyExists({
        organizationId:
          moc.organizationId,

        entityType:
          "ManagementOfChange",

        entityId:
          moc.id,

        title:
          activityTitle,
      });

    if (existingLog) {
      skipped += 1;
      continue;
    }

    const recipients =
      await getMocRecipients({
        organizationId:
          moc.organizationId,

        requestorId:
          moc.requestorId,

        ownerId:
          moc.ownerId,

        includeManagement:
          notificationKind ===
          "EXPIRED",
      });

    if (
      recipients.length === 0
    ) {
      skipped += 1;
      continue;
    }

    let successfulDeliveries = 0;

    for (const recipient of recipients) {
      try {
        await createNotification({
          organizationId:
            moc.organizationId,

          userId:
            recipient.id,

          type:
            notificationType,

          title:
            notificationTitle,

          message:
            notificationMessage,

          link:
            `/moc/${moc.id}`,
        });

        successfulDeliveries += 1;
        inAppNotificationsSent += 1;
      } catch (error) {
        console.error(
          `Temporary MOC in-app notification failed for MOC ${moc.id} and user ${recipient.id}:`,
          error
        );
      }

      if (!recipient.email) {
        continue;
      }

      try {
        const result =
          await sendTemporaryMocSlaEmail({
            recipientEmail:
              recipient.email,

            recipientName:
              recipient.name,

            mocId:
              moc.id,

            mocReference:
              moc.reference,

            mocTitle:
              moc.title,

            siteName:
              moc.site.name,

            expirationDate:
              moc.temporaryExpirationDate,

            notificationKind,

            daysUntilExpiration,
          });

        if (result.success) {
          successfulDeliveries += 1;
          emailsSent += 1;
        }
      } catch (error) {
        console.error(
          `Temporary MOC SLA email failed for MOC ${moc.id} and user ${recipient.id}:`,
          error
        );
      }
    }

    if (
      successfulDeliveries === 0
    ) {
      skipped += 1;
      continue;
    }

    if (
      notificationKind ===
      "EXPIRED"
    ) {
      temporaryExpirationAlertsSent +=
        1;
    } else if (
      notificationKind ===
      "7_DAY"
    ) {
      temporary7DayRemindersSent +=
        1;
    } else {
      temporary30DayRemindersSent +=
        1;
    }

    await logActivity({
      organizationId:
        moc.organizationId,

      userId: null,

      action:
        ActivityAction.SYSTEM,

      entityType:
        "ManagementOfChange",

      entityId:
        moc.id,

      title:
        activityTitle,

      description:
        notificationMessage,

      metadata: {
        mocId:
          moc.id,

        mocReference:
          moc.reference,

        expirationDate:
          moc.temporaryExpirationDate.toISOString(),

        daysUntilExpiration,

        notificationKind,

        recipientCount:
          recipients.length,

        processedAt:
          now.toISOString(),
      },
    });
  }

  /*
   * Planned-completion reminders and overdue alerts
   */
  for (
    const moc
    of scheduledChanges
  ) {
    if (
      !moc.plannedCompletionDate
    ) {
      skipped += 1;
      continue;
    }

    /*
     * Verification overdue records are handled
     * separately to avoid duplicate alerts.
     */
    if (
      moc.status ===
        MocStatus.VERIFICATION &&
      moc.plannedCompletionDate <
        now
    ) {
      skipped += 1;
      continue;
    }

    const isOverdue =
      moc.plannedCompletionDate <
      now;

    const activityTitle =
      isOverdue
        ? getPlannedCompletionOverdueTitle(
            moc.id
          )
        : getPlannedCompletionReminderTitle(
            moc.id
          );

    const existingLog =
      await activityAlreadyExists({
        organizationId:
          moc.organizationId,

        entityType:
          "ManagementOfChange",

        entityId:
          moc.id,

        title:
          activityTitle,
      });

    if (existingLog) {
      skipped += 1;
      continue;
    }

    const recipients =
      await getMocRecipients({
        organizationId:
          moc.organizationId,

        requestorId:
          moc.requestorId,

        ownerId:
          moc.ownerId,

        includeManagement:
          isOverdue,
      });

    if (
      recipients.length === 0
    ) {
      skipped += 1;
      continue;
    }

    let successfulDeliveries = 0;

    for (const recipient of recipients) {
      try {
        await createNotification({
          organizationId:
            moc.organizationId,

          userId:
            recipient.id,

          type:
            isOverdue
              ? NotificationType.WARNING
              : NotificationType.DUE_DATE,

          title:
            isOverdue
              ? "MOC planned completion overdue"
              : "MOC planned completion approaching",

          message:
            isOverdue
              ? `${moc.reference}: ${moc.title} is past its planned completion date.`
              : `${moc.reference}: ${moc.title} is due for completion within seven days.`,

          link:
            `/moc/${moc.id}`,
        });

        successfulDeliveries += 1;
        inAppNotificationsSent += 1;
      } catch (error) {
        console.error(
          `MOC completion in-app notification failed for MOC ${moc.id} and user ${recipient.id}:`,
          error
        );
      }

      if (!recipient.email) {
        continue;
      }

      try {
        const result =
          await sendMocPlannedCompletionSlaEmail({
            recipientEmail:
              recipient.email,

            recipientName:
              recipient.name,

            mocId:
              moc.id,

            mocReference:
              moc.reference,

            mocTitle:
              moc.title,

            mocStatus:
              moc.status,

            siteName:
              moc.site.name,

            plannedCompletionDate:
              moc.plannedCompletionDate,

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
          `MOC planned-completion SLA email failed for MOC ${moc.id} and user ${recipient.id}:`,
          error
        );
      }
    }

    if (
      successfulDeliveries === 0
    ) {
      skipped += 1;
      continue;
    }

    if (isOverdue) {
      plannedCompletionOverdueAlertsSent +=
        1;
    } else {
      plannedCompletionRemindersSent +=
        1;
    }

    await logActivity({
      organizationId:
        moc.organizationId,

      userId: null,

      action:
        ActivityAction.SYSTEM,

      entityType:
        "ManagementOfChange",

      entityId:
        moc.id,

      title:
        activityTitle,

      description:
        isOverdue
          ? `An overdue planned-completion alert was sent for ${moc.reference}.`
          : `A planned-completion reminder was sent for ${moc.reference}.`,

      metadata: {
        mocId:
          moc.id,

        mocReference:
          moc.reference,

        status:
          moc.status,

        plannedCompletionDate:
          moc.plannedCompletionDate.toISOString(),

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

  /*
   * Verification overdue alerts
   */
  for (
    const moc
    of verificationChanges
  ) {
    if (
      !moc.plannedCompletionDate
    ) {
      skipped += 1;
      continue;
    }

    const activityTitle =
      getVerificationOverdueTitle(
        moc.id
      );

    const existingLog =
      await activityAlreadyExists({
        organizationId:
          moc.organizationId,

        entityType:
          "ManagementOfChange",

        entityId:
          moc.id,

        title:
          activityTitle,
      });

    if (existingLog) {
      skipped += 1;
      continue;
    }

    const recipients =
      await getMocRecipients({
        organizationId:
          moc.organizationId,

        requestorId:
          moc.requestorId,

        ownerId:
          moc.ownerId,

        includeManagement:
          true,
      });

    if (
      recipients.length === 0
    ) {
      skipped += 1;
      continue;
    }

    let successfulDeliveries = 0;

    for (const recipient of recipients) {
      try {
        await createNotification({
          organizationId:
            moc.organizationId,

          userId:
            recipient.id,

          type:
            NotificationType.CRITICAL,

          title:
            "MOC verification overdue",

          message:
            `${moc.reference}: ${moc.title} remains in verification beyond its planned completion date.`,

          link:
            `/moc/${moc.id}`,
        });

        successfulDeliveries += 1;
        inAppNotificationsSent += 1;
      } catch (error) {
        console.error(
          `MOC verification in-app notification failed for MOC ${moc.id} and user ${recipient.id}:`,
          error
        );
      }

      if (!recipient.email) {
        continue;
      }

      try {
        const result =
          await sendMocVerificationSlaEmail({
            recipientEmail:
              recipient.email,

            recipientName:
              recipient.name,

            mocId:
              moc.id,

            mocReference:
              moc.reference,

            mocTitle:
              moc.title,

            siteName:
              moc.site.name,

            plannedCompletionDate:
              moc.plannedCompletionDate,
          });

        if (result.success) {
          successfulDeliveries += 1;
          emailsSent += 1;
        }
      } catch (error) {
        console.error(
          `MOC verification SLA email failed for MOC ${moc.id} and user ${recipient.id}:`,
          error
        );
      }
    }

    if (
      successfulDeliveries === 0
    ) {
      skipped += 1;
      continue;
    }

    verificationOverdueAlertsSent +=
      1;

    await logActivity({
      organizationId:
        moc.organizationId,

      userId: null,

      action:
        ActivityAction.SYSTEM,

      entityType:
        "ManagementOfChange",

      entityId:
        moc.id,

      title:
        activityTitle,

      description:
        `An overdue verification alert was sent for ${moc.reference}.`,

      metadata: {
        mocId:
          moc.id,

        mocReference:
          moc.reference,

        plannedCompletionDate:
          moc.plannedCompletionDate.toISOString(),

        notificationKind:
          "VERIFICATION_OVERDUE",

        recipientCount:
          recipients.length,

        processedAt:
          now.toISOString(),
      },
    });
  }

  return {
    checked:
      tasks.length +
      approvals.length +
      temporaryChanges.length +
      scheduledChanges.length +
      verificationChanges.length,

    taskRemindersSent,
    taskOverdueAlertsSent,
    approvalRemindersSent,

    temporary30DayRemindersSent,
    temporary7DayRemindersSent,
    temporaryExpirationAlertsSent,

    plannedCompletionRemindersSent,
    plannedCompletionOverdueAlertsSent,
    verificationOverdueAlertsSent,

    inAppNotificationsSent,
    emailsSent,
    skipped,
  };
}