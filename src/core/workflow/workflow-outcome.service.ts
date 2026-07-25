import { createSenzilyticsEmailTemplate } from "@/core/email/email-template";
import {
  getApplicationUrl,
  sendTenantNotificationEmail,
} from "@/core/email/email.service";
import { createNotification } from "@/core/notifications/notifications.service";
import {
  readWorkflowOutcomeConfiguration,
  type WorkflowOutcomeConfiguration,
} from "@/core/workflow/workflow-outcome-config";
import { sanitizeWorkflowAutomationContext } from "@/core/workflow/workflow-automation-rules";
import { prisma } from "@/lib/prisma";
import { planEntitlements } from "@/lib/subscription";
import { enqueueActivityWebhooks } from "@/modules/integrations/webhook-delivery.service";
import { getNextRiskReference } from "@/modules/risk/risk.repository";
import { calculateRiskRating } from "@/modules/risk/risk-scoring";
import {
  ActivityAction,
  ComplianceCalendarOccurrenceStatus,
  ComplianceRecurrence,
  NotificationType,
  PermissionKey,
  Prisma,
  RiskReviewFrequency,
  RiskStatus,
  Status,
  UserRole,
  WorkflowEntityType,
  WorkflowOutcomeEvent,
  WorkflowOutcomeExecutionStatus,
} from "@prisma/client";

const MAX_ATTEMPTS = 3;
const DEFAULT_BATCH_SIZE = 40;
const STALE_PROCESSING_MINUTES = 15;

type OutcomeExecution = Prisma.WorkflowOutcomeExecutionGetPayload<{
  include: {
    definition: true;
    workflowInstance: true;
    workflowStep: true;
  };
}>;

