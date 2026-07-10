import { prisma } from "@/lib/prisma";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { createNotification } from "@/core/notifications/notifications.service";
import {
  ActivityAction,
  NotificationType,
  WorkflowDecision,
  WorkflowEntityType,
  WorkflowStepStatus,
} from "@prisma/client";
import {
  completeWorkflowInstance,
  completeWorkflowStepWithDecision,
  createWorkflowInstance,
  createWorkflowInstanceSteps,
  findActiveWorkflowTemplate,
  findWorkflowInstanceByEntity,
  findWorkflowInstanceStep,
  findWorkflowTemplateStepById,
  setWorkflowCurrentStep,
  updateWorkflowStepStatus,
} from "./workflow.repository";

function calculateStepDueAt(slaHours?: number | null) {
  if (!slaHours) {
    return null;
  }

  return new Date(Date.now() + slaHours * 60 * 60 * 1000);
}

function getEntityLink(
  entityType: WorkflowEntityType,
  entityId: string
) {
  switch (entityType) {
    case WorkflowEntityType.INCIDENT:
      return `/incidents/${entityId}`;

    case WorkflowEntityType.CORRECTIVE_ACTION:
      return "/actions";

    case WorkflowEntityType.AUDIT:
      return "/audits";

    case WorkflowEntityType.INSPECTION:
      return "/inspections";

    case WorkflowEntityType.COMPLIANCE:
      return "/compliance";

    case WorkflowEntityType.TRAINING:
      return "/training";

    default:
      return "/tasks";
  }
}

export async function startWorkflowForEntity(input: {
  organizationId: string;
  userId: string;
  entityType: WorkflowEntityType;
  entityId: string;
}) {
  const template = await findActiveWorkflowTemplate({
    organizationId: input.organizationId,
    entityType: input.entityType,
  });

  if (!template || template.steps.length === 0) {
    return null;
  }

  const firstStep = template.steps[0];

  const instance = await createWorkflowInstance({
    organizationId: input.organizationId,
    templateId: template.id,
    entityType: input.entityType,
    entityId: input.entityId,
    startedById: input.userId,
  });

  await createWorkflowInstanceSteps(
    template.steps.map((step, index) => ({
      instanceId: instance.id,
      templateStepId: step.id,
      name: step.name,
      stepType: step.stepType,
      sequence: step.sequence,
      status:
        index === 0
          ? WorkflowStepStatus.IN_PROGRESS
          : WorkflowStepStatus.PENDING,
      assignedRole: step.requiredRole,
      dueAt: index === 0 ? calculateStepDueAt(step.slaHours) : null,
    }))
  );

  const firstInstanceStep = await findWorkflowInstanceStep({
    instanceId: instance.id,
    templateStepId: firstStep.id,
  });

  if (!firstInstanceStep) {
    throw new Error("The first workflow instance step could not be created.");
  }

  const updatedInstance = await setWorkflowCurrentStep({
    instanceId: instance.id,
    currentStepId: firstInstanceStep.id,
  });

  await notifyWorkflowStepOwners({
    organizationId: input.organizationId,
    stepName: firstInstanceStep.name,
    assignedRole: firstInstanceStep.assignedRole,
    assignedUserId: firstInstanceStep.assignedUserId,
    link: getEntityLink(input.entityType, input.entityId),
  });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.SYSTEM,
    entityType: "Workflow",
    entityId: instance.id,
    title: "Workflow started",
    description: `${template.name} workflow started for ${input.entityType}.`,
    metadata: {
      workflowTemplateId: template.id,
      workflowInstanceId: instance.id,
      entityType: input.entityType,
      entityId: input.entityId,
      currentStepId: firstInstanceStep.id,
      currentStepName: firstInstanceStep.name,
    },
  });

  return updatedInstance;
}

