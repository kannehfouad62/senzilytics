"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { logActivity } from "@/core/activity-log/activity-log.service";
import {
  parseWorkflowOutcomeDefinitionInput,
  workflowOutcomeConfigurationJson,
  type WorkflowOutcomeConfiguration,
} from "@/core/workflow/workflow-outcome-config";
import { processWorkflowOutcomeExecutions } from "@/core/workflow/workflow-outcome.service";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  ActivityAction,
  PermissionKey,
  WorkflowEntityType,
  WorkflowGeneratedTaskStatus,
  WorkflowOutcomeExecutionStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

const statusOutcomeEntities = new Set<WorkflowEntityType>([
  WorkflowEntityType.INCIDENT,
  WorkflowEntityType.INSPECTION,
  WorkflowEntityType.CORRECTIVE_ACTION,
]);
const generatedTaskTransitions = new Set<WorkflowGeneratedTaskStatus>([
  WorkflowGeneratedTaskStatus.IN_PROGRESS,
  WorkflowGeneratedTaskStatus.COMPLETED,
  WorkflowGeneratedTaskStatus.CANCELLED,
]);

export async function createWorkflowOutcomeDefinition(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);
  const { organizationId, user } = await getCurrentUserTenant();
  const workflowId = required(formData, "workflowId");
  const stepId = required(formData, "stepId");
  const parsed = parseWorkflowOutcomeDefinitionInput({
    name: text(formData, "name"),
    event: text(formData, "event"),
    outcomeType: text(formData, "outcomeType"),
    title: text(formData, "title"),
    description: text(formData, "description"),
    assignedUserId: text(formData, "assignedUserId"),
    assignedRole: text(formData, "assignedRole"),
    dueInDays: text(formData, "dueInDays"),
    riskLevel: text(formData, "riskLevel"),
    riskCategory: text(formData, "riskCategory"),
    likelihood: text(formData, "likelihood"),
    impact: text(formData, "impact"),
    siteId: text(formData, "siteId"),
    departmentId: text(formData, "departmentId"),
    targetStatus: text(formData, "targetStatus"),
    notificationType: text(formData, "notificationType"),
    sendEmail: formData.get("sendEmail") === "on",
    requiresApproval: formData.get("requiresApproval") === "on",
  });
  const step = await prisma.workflowTemplateStep.findFirst({
    where: {
      id: stepId,
      templateId: workflowId,
      template: { organizationId },
    },
    include: {
      template: {
        select: {
          entityType: true,
        },
      },
      _count: {
        select: {
          outcomes: true,
        },
      },
    },
  });
  if (!step) throw new Error("Workflow step not found.");
  if (step._count.outcomes >= 10) {
    throw new Error("A workflow step can have at most ten outcomes.");
  }
  if (
    parsed.configuration.type === "UPDATE_SOURCE_STATUS" &&
    !statusOutcomeEntities.has(step.template.entityType)
  ) {
    throw new Error(
      "Automated status updates currently support incident, inspection, and CAPA workflows.",
    );
  }
  await validateConfiguredResources(
    organizationId,
    parsed.configuration,
  );

  await prisma.$transaction(async (tx) => {
    const definition = await tx.workflowOutcomeDefinition.create({
      data: {
        templateStepId: step.id,
        name: parsed.name,
        event: parsed.event,
        outcomeType: parsed.outcomeType,
        configuration: workflowOutcomeConfigurationJson(
          parsed.configuration,
        ),
        requiresApproval: parsed.requiresApproval,
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId,
        userId: user.id,
        action: ActivityAction.CREATE,
        entityType: "WorkflowOutcomeDefinition",
        entityId: definition.id,
        title: "Workflow outcome configured",
        description: definition.name,
        metadata: {
          workflowId,
          stepId,
          event: definition.event,
          outcomeType: definition.outcomeType,
          requiresApproval: definition.requiresApproval,
        },
      },
    });
  });
  revalidatePath(`/workflows/${workflowId}`);
}

export async function createWorkflowOutcomeDefinitionWithFeedback(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  try {
    await createWorkflowOutcomeDefinition(formData);
    return {
      status: "SUCCESS",
      message: "Automated outcome added to the workflow step.",
    };
  } catch (error) {
    return actionError(
      error,
      "The automated outcome could not be created.",
    );
  }
}