export async function queueWorkflowOutcomeExecutions(input: {
  organizationId: string;
  workflowInstanceId: string;
  workflowInstanceStepId?: string | null;
  templateStepId: string;
  event: WorkflowOutcomeEvent;
  context?: Record<string, unknown>;
}) {
  const definitions = await prisma.workflowOutcomeDefinition.findMany({
    where: {
      templateStepId: input.templateStepId,
      event: input.event,
      isActive: true,
      templateStep: {
        template: {
          organizationId: input.organizationId,
        },
      },
    },
    select: {
      id: true,
      requiresApproval: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  if (!definitions.length) return 0;

  const context = sanitizeWorkflowAutomationContext(input.context ?? {});
  const result = await prisma.workflowOutcomeExecution.createMany({
    data: definitions.map((definition) => ({
      organizationId: input.organizationId,
      definitionId: definition.id,
      workflowInstanceId: input.workflowInstanceId,
      workflowInstanceStepId: input.workflowInstanceStepId ?? null,
      event: input.event,
      status: definition.requiresApproval
        ? WorkflowOutcomeExecutionStatus.AWAITING_APPROVAL
        : WorkflowOutcomeExecutionStatus.PENDING,
      context: context as Prisma.InputJsonValue,
      idempotencyKey: [
        input.workflowInstanceId,
        input.workflowInstanceStepId ?? "workflow",
        input.event,
        definition.id,
      ].join(":"),
    })),
    skipDuplicates: true,
  });
  return result.count;
}

export async function queueWorkflowOutcomesSafely(
  input: Parameters<typeof queueWorkflowOutcomeExecutions>[0],
) {
  try {
    return await queueWorkflowOutcomeExecutions(input);
  } catch (error) {
    console.error(
      `Workflow outcome queueing failed for instance ${input.workflowInstanceId}:`,
      error,
    );
    return 0;
  }
}

export async function processWorkflowOutcomeExecutions(input?: {
  organizationId?: string;
  executionId?: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(input?.limit ?? DEFAULT_BATCH_SIZE, 1), 100);
  const approvalRequestsSent = await requestPendingApprovals(
    input?.organizationId,
  );
  const staleBefore = new Date(
    Date.now() - STALE_PROCESSING_MINUTES * 60 * 1000,
  );
  const executions = await prisma.workflowOutcomeExecution.findMany({
    where: {
      ...(input?.organizationId
        ? { organizationId: input.organizationId }
        : {}),
      ...(input?.executionId ? { id: input.executionId } : {}),
      attempts: { lt: MAX_ATTEMPTS },
      OR: [
        { status: WorkflowOutcomeExecutionStatus.PENDING },
        { status: WorkflowOutcomeExecutionStatus.FAILED },
        {
          status: WorkflowOutcomeExecutionStatus.PROCESSING,
          updatedAt: { lt: staleBefore },
        },
      ],
    },
    include: {
      definition: true,
      workflowInstance: true,
      workflowStep: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
  });

  let completed = 0;
  let failed = 0;
  let skipped = 0;

  for (const execution of executions) {
    if (execution.definition.requiresApproval && !execution.approvedAt) {
      skipped += 1;
      continue;
    }
    const claimed = await prisma.workflowOutcomeExecution.updateMany({
      where: {
        id: execution.id,
        attempts: { lt: MAX_ATTEMPTS },
        OR: [
          { status: WorkflowOutcomeExecutionStatus.PENDING },
          { status: WorkflowOutcomeExecutionStatus.FAILED },
          {
            status: WorkflowOutcomeExecutionStatus.PROCESSING,
            updatedAt: { lt: staleBefore },
          },
        ],
      },
      data: {
        status: WorkflowOutcomeExecutionStatus.PROCESSING,
        attempts: { increment: 1 },
        lastError: null,
      },
    });
    if (claimed.count !== 1) {
      skipped += 1;
      continue;
    }

    try {
      const output = await executeOutcome(execution);
      await prisma.$transaction([
        prisma.workflowOutcomeExecution.update({
          where: { id: execution.id },
          data: {
            status: WorkflowOutcomeExecutionStatus.COMPLETED,
            output: output as Prisma.InputJsonValue,
            processedAt: new Date(),
            lastError: null,
          },
        }),
        prisma.activityLog.create({
          data: {
            organizationId: execution.organizationId,
            userId: execution.approvedById,
            action: ActivityAction.SYSTEM,
            entityType: "WorkflowOutcomeExecution",
            entityId: execution.id,
            title: "Workflow outcome completed",
            description: execution.definition.name,
            metadata: {
              definitionId: execution.definitionId,
              outcomeType: execution.definition.outcomeType,
              workflowInstanceId: execution.workflowInstanceId,
              sourceEntityType: execution.workflowInstance.entityType,
              sourceEntityId: execution.workflowInstance.entityId,
              output,
            },
          },
        }),
      ]);
      completed += 1;
    } catch (error) {
      console.error(
        `Workflow outcome execution ${execution.id} failed:`,
        error,
      );
      await prisma.$transaction([
        prisma.workflowOutcomeExecution.update({
          where: { id: execution.id },
          data: {
            status: WorkflowOutcomeExecutionStatus.FAILED,
            lastError:
              "Outcome execution failed. Review its configuration before retrying.",
          },
        }),
        prisma.activityLog.create({
          data: {
            organizationId: execution.organizationId,
            userId: execution.approvedById,
            action: ActivityAction.SYSTEM,
            entityType: "WorkflowOutcomeExecution",
            entityId: execution.id,
            title: "Workflow outcome failed",
            description: execution.definition.name,
            metadata: {
              definitionId: execution.definitionId,
              outcomeType: execution.definition.outcomeType,
              workflowInstanceId: execution.workflowInstanceId,
            },
          },
        }),
      ]);
      failed += 1;
    }
  }

  return {
    checked: executions.length,
    completed,
    failed,
    skipped,
    approvalRequestsSent,
  };
}

async function executeOutcome(execution: OutcomeExecution) {
  const configuration = readWorkflowOutcomeConfiguration(
    execution.definition.outcomeType,
    execution.definition.configuration,
  );
  switch (configuration.type) {
    case "CREATE_TASK":
      return createGeneratedTask(execution, configuration);
    case "CREATE_CORRECTIVE_ACTION":
      return createCorrectiveAction(execution, configuration);
    case "CREATE_RISK_DRAFT":
      return createRiskDraft(execution, configuration);
    case "CREATE_COMPLIANCE_TASK":
      return createComplianceTask(execution, configuration);
    case "SEND_NOTIFICATION":
      return sendOutcomeNotification(execution, configuration);
    case "UPDATE_SOURCE_STATUS":
      return updateSourceStatus(execution, configuration);
    case "EMIT_WEBHOOK":
      return emitOutcomeWebhook(execution, configuration);
  }
}

async function createGeneratedTask(
  execution: OutcomeExecution,
  configuration: Extract<
    WorkflowOutcomeConfiguration,
    { type: "CREATE_TASK" }
  >,
) {
  if (configuration.assignedUserId) {
    await requireTenantUser(
      execution.organizationId,
      configuration.assignedUserId,
    );
  }
  const task = await prisma.workflowGeneratedTask.upsert({
    where: {
      outcomeExecutionId: execution.id,
    },
    update: {},
    create: {
      id: outcomeRecordId("task", execution.id),
      organizationId: execution.organizationId,
      outcomeExecutionId: execution.id,
      sourceEntityType: execution.workflowInstance.entityType,
      sourceEntityId: execution.workflowInstance.entityId,
      title: configuration.title,
      description: configuration.description,
      assignedUserId: configuration.assignedUserId,
      assignedRole: configuration.assignedRole,
      dueAt: dueDate(configuration.dueInDays),
    },
  });
  await logCreatedRecord(execution, "WorkflowGeneratedTask", task.id, task.title);
  return {
    createdEntityType: "WORKFLOW_TASK",
    createdEntityId: task.id,
    dueAt: task.dueAt?.toISOString() ?? null,
  };
}

async function createCorrectiveAction(
  execution: OutcomeExecution,
  configuration: Extract<
    WorkflowOutcomeConfiguration,
    { type: "CREATE_CORRECTIVE_ACTION" }
  >,
) {
  await requireTenantUser(
    execution.organizationId,
    configuration.assignedUserId,
  );
  const id = outcomeRecordId("capa", execution.id);
  const existing = await prisma.correctiveAction.findUnique({ where: { id } });
  const action =
    existing ??
    (await prisma.correctiveAction.create({
      data: {
        id,
        title: configuration.title,
        description: configuration.description,
        riskLevel: configuration.riskLevel,
        dueDate: dueDate(configuration.dueInDays),
        status: Status.OPEN,
        assignedToId: configuration.assignedUserId,
      },
    }));
  await logCreatedRecord(execution, "CorrectiveAction", action.id, action.title);
  return {
    createdEntityType: "CORRECTIVE_ACTION",
    createdEntityId: action.id,
    dueAt: action.dueDate.toISOString(),
  };
}

async function createRiskDraft(
  execution: OutcomeExecution,
  configuration: Extract<
    WorkflowOutcomeConfiguration,
    { type: "CREATE_RISK_DRAFT" }
  >,
) {
  await validateTenantResources(execution.organizationId, {
    userId: configuration.ownerId,
    siteId: configuration.siteId,
    departmentId: configuration.departmentId,
  });
  const id = outcomeRecordId("risk", execution.id);
  const existing = await prisma.risk.findUnique({ where: { id } });
  if (existing) {
    return {
      createdEntityType: "RISK",
      createdEntityId: existing.id,
      reference: existing.reference,
    };
  }
  const [rating, reference] = await Promise.all([
    Promise.resolve(
      calculateRiskRating({
        likelihood: configuration.likelihood,
        impact: configuration.impact,
      }),
    ),
    getNextRiskReference(execution.organizationId),
  ]);
  const risk = await prisma.risk.create({
    data: {
      id,
      reference,
      title: configuration.title,
      description: configuration.description,
      category: configuration.riskCategory,
      status: RiskStatus.DRAFT,
      organizationId: execution.organizationId,
      siteId: configuration.siteId,
      departmentId: configuration.departmentId,
      ownerId: configuration.ownerId,
      initialLikelihood: configuration.likelihood,
      initialImpact: configuration.impact,
      initialScore: rating.score,
      initialRiskLevel: rating.riskLevel,
      currentLikelihood: configuration.likelihood,
      currentImpact: configuration.impact,
      currentScore: rating.score,
      currentRiskLevel: rating.riskLevel,
      residualLikelihood: configuration.likelihood,
      residualImpact: configuration.impact,
      residualScore: rating.score,
      residualRiskLevel: rating.riskLevel,
      reviewFrequency: RiskReviewFrequency.ANNUAL,
    },
  });
  await logCreatedRecord(execution, "Risk", risk.id, risk.title);
  return {
    createdEntityType: "RISK",
    createdEntityId: risk.id,
    reference: risk.reference,
  };
}

async function createComplianceTask(
  execution: OutcomeExecution,
  configuration: Extract<
    WorkflowOutcomeConfiguration,
    { type: "CREATE_COMPLIANCE_TASK" }
  >,
) {
  await validateTenantResources(execution.organizationId, {
    userId: configuration.ownerId,
    siteId: configuration.siteId,
    departmentId: configuration.departmentId,
  });
  const taskId = outcomeRecordId("calendar", execution.id);
  const occurrenceId = outcomeRecordId("occurrence", execution.id);
  const dueAt = dueDate(configuration.dueInDays);
  const existing = await prisma.complianceCalendarTask.findUnique({
    where: { id: taskId },
  });
  if (!existing) {
    await prisma.$transaction(async (tx) => {
      await tx.complianceCalendarTask.create({
        data: {
          id: taskId,
          organizationId: execution.organizationId,
          siteId: configuration.siteId,
          departmentId: configuration.departmentId,
          ownerId: configuration.ownerId,
          title: configuration.title,
          description: configuration.description,
          category: configuration.category,
          approvalRequired: true,
          recurrence: ComplianceRecurrence.ONE_TIME,
          intervalValue: 1,
          startDate: dueAt,
          reminderDaysBefore: 7,
          escalationDaysAfter: 1,
          nextOccurrenceAt: null,
        },
      });
      await tx.complianceCalendarOccurrence.create({
        data: {
          id: occurrenceId,
          organizationId: execution.organizationId,
          taskId,
          siteId: configuration.siteId,
          departmentId: configuration.departmentId,
          assignedToId: configuration.ownerId,
          dueAt,
          status:
            dueAt < new Date()
              ? ComplianceCalendarOccurrenceStatus.DUE
              : ComplianceCalendarOccurrenceStatus.UPCOMING,
        },
      });
    });
  }
  await logCreatedRecord(
    execution,
    "ComplianceCalendarTask",
    taskId,
    configuration.title,
  );
  return {
    createdEntityType: "COMPLIANCE_CALENDAR_TASK",
    createdEntityId: taskId,
    occurrenceId,
    dueAt: dueAt.toISOString(),
  };
}

async function sendOutcomeNotification(
  execution: OutcomeExecution,
  configuration: Extract<
    WorkflowOutcomeConfiguration,
    { type: "SEND_NOTIFICATION" }
  >,
) {
  const recipient = await requireTenantUser(
    execution.organizationId,
    configuration.recipientUserId,
  );
  const notificationId = outcomeRecordId("notification", execution.id);
  const organization = await prisma.organization.findUnique({
    where: { id: execution.organizationId },
    select: { subscriptionPlan: true },
  });
  if (
    organization &&
    planEntitlements[organization.subscriptionPlan].IN_APP_NOTIFICATIONS
  ) {
    await prisma.notification.upsert({
      where: { id: notificationId },
      update: {},
      create: {
        id: notificationId,
        organizationId: execution.organizationId,
        userId: recipient.id,
        type: configuration.notificationType,
        title: configuration.title,
        message: configuration.message,
        link: workflowEntityLink(
          execution.workflowInstance.entityType,
          execution.workflowInstance.entityId,
        ),
      },
    });
    if (planEntitlements[organization.subscriptionPlan].MOBILE_APPS) {
      const tokens = await prisma.mobilePushToken.findMany({
        where: {
          organizationId: execution.organizationId,
          userId: recipient.id,
          enabled: true,
          session: {
            status: "ACTIVE",
            expiresAt: { gt: new Date() },
          },
        },
        select: { id: true },
      });
      if (tokens.length) {
        await prisma.mobilePushDelivery.createMany({
          data: tokens.map((token) => ({
            organizationId: execution.organizationId,
            userId: recipient.id,
            pushTokenId: token.id,
            notificationId,
            payload: {
              notificationId,
              link: workflowEntityLink(
                execution.workflowInstance.entityType,
                execution.workflowInstance.entityId,
              ),
              type: configuration.notificationType,
            },
          })),
          skipDuplicates: true,
        });
      }
    }
  }

  let emailStatus = "NOT_REQUESTED";
  if (configuration.sendEmail && recipient.email) {
    const priorOutput = jsonRecord(execution.output);
    if (!priorOutput.emailDispatchStartedAt) {
      const emailDispatchStartedAt = new Date().toISOString();
      await prisma.workflowOutcomeExecution.update({
        where: { id: execution.id },
        data: {
          output: {
            notificationId,
            emailDispatchStartedAt,
          },
        },
      });
      const result = await sendTenantNotificationEmail({
        to: recipient.email,
        subject: configuration.title,
        html: createSenzilyticsEmailTemplate({
          preheader: configuration.title,
          heading: configuration.title,
          body: configuration.message,
          actionLabel: "Open Senzilytics",
          actionUrl: `${getApplicationUrl()}${workflowEntityLink(
            execution.workflowInstance.entityType,
            execution.workflowInstance.entityId,
          )}`,
        }),
        text: configuration.message,
      });
      emailStatus = result.success ? "SENT" : "FAILED";
    } else {
      emailStatus = "ALREADY_DISPATCHED";
    }
  }
  return {
    notificationId,
    recipientUserId: recipient.id,
    emailStatus,
  };
}

async function updateSourceStatus(
  execution: OutcomeExecution,
  configuration: Extract<
    WorkflowOutcomeConfiguration,
    { type: "UPDATE_SOURCE_STATUS" }
  >,
) {
  const source = execution.workflowInstance;
  let count = 0;
  if (source.entityType === WorkflowEntityType.INCIDENT) {
    count = (
      await prisma.incident.updateMany({
        where: {
          id: source.entityId,
          site: { organizationId: execution.organizationId },
        },
        data: { status: configuration.targetStatus },
      })
    ).count;
  } else if (source.entityType === WorkflowEntityType.INSPECTION) {
    count = (
      await prisma.inspection.updateMany({
        where: {
          id: source.entityId,
          site: { organizationId: execution.organizationId },
        },
        data: { status: configuration.targetStatus },
      })
    ).count;
  } else if (source.entityType === WorkflowEntityType.CORRECTIVE_ACTION) {
    count = (
      await prisma.correctiveAction.updateMany({
        where: {
          id: source.entityId,
          assignedTo: { organizationId: execution.organizationId },
        },
        data: { status: configuration.targetStatus },
      })
    ).count;
  } else {
    throw new Error(
      "Automated status updates currently support incidents, inspections, and CAPA records.",
    );
  }
  if (count !== 1) throw new Error("The tenant source record was not found.");
  await logCreatedRecord(
    execution,
    source.entityType,
    source.entityId,
    `Status changed to ${configuration.targetStatus}`,
    ActivityAction.STATUS_CHANGE,
  );
  return {
    updatedEntityType: source.entityType,
    updatedEntityId: source.entityId,
    status: configuration.targetStatus,
  };
}

async function emitOutcomeWebhook(
  execution: OutcomeExecution,
  configuration: Extract<
    WorkflowOutcomeConfiguration,
    { type: "EMIT_WEBHOOK" }
  >,
) {
  const activity = await prisma.activityLog.upsert({
    where: {
      id: outcomeRecordId("webhook", execution.id),
    },
    update: {},
    create: {
      id: outcomeRecordId("webhook", execution.id),
      organizationId: execution.organizationId,
      userId: execution.approvedById,
      action: ActivityAction.SYSTEM,
      entityType: "WorkflowOutcome",
      entityId: execution.id,
      title: configuration.title,
      description: configuration.message,
      metadata: {
        workflowInstanceId: execution.workflowInstanceId,
        sourceEntityType: execution.workflowInstance.entityType,
        sourceEntityId: execution.workflowInstance.entityId,
      },
    },
  });
  const queuedDeliveries = await enqueueActivityWebhooks(activity);
  return {
    activityId: activity.id,
    queuedDeliveries,
  };
}

async function requestPendingApprovals(organizationId?: string) {
  const executions = await prisma.workflowOutcomeExecution.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      status: WorkflowOutcomeExecutionStatus.AWAITING_APPROVAL,
      approvalRequestedAt: null,
    },
    include: {
      definition: true,
      workflowInstance: true,
    },
    orderBy: { createdAt: "asc" },
    take: 25,
  });
  let sent = 0;
  for (const execution of executions) {
    const roleRows = await prisma.rolePermission.findMany({
      where: { permission: PermissionKey.MANAGE_WORKFLOWS },
      select: { role: true },
    });
    const roles = Array.from(
      new Set([...roleRows.map((row) => row.role), UserRole.SUPER_ADMIN]),
    );
    const reviewers = await prisma.user.findMany({
      where: {
        organizationId: execution.organizationId,
        isActive: true,
        role: { in: roles },
      },
      select: { id: true },
    });
    await Promise.all(
      reviewers.map((reviewer) =>
        createNotification({
          organizationId: execution.organizationId,
          userId: reviewer.id,
          type: NotificationType.SYSTEM,
          title: "Workflow outcome awaiting approval",
          message: `${execution.definition.name} requires review before execution.`,
          link: `/workflows/sla?outcome=${execution.id}`,
        }),
      ),
    );
    await prisma.workflowOutcomeExecution.updateMany({
      where: {
        id: execution.id,
        approvalRequestedAt: null,
      },
      data: { approvalRequestedAt: new Date() },
    });
    sent += 1;
  }
  return sent;
}

async function requireTenantUser(organizationId: string, userId: string) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
  if (!user) throw new Error("The configured tenant user is unavailable.");
  return user;
}