export async function advanceWorkflowForEntity(input: {
  organizationId: string;
  userId: string;
  entityType: WorkflowEntityType;
  entityId: string;
}) {
  const instance = await findWorkflowInstanceByEntity({
    organizationId: input.organizationId,
    entityType: input.entityType,
    entityId: input.entityId,
  });

  if (!instance) {
    throw new Error("No active workflow found for this record.");
  }

  const currentStep = instance.steps.find(
    (step) =>
      step.id === instance.currentStepId ||
      step.templateStepId === instance.currentStepId
  );

  if (!currentStep) {
    throw new Error("Current workflow step not found.");
  }

  const templateStep = instance.template.steps.find(
    (step) => step.id === currentStep.templateStepId
  );

  const nextTemplateStepId =
    templateStep?.approveNextStepId ?? null;

  const nextStep = nextTemplateStepId
    ? instance.steps.find(
        (step) => step.templateStepId === nextTemplateStepId
      )
    : instance.steps.find(
        (step) => step.sequence === currentStep.sequence + 1
      );

  await updateWorkflowStepStatus({
    stepId: currentStep.id,
    status: WorkflowStepStatus.COMPLETED,
    completedAt: new Date(),
  });

  if (!nextStep) {
    await completeWorkflowInstance({
      instanceId: instance.id,
    });

    await logActivity({
      organizationId: input.organizationId,
      userId: input.userId,
      action: ActivityAction.SYSTEM,
      entityType: "Workflow",
      entityId: instance.id,
      title: "Workflow completed",
      description: `${instance.template.name} workflow completed.`,
      metadata: {
        workflowInstanceId: instance.id,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    });

    return {
      completed: true,
      instanceId: instance.id,
      nextStep: null,
    };
  }

  const nextTemplateStep = await findWorkflowTemplateStepById({
    templateId: instance.templateId,
    stepId: nextStep.templateStepId,
  });

  await updateWorkflowStepStatus({
    stepId: nextStep.id,
    status: WorkflowStepStatus.IN_PROGRESS,
    startedAt: new Date(),
    dueAt: calculateStepDueAt(nextTemplateStep?.slaHours),
  });

  await setWorkflowCurrentStep({
    instanceId: instance.id,
    currentStepId: nextStep.id,
  });

  await notifyWorkflowStepOwners({
    organizationId: input.organizationId,
    stepName: nextStep.name,
    assignedRole: nextStep.assignedRole,
    assignedUserId: nextStep.assignedUserId,
    link: getEntityLink(input.entityType, input.entityId),
  });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.SYSTEM,
    entityType: "Workflow",
    entityId: instance.id,
    title: "Workflow advanced",
    description: `${currentStep.name} → ${nextStep.name}`,
    metadata: {
      workflowInstanceId: instance.id,
      entityType: input.entityType,
      entityId: input.entityId,
      previousStep: currentStep.name,
      nextStep: nextStep.name,
    },
  });

  return {
    completed: false,
    instanceId: instance.id,
    nextStep,
  };
}