export async function toggleWorkflowOutcomeDefinition(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);
  const { organizationId, user } = await getCurrentUserTenant();
  const workflowId = required(formData, "workflowId");
  const definitionId = required(formData, "definitionId");
  const definition = await prisma.workflowOutcomeDefinition.findFirst({
    where: {
      id: definitionId,
      templateStep: {
        templateId: workflowId,
        template: { organizationId },
      },
    },
  });
  if (!definition) throw new Error("Workflow outcome not found.");
  const updated = await prisma.workflowOutcomeDefinition.update({
    where: { id: definition.id },
    data: { isActive: !definition.isActive },
  });
  await logActivity({
    organizationId,
    userId: user.id,
    action: ActivityAction.UPDATE,
    entityType: "WorkflowOutcomeDefinition",
    entityId: definition.id,
    title: updated.isActive
      ? "Workflow outcome activated"
      : "Workflow outcome deactivated",
    description: definition.name,
    metadata: { workflowId },
  });
  revalidatePath(`/workflows/${workflowId}`);
}

export async function deleteWorkflowOutcomeDefinition(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);
  const { organizationId, user } = await getCurrentUserTenant();
  const workflowId = required(formData, "workflowId");
  const definitionId = required(formData, "definitionId");
  const definition = await prisma.workflowOutcomeDefinition.findFirst({
    where: {
      id: definitionId,
      templateStep: {
        templateId: workflowId,
        template: { organizationId },
      },
    },
    include: {
      _count: { select: { executions: true } },
    },
  });
  if (!definition) throw new Error("Workflow outcome not found.");
  if (definition._count.executions > 0) {
    throw new Error(
      "This outcome has execution history and cannot be deleted. Deactivate it instead.",
    );
  }
  await prisma.workflowOutcomeDefinition.delete({
    where: { id: definition.id },
  });
  await logActivity({
    organizationId,
    userId: user.id,
    action: ActivityAction.DELETE,
    entityType: "WorkflowOutcomeDefinition",
    entityId: definition.id,
    title: "Workflow outcome deleted",
    description: definition.name,
    metadata: { workflowId },
  });
  revalidatePath(`/workflows/${workflowId}`);
}

export async function reviewWorkflowOutcomeExecution(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);
  const { organizationId, user } = await getCurrentUserTenant();
  const executionId = required(formData, "executionId");
  const decision = required(formData, "decision");
  const notes = bounded(text(formData, "reviewNotes"), 1_000);
  if (decision !== "APPROVE" && decision !== "REJECT") {
    throw new Error("Select a valid outcome decision.");
  }
  const execution = await prisma.workflowOutcomeExecution.findFirst({
    where: {
      id: executionId,
      organizationId,
      status: WorkflowOutcomeExecutionStatus.AWAITING_APPROVAL,
    },
    include: {
      definition: true,
    },
  });
  if (!execution) {
    throw new Error("The pending workflow outcome was not found.");
  }
  if (decision === "APPROVE") {
    await prisma.workflowOutcomeExecution.update({
      where: { id: execution.id },
      data: {
        status: WorkflowOutcomeExecutionStatus.PENDING,
        approvedById: user.id,
        approvedAt: new Date(),
        reviewNotes: notes || null,
      },
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.STATUS_CHANGE,
      entityType: "WorkflowOutcomeExecution",
      entityId: execution.id,
      title: "Workflow outcome approved",
      description: execution.definition.name,
    });
    await processWorkflowOutcomeExecutions({
      organizationId,
      executionId: execution.id,
      limit: 1,
    });
  } else {
    await prisma.workflowOutcomeExecution.update({
      where: { id: execution.id },
      data: {
        status: WorkflowOutcomeExecutionStatus.REJECTED,
        rejectedById: user.id,
        rejectedAt: new Date(),
        reviewNotes: notes || null,
      },
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.STATUS_CHANGE,
      entityType: "WorkflowOutcomeExecution",
      entityId: execution.id,
      title: "Workflow outcome rejected",
      description: execution.definition.name,
    });
  }
  revalidatePath("/workflows/sla");
}

export async function retryWorkflowOutcomeExecution(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);
  const { organizationId, user } = await getCurrentUserTenant();
  const executionId = required(formData, "executionId");
  const execution = await prisma.workflowOutcomeExecution.findFirst({
    where: {
      id: executionId,
      organizationId,
      status: WorkflowOutcomeExecutionStatus.FAILED,
    },
    include: { definition: true },
  });
  if (!execution) throw new Error("Failed workflow outcome not found.");
  await prisma.workflowOutcomeExecution.update({
    where: { id: execution.id },
    data: {
      status: WorkflowOutcomeExecutionStatus.PENDING,
      attempts: 0,
      lastError: null,
    },
  });
  await logActivity({
    organizationId,
    userId: user.id,
    action: ActivityAction.UPDATE,
    entityType: "WorkflowOutcomeExecution",
    entityId: execution.id,
    title: "Workflow outcome requeued",
    description: execution.definition.name,
  });
  await processWorkflowOutcomeExecutions({
    organizationId,
    executionId: execution.id,
    limit: 1,
  });
  revalidatePath("/workflows/sla");
}

export async function updateWorkflowGeneratedTask(formData: FormData) {
  const [{ organizationId, user }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const taskId = required(formData, "taskId");
  const nextStatus = required(formData, "status") as WorkflowGeneratedTaskStatus;
  if (!generatedTaskTransitions.has(nextStatus)) {
    throw new Error("Select a valid generated-task status.");
  }
  const task = await prisma.workflowGeneratedTask.findFirst({
    where: { id: taskId, organizationId },
  });
  if (!task) throw new Error("Generated workflow task not found.");
  if (
    task.status === WorkflowGeneratedTaskStatus.COMPLETED ||
    task.status === WorkflowGeneratedTaskStatus.CANCELLED
  ) {
    throw new Error("This generated workflow task is already closed.");
  }
  const canManage = permissions.includes(PermissionKey.MANAGE_WORKFLOWS);
  const canAct =
    canManage ||
    task.assignedUserId === user.id ||
    (!task.assignedUserId && task.assignedRole === user.role);
  if (!canAct) throw new Error("You are not assigned to this workflow task.");
  if (nextStatus === WorkflowGeneratedTaskStatus.CANCELLED && !canManage) {
    throw new Error("Only a workflow administrator can cancel this task.");
  }
  const completed =
    nextStatus === WorkflowGeneratedTaskStatus.COMPLETED ||
    nextStatus === WorkflowGeneratedTaskStatus.CANCELLED;
  await prisma.workflowGeneratedTask.update({
    where: { id: task.id },
    data: {
      status: nextStatus,
      completedById: completed ? user.id : null,
      completedAt: completed ? new Date() : null,
      completionNotes: completed
        ? bounded(text(formData, "completionNotes"), 1_000) || null
        : null,
    },
  });
  await logActivity({
    organizationId,
    userId: user.id,
    action: ActivityAction.STATUS_CHANGE,
    entityType: "WorkflowGeneratedTask",
    entityId: task.id,
    title: "Generated workflow task updated",
    description: `${task.title}: ${task.status} → ${nextStatus}`,
  });
  revalidatePath("/tasks");
  revalidatePath("/compliance/calendar");
}

async function validateConfiguredResources(
  organizationId: string,
  configuration: WorkflowOutcomeConfiguration,
) {
  const userId =
    configuration.type === "CREATE_TASK"
      ? configuration.assignedUserId
      : configuration.type === "CREATE_CORRECTIVE_ACTION"
        ? configuration.assignedUserId
        : configuration.type === "CREATE_RISK_DRAFT" ||
            configuration.type === "CREATE_COMPLIANCE_TASK"
          ? configuration.ownerId
          : configuration.type === "SEND_NOTIFICATION"
            ? configuration.recipientUserId
            : undefined;
  const siteId =
    configuration.type === "CREATE_RISK_DRAFT" ||
    configuration.type === "CREATE_COMPLIANCE_TASK"
      ? configuration.siteId
      : undefined;
  const departmentId =
    configuration.type === "CREATE_RISK_DRAFT" ||
    configuration.type === "CREATE_COMPLIANCE_TASK"
      ? configuration.departmentId
      : undefined;
  const [user, site, department] = await Promise.all([
    userId
      ? prisma.user.findFirst({
          where: { id: userId, organizationId, isActive: true },
          select: { id: true },
        })
      : null,
    siteId
      ? prisma.site.findFirst({
          where: { id: siteId, organizationId },
          select: { id: true },
        })
      : null,
    departmentId
      ? prisma.department.findFirst({
          where: { id: departmentId, site: { organizationId } },
          select: { id: true, siteId: true },
        })
      : null,
  ]);
  if (userId && !user) throw new Error("Select a valid tenant user.");
  if (siteId && !site) throw new Error("Select a valid tenant site.");
  if (departmentId && !department) {
    throw new Error("Select a valid tenant department.");
  }
  if (department && siteId && department.siteId !== siteId) {
    throw new Error("The selected department does not belong to the site.");
  }
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function required(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function bounded(value: string, maximum: number) {
  if (value.length > maximum) {
    throw new Error(`Text must be ${maximum} characters or fewer.`);
  }
  return value;
}

function actionError(error: unknown, fallback: string): FormActionState {
  return {
    status: "ERROR",
    message: error instanceof Error ? error.message : fallback,
  };
}