async function validateTenantResources(
  organizationId: string,
  input: {
    userId?: string;
    siteId?: string;
    departmentId?: string;
  },
) {
  const [user, site, department] = await Promise.all([
    input.userId ? requireTenantUser(organizationId, input.userId) : null,
    input.siteId
      ? prisma.site.findFirst({
          where: { id: input.siteId, organizationId },
          select: { id: true },
        })
      : null,
    input.departmentId
      ? prisma.department.findFirst({
          where: {
            id: input.departmentId,
            site: { organizationId },
          },
          select: { id: true, siteId: true },
        })
      : null,
  ]);
  if (input.userId && !user) throw new Error("The configured user is invalid.");
  if (input.siteId && !site) throw new Error("The configured site is invalid.");
  if (input.departmentId && !department) {
    throw new Error("The configured department is invalid.");
  }
  if (department && input.siteId && department.siteId !== input.siteId) {
    throw new Error("The configured department does not belong to the site.");
  }
}

async function logCreatedRecord(
  execution: OutcomeExecution,
  entityType: string,
  entityId: string,
  description: string,
  action: ActivityAction = ActivityAction.CREATE,
) {
  const activityId = outcomeRecordId(
    `activity_${entityType.toLowerCase()}`,
    execution.id,
  );
  const activity = await prisma.activityLog.upsert({
    where: { id: activityId },
    update: {},
    create: {
      id: activityId,
      organizationId: execution.organizationId,
      userId: execution.approvedById,
      action,
      entityType,
      entityId,
      title: "Automated workflow outcome",
      description,
      metadata: {
        workflowOutcomeExecutionId: execution.id,
        workflowInstanceId: execution.workflowInstanceId,
        sourceEntityType: execution.workflowInstance.entityType,
        sourceEntityId: execution.workflowInstance.entityId,
      },
    },
  });
  try {
    await enqueueActivityWebhooks(activity);
  } catch (error) {
    console.error("Workflow outcome webhook enqueue failed:", error);
  }
}

function dueDate(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1_000);
}

function outcomeRecordId(prefix: string, executionId: string) {
  return `wfo_${prefix}_${executionId}`;
}

function jsonRecord(value: Prisma.JsonValue | null) {
  return value && !Array.isArray(value) && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function workflowEntityLink(type: WorkflowEntityType, id: string) {
  switch (type) {
    case WorkflowEntityType.INCIDENT:
      return `/incidents/${id}`;
    case WorkflowEntityType.CORRECTIVE_ACTION:
      return `/actions/${id}`;
    case WorkflowEntityType.AUDIT:
      return `/audits/${id}`;
    case WorkflowEntityType.INSPECTION:
      return `/inspections/${id}`;
    case WorkflowEntityType.COMPLIANCE:
      return `/compliance/${id}`;
    case WorkflowEntityType.TRAINING:
      return `/training/${id}`;
    case WorkflowEntityType.PERMIT:
      return `/permits-to-work/${id}`;
    case WorkflowEntityType.CHEMICAL:
      return `/chemicals/${id}`;
    case WorkflowEntityType.ENVIRONMENTAL:
      return `/environmental/${id}`;
    case WorkflowEntityType.MOC:
      return `/moc/${id}`;
    case WorkflowEntityType.OBSERVATION:
      return `/observations/${id}`;
    case WorkflowEntityType.RISK:
      return `/risks/${id}`;
    default:
      return "/tasks";
  }
}

export const workflowOutcomeExecutionLimit = MAX_ATTEMPTS;