export async function decideWorkflowStep(input: {
  organizationId: string;
  userId: string;
  entityType: WorkflowEntityType;
  entityId: string;
  decision: WorkflowDecision;
  comments?: string | null;
}) {
  const instance = await findWorkflowInstanceByEntity({
    organizationId: input.organizationId,
    entityType: input.entityType,
    entityId: input.entityId,
  });

  if (!instance) {
    throw new Error("No active workflow found for this record.");
  }

  const currentStep = instance.steps.find(
    (step) =>
      step.id === instance.currentStepId ||
      step.templateStepId === instance.currentStepId
  );

  if (!currentStep) {
    throw new Error("Current workflow step not found.");
  }

  const currentUser = await prisma.user.findFirst({
    where: {
      id: input.userId,
      organizationId: input.organizationId,
    },
  });

  if (!currentUser) {
    throw new Error("User not found.");
  }

  const isAssignedUser = currentStep.assignedUserId === input.userId;

  const hasRequiredRole =
    currentStep.assignedRole === null ||
    currentStep.assignedRole === currentUser.role;

  if (!isAssignedUser && !hasRequiredRole) {
    throw new Error(
      "You are not authorized to complete this workflow step."
    );
  }

  const templateStep = instance.template.steps.find(
    (step) => step.id === currentStep.templateStepId
  );

  if (!templateStep) {
    throw new Error("Workflow template step not found.");
  }

  if (input.decision === WorkflowDecision.REJECT) {
    await completeWorkflowStepWithDecision({
      stepId: currentStep.id,
      status: WorkflowStepStatus.REJECTED,
      decision: WorkflowDecision.REJECT,
      completedById: input.userId,
      comments: input.comments,
    });

    const rejectedNextStep = templateStep.rejectNextStepId
      ? instance.steps.find(
          (step) =>
            step.templateStepId === templateStep.rejectNextStepId
        )
      : null;

    if (!rejectedNextStep) {
      await logActivity({
        organizationId: input.organizationId,
        userId: input.userId,
        action: ActivityAction.SYSTEM,
        entityType: "Workflow",
        entityId: instance.id,
        title: "Workflow step rejected",
        description: `${currentStep.name} was rejected.`,
        metadata: {
          workflowInstanceId: instance.id,
          entityType: input.entityType,
          entityId: input.entityId,
          stepName: currentStep.name,
          decision: WorkflowDecision.REJECT,
          comments: input.comments,
        },
      });

      return {
        completed: false,
        rejected: true,
        instanceId: instance.id,
        currentStep,
        nextStep: null,
      };
    }

    const rejectedNextTemplateStep =
      await findWorkflowTemplateStepById({
        templateId: instance.templateId,
        stepId: rejectedNextStep.templateStepId,
      });

    await updateWorkflowStepStatus({
      stepId: rejectedNextStep.id,
      status: WorkflowStepStatus.IN_PROGRESS,
      startedAt: new Date(),
      dueAt: calculateStepDueAt(
        rejectedNextTemplateStep?.slaHours
      ),
    });

    await setWorkflowCurrentStep({
      instanceId: instance.id,
      currentStepId: rejectedNextStep.id,
    });

    await notifyWorkflowStepOwners({
      organizationId: input.organizationId,
      stepName: rejectedNextStep.name,
      assignedRole: rejectedNextStep.assignedRole,
      assignedUserId: rejectedNextStep.assignedUserId,
      link: getEntityLink(input.entityType, input.entityId),
    });

    await logActivity({
      organizationId: input.organizationId,
      userId: input.userId,
      action: ActivityAction.SYSTEM,
      entityType: "Workflow",
      entityId: instance.id,
      title: "Workflow step rejected and rerouted",
      description: `${currentStep.name} → ${rejectedNextStep.name}`,
      metadata: {
        workflowInstanceId: instance.id,
        entityType: input.entityType,
        entityId: input.entityId,
        previousStep: currentStep.name,
        nextStep: rejectedNextStep.name,
        decision: WorkflowDecision.REJECT,
        comments: input.comments,
      },
    });

    return {
      completed: false,
      rejected: true,
      instanceId: instance.id,
      currentStep,
      nextStep: rejectedNextStep,
    };
  }

  if (input.decision === WorkflowDecision.SKIP) {
    await completeWorkflowStepWithDecision({
      stepId: currentStep.id,
      status: WorkflowStepStatus.SKIPPED,
      decision: WorkflowDecision.SKIP,
      completedById: input.userId,
      comments: input.comments,
    });
  } else {
    await completeWorkflowStepWithDecision({
      stepId: currentStep.id,
      status: WorkflowStepStatus.APPROVED,
      decision: WorkflowDecision.APPROVE,
      completedById: input.userId,
      comments: input.comments,
    });
  }

  const nextTemplateStepId =
    templateStep.approveNextStepId ?? null;

  const nextStep = nextTemplateStepId
    ? instance.steps.find(
        (step) => step.templateStepId === nextTemplateStepId
      )
    : instance.steps.find(
        (step) => step.sequence === currentStep.sequence + 1
      );

  if (!nextStep) {
    await completeWorkflowInstance({
      instanceId: instance.id,
    });

    await logActivity({
      organizationId: input.organizationId,
      userId: input.userId,
      action: ActivityAction.SYSTEM,
      entityType: "Workflow",
      entityId: instance.id,
      title: "Workflow completed",
      description: `${instance.template.name} workflow completed.`,
      metadata: {
        workflowInstanceId: instance.id,
        entityType: input.entityType,
        entityId: input.entityId,
        finalDecision: input.decision,
        comments: input.comments,
      },
    });

    return {
      completed: true,
      rejected: false,
      instanceId: instance.id,
      nextStep: null,
    };
  }

  const nextTemplateStep = await findWorkflowTemplateStepById({
    templateId: instance.templateId,
    stepId: nextStep.templateStepId,
  });

  await updateWorkflowStepStatus({
    stepId: nextStep.id,
    status: WorkflowStepStatus.IN_PROGRESS,
    startedAt: new Date(),
    dueAt: calculateStepDueAt(nextTemplateStep?.slaHours),
  });

  await setWorkflowCurrentStep({
    instanceId: instance.id,
    currentStepId: nextStep.id,
  });

  await notifyWorkflowStepOwners({
    organizationId: input.organizationId,
    stepName: nextStep.name,
    assignedRole: nextStep.assignedRole,
    assignedUserId: nextStep.assignedUserId,
    link: getEntityLink(input.entityType, input.entityId),
  });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.SYSTEM,
    entityType: "Workflow",
    entityId: instance.id,
    title:
      input.decision === WorkflowDecision.SKIP
        ? "Workflow step skipped"
        : "Workflow step approved",
    description: `${currentStep.name} → ${nextStep.name}`,
    metadata: {
      workflowInstanceId: instance.id,
      entityType: input.entityType,
      entityId: input.entityId,
      previousStep: currentStep.name,
      nextStep: nextStep.name,
      decision: input.decision,
      comments: input.comments,
    },
  });

  return {
    completed: false,
    rejected: false,
    instanceId: instance.id,
    nextStep,
  };
}

async function notifyWorkflowStepOwners(input: {
  organizationId: string;
  stepName: string;
  assignedRole?: string | null;
  assignedUserId?: string | null;
  link: string;
}) {
  if (input.assignedUserId) {
    await createNotification({
      organizationId: input.organizationId,
      userId: input.assignedUserId,
      type: NotificationType.ASSIGNMENT,
      title: "Workflow task assigned",
      message: `You have a workflow task: ${input.stepName}`,
      link: input.link,
    });

    return;
  }

  if (!input.assignedRole) {
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      organizationId: input.organizationId,
      role: input.assignedRole as never,
    },
    select: {
      id: true,
    },
  });

  await Promise.all(
    users.map((user) =>
      createNotification({
        organizationId: input.organizationId,
        userId: user.id,
        type: NotificationType.ASSIGNMENT,
        title: "Workflow task assigned",
        message: `Your role has a workflow task: ${input.stepName}`,
        link: input.link,
      })
    )
  );
}