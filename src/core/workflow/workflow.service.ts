
import { logActivity } from "@/core/activity-log/activity-log.service";
import {
  sendWorkflowAssignmentEmail,
  sendWorkflowDecisionEmail,
} from "@/core/notifications/notification-email.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { ActivityAction, NotificationType, WorkflowDecision, WorkflowEntityType, WorkflowStepStatus,} from "@prisma/client";
import { completeWorkflowInstance, completeWorkflowStepWithDecision, createWorkflowInstance, createWorkflowInstanceSteps, findActiveWorkflowTemplate, findWorkflowInstanceByEntity, findWorkflowInstanceStep,
  findWorkflowTemplateStepById, setWorkflowCurrentStep, updateWorkflowStepStatus,} from "./workflow.repository";
import { prisma } from "@/lib/prisma";

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
      return "/workflows";

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
    workflowName: template.name,
    entityType: input.entityType,
    entityId: input.entityId,
    stepName: firstInstanceStep.name,
    assignedRole: firstInstanceStep.assignedRole,
    assignedUserId: firstInstanceStep.assignedUserId,
    dueAt: firstInstanceStep.dueAt,
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
    throw new Error(
      "No active workflow found for this record."
    );
  }

  const currentStep = instance.steps.find(
    (step) =>
      step.id === instance.currentStepId ||
      step.templateStepId === instance.currentStepId
  );

  if (!currentStep) {
    throw new Error(
      "Current workflow step not found."
    );
  }

  const templateStep =
    instance.template.steps.find(
      (step) =>
        step.id === currentStep.templateStepId
    );

  if (!templateStep) {
    throw new Error(
      "Workflow template step not found."
    );
  }

  const nextTemplateStepId =
    templateStep.approveNextStepId ?? null;

  const nextStep = nextTemplateStepId
    ? instance.steps.find(
        (step) =>
          step.templateStepId ===
          nextTemplateStepId
      )
    : instance.steps.find(
        (step) =>
          step.sequence ===
          currentStep.sequence + 1
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
      description:
        `${instance.template.name} workflow completed.`,
      metadata: {
        workflowInstanceId: instance.id,
        entityType: input.entityType,
        entityId: input.entityId,
        finalStepId: currentStep.id,
        finalStepName: currentStep.name,
      },
    });

    return {
      completed: true,
      instanceId: instance.id,
      currentStep,
      nextStep: null,
    };
  }

  const nextTemplateStep =
    await findWorkflowTemplateStepById({
      templateId: instance.templateId,
      stepId: nextStep.templateStepId,
    });

  if (!nextTemplateStep) {
    throw new Error(
      "The next workflow template step was not found."
    );
  }

  const nextStepDueAt =
    calculateStepDueAt(
      nextTemplateStep.slaHours
    );

  await updateWorkflowStepStatus({
    stepId: nextStep.id,
    status: WorkflowStepStatus.IN_PROGRESS,
    startedAt: new Date(),
    dueAt: nextStepDueAt,
  });

  await setWorkflowCurrentStep({
    instanceId: instance.id,
    currentStepId: nextStep.id,
  });

  await notifyWorkflowStepOwners({
    organizationId: input.organizationId,
    workflowName: instance.template.name,
    entityType: input.entityType,
    entityId: input.entityId,
    stepName: nextStep.name,
    assignedRole: nextStep.assignedRole,
    assignedUserId: nextStep.assignedUserId,
    dueAt: nextStepDueAt,
    link: getEntityLink(
      input.entityType,
      input.entityId
    ),
  });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.SYSTEM,
    entityType: "Workflow",
    entityId: instance.id,
    title: "Workflow advanced",
    description:
      `${currentStep.name} → ${nextStep.name}`,
    metadata: {
      workflowInstanceId: instance.id,
      entityType: input.entityType,
      entityId: input.entityId,
      previousStepId: currentStep.id,
      previousStep: currentStep.name,
      nextStepId: nextStep.id,
      nextStep: nextStep.name,
      nextStepDueAt:
        nextStepDueAt?.toISOString() ?? null,
    },
  });

  return {
    completed: false,
    instanceId: instance.id,
    currentStep,
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
    throw new Error(
      "No active workflow found for this record."
    );
  }

  const currentStep = instance.steps.find(
    (step) =>
      step.id === instance.currentStepId ||
      step.templateStepId === instance.currentStepId
  );

  if (!currentStep) {
    throw new Error(
      "Current workflow step not found."
    );
  }

  const currentUser = await prisma.user.findFirst({
    where: {
      id: input.userId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      name: true,
      role: true,
    },
  });

  if (!currentUser) {
    throw new Error("User not found.");
  }

  const isAssignedUser =
    currentStep.assignedUserId === input.userId;

  const isRoleAssignedUser =
    !currentStep.assignedUserId &&
    currentStep.assignedRole !== null &&
    currentStep.assignedRole === currentUser.role;

  const isUnrestrictedStep =
    !currentStep.assignedUserId &&
    currentStep.assignedRole === null;

  if (
    !isAssignedUser &&
    !isRoleAssignedUser &&
    !isUnrestrictedStep
  ) {
    throw new Error(
      "You are not authorized to complete this workflow step."
    );
  }

  const templateStep = instance.template.steps.find(
    (step) =>
      step.id === currentStep.templateStepId
  );

  if (!templateStep) {
    throw new Error(
      "Workflow template step not found."
    );
  }

  /*
   * REJECTION FLOW
   */
  if (input.decision === WorkflowDecision.REJECT) {
    await completeWorkflowStepWithDecision({
      stepId: currentStep.id,
      status: WorkflowStepStatus.REJECTED,
      decision: WorkflowDecision.REJECT,
      completedById: input.userId,
      comments: input.comments,
    });

    const rejectedNextStep =
      templateStep.rejectNextStepId
        ? instance.steps.find(
            (step) =>
              step.templateStepId ===
              templateStep.rejectNextStepId
          )
        : null;

    /*
     * Rejected without a configured reroute.
     * The workflow remains active on the rejected step unless
     * another service or administrator resolves it.
     */
    if (!rejectedNextStep) {
      await notifyWorkflowDecisionRecipients({
        organizationId: input.organizationId,
        workflowName: instance.template.name,
        entityType: input.entityType,
        entityId: input.entityId,
        stepName: currentStep.name,
        decision: WorkflowDecision.REJECT,
        comments: input.comments,
        completedByName: currentUser.name,
        startedById: instance.startedById,
        assignedUserId: currentStep.assignedUserId,
      });

      await logActivity({
        organizationId: input.organizationId,
        userId: input.userId,
        action: ActivityAction.SYSTEM,
        entityType: "Workflow",
        entityId: instance.id,
        title: "Workflow step rejected",
        description:
          `${currentStep.name} was rejected.`,
        metadata: {
          workflowInstanceId: instance.id,
          entityType: input.entityType,
          entityId: input.entityId,
          stepId: currentStep.id,
          stepName: currentStep.name,
          decision: WorkflowDecision.REJECT,
          comments: input.comments,
          completedById: input.userId,
          completedByName: currentUser.name,
          rerouted: false,
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

    if (!rejectedNextTemplateStep) {
      throw new Error(
        "The rejection destination template step was not found."
      );
    }

    const rejectedNextStepDueAt =
      calculateStepDueAt(
        rejectedNextTemplateStep.slaHours
      );

    await updateWorkflowStepStatus({
      stepId: rejectedNextStep.id,
      status: WorkflowStepStatus.IN_PROGRESS,
      startedAt: new Date(),
      dueAt: rejectedNextStepDueAt,
    });

    await setWorkflowCurrentStep({
      instanceId: instance.id,
      currentStepId: rejectedNextStep.id,
    });

    /*
     * Notify the owner of the step receiving the rejected workflow.
     */
    await notifyWorkflowStepOwners({
      organizationId: input.organizationId,
      workflowName: instance.template.name,
      entityType: input.entityType,
      entityId: input.entityId,
      stepName: rejectedNextStep.name,
      assignedRole: rejectedNextStep.assignedRole,
      assignedUserId:
        rejectedNextStep.assignedUserId,
      dueAt: rejectedNextStepDueAt,
      link: getEntityLink(
        input.entityType,
        input.entityId
      ),
    });

    /*
     * Notify the workflow starter and the previous assigned user
     * that the decision was rejected.
     */
    await notifyWorkflowDecisionRecipients({
      organizationId: input.organizationId,
      workflowName: instance.template.name,
      entityType: input.entityType,
      entityId: input.entityId,
      stepName: currentStep.name,
      decision: WorkflowDecision.REJECT,
      comments: input.comments,
      completedByName: currentUser.name,
      startedById: instance.startedById,
      assignedUserId: currentStep.assignedUserId,
    });

    await logActivity({
      organizationId: input.organizationId,
      userId: input.userId,
      action: ActivityAction.SYSTEM,
      entityType: "Workflow",
      entityId: instance.id,
      title: "Workflow step rejected and rerouted",
      description:
        `${currentStep.name} → ${rejectedNextStep.name}`,
      metadata: {
        workflowInstanceId: instance.id,
        entityType: input.entityType,
        entityId: input.entityId,
        previousStepId: currentStep.id,
        previousStep: currentStep.name,
        nextStepId: rejectedNextStep.id,
        nextStep: rejectedNextStep.name,
        nextStepDueAt:
          rejectedNextStepDueAt?.toISOString() ??
          null,
        decision: WorkflowDecision.REJECT,
        comments: input.comments,
        completedById: input.userId,
        completedByName: currentUser.name,
        rerouted: true,
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

  /*
   * APPROVAL OR SKIP FLOW
   */
  const completedStepStatus =
    input.decision === WorkflowDecision.SKIP
      ? WorkflowStepStatus.SKIPPED
      : WorkflowStepStatus.APPROVED;

  const recordedDecision =
    input.decision === WorkflowDecision.SKIP
      ? WorkflowDecision.SKIP
      : WorkflowDecision.APPROVE;

  await completeWorkflowStepWithDecision({
    stepId: currentStep.id,
    status: completedStepStatus,
    decision: recordedDecision,
    completedById: input.userId,
    comments: input.comments,
  });

  const nextTemplateStepId =
    templateStep.approveNextStepId ?? null;

  const nextStep = nextTemplateStepId
    ? instance.steps.find(
        (step) =>
          step.templateStepId ===
          nextTemplateStepId
      )
    : instance.steps.find(
        (step) =>
          step.sequence ===
          currentStep.sequence + 1
      );

  /*
   * FINAL STEP — COMPLETE WORKFLOW
   */
  if (!nextStep) {
    await completeWorkflowInstance({
      instanceId: instance.id,
    });

    await notifyWorkflowDecisionRecipients({
      organizationId: input.organizationId,
      workflowName: instance.template.name,
      entityType: input.entityType,
      entityId: input.entityId,
      stepName: currentStep.name,
      decision: recordedDecision,
      comments: input.comments,
      completedByName: currentUser.name,
      startedById: instance.startedById,
      assignedUserId: currentStep.assignedUserId,
    });

    await logActivity({
      organizationId: input.organizationId,
      userId: input.userId,
      action: ActivityAction.SYSTEM,
      entityType: "Workflow",
      entityId: instance.id,
      title: "Workflow completed",
      description:
        `${instance.template.name} workflow completed.`,
      metadata: {
        workflowInstanceId: instance.id,
        entityType: input.entityType,
        entityId: input.entityId,
        finalStepId: currentStep.id,
        finalStepName: currentStep.name,
        finalDecision: recordedDecision,
        comments: input.comments,
        completedById: input.userId,
        completedByName: currentUser.name,
      },
    });

    return {
      completed: true,
      rejected: false,
      instanceId: instance.id,
      currentStep,
      nextStep: null,
    };
  }

  /*
   * ADVANCE TO THE NEXT STEP
   */
  const nextTemplateStep =
    await findWorkflowTemplateStepById({
      templateId: instance.templateId,
      stepId: nextStep.templateStepId,
    });

  if (!nextTemplateStep) {
    throw new Error(
      "The next workflow template step was not found."
    );
  }

  const nextStepDueAt =
    calculateStepDueAt(
      nextTemplateStep.slaHours
    );

  await updateWorkflowStepStatus({
    stepId: nextStep.id,
    status: WorkflowStepStatus.IN_PROGRESS,
    startedAt: new Date(),
    dueAt: nextStepDueAt,
  });

  await setWorkflowCurrentStep({
    instanceId: instance.id,
    currentStepId: nextStep.id,
  });

  /*
   * Notify the owner of the newly activated step.
   */
  await notifyWorkflowStepOwners({
    organizationId: input.organizationId,
    workflowName: instance.template.name,
    entityType: input.entityType,
    entityId: input.entityId,
    stepName: nextStep.name,
    assignedRole: nextStep.assignedRole,
    assignedUserId: nextStep.assignedUserId,
    dueAt: nextStepDueAt,
    link: getEntityLink(
      input.entityType,
      input.entityId
    ),
  });

  /*
   * Notify the starter and previous assigned user about the
   * approval or skip decision.
   */
  await notifyWorkflowDecisionRecipients({
    organizationId: input.organizationId,
    workflowName: instance.template.name,
    entityType: input.entityType,
    entityId: input.entityId,
    stepName: currentStep.name,
    decision: recordedDecision,
    comments: input.comments,
    completedByName: currentUser.name,
    startedById: instance.startedById,
    assignedUserId: currentStep.assignedUserId,
  });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.SYSTEM,
    entityType: "Workflow",
    entityId: instance.id,
    title:
      recordedDecision === WorkflowDecision.SKIP
        ? "Workflow step skipped"
        : "Workflow step approved",
    description:
      `${currentStep.name} → ${nextStep.name}`,
    metadata: {
      workflowInstanceId: instance.id,
      entityType: input.entityType,
      entityId: input.entityId,
      previousStepId: currentStep.id,
      previousStep: currentStep.name,
      nextStepId: nextStep.id,
      nextStep: nextStep.name,
      nextStepDueAt:
        nextStepDueAt?.toISOString() ?? null,
      decision: recordedDecision,
      comments: input.comments,
      completedById: input.userId,
      completedByName: currentUser.name,
    },
  });

  return {
    completed: false,
    rejected: false,
    instanceId: instance.id,
    currentStep,
    nextStep,
  };
}

async function notifyWorkflowStepOwners(input: {
  organizationId: string;
  workflowName: string;
  entityType: WorkflowEntityType;
  entityId: string;
  stepName: string;
  assignedRole?: string | null;
  assignedUserId?: string | null;
  dueAt?: Date | null;
  link: string;
}) {
  if (input.assignedUserId) {
    const assignedUser = await prisma.user.findFirst({
      where: {
        id: input.assignedUserId,
        organizationId: input.organizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!assignedUser) {
      console.error(
        `Workflow assignment user ${input.assignedUserId} was not found.`
      );

      return;
    }

    await createNotification({
      organizationId: input.organizationId,
      userId: assignedUser.id,
      type: NotificationType.ASSIGNMENT,
      title: "Workflow task assigned",
      message: `You have a workflow task: ${input.stepName}`,
      link: input.link,
    });

    if (assignedUser.email) {
      try {
        await sendWorkflowAssignmentEmail({
          recipientEmail: assignedUser.email,
          recipientName: assignedUser.name,
          entityType: input.entityType,
          entityId: input.entityId,
          workflowName: input.workflowName,
          stepName: input.stepName,
          dueAt: input.dueAt,
        });
      } catch (error) {
        console.error(
          "Workflow-assignment email failed:",
          error
        );
      }
    }

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
      name: true,
      email: true,
    },
  });

  await Promise.all(
    users.map(async (user) => {
      await createNotification({
        organizationId: input.organizationId,
        userId: user.id,
        type: NotificationType.ASSIGNMENT,
        title: "Workflow task assigned",
        message: `Your role has a workflow task: ${input.stepName}`,
        link: input.link,
      });

      if (!user.email) {
        return;
      }

      try {
        await sendWorkflowAssignmentEmail({
          recipientEmail: user.email,
          recipientName: user.name,
          entityType: input.entityType,
          entityId: input.entityId,
          workflowName: input.workflowName,
          stepName: input.stepName,
          dueAt: input.dueAt,
        });
      } catch (error) {
        console.error(
          `Workflow-assignment email failed for ${user.id}:`,
          error
        );
      }
    })
  );
}

async function notifyWorkflowDecisionRecipients(input: {
  organizationId: string;
  workflowName: string;
  entityType: WorkflowEntityType;
  entityId: string;
  stepName: string;
  decision: WorkflowDecision;
  comments?: string | null;
  completedByName?: string | null;
  startedById?: string | null;
  assignedUserId?: string | null;
}) {
  const recipientIds = new Set<string>();

  if (input.startedById) {
    recipientIds.add(input.startedById);
  }

  if (input.assignedUserId) {
    recipientIds.add(input.assignedUserId);
  }

  if (recipientIds.size === 0) {
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      organizationId: input.organizationId,
      id: {
        in: Array.from(recipientIds),
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  await Promise.all(
    users.map(async (user) => {
      if (!user.email) {
        return;
      }

      try {
        await sendWorkflowDecisionEmail({
          recipientEmail: user.email,
          recipientName: user.name,
          entityType: input.entityType,
          entityId: input.entityId,
          workflowName: input.workflowName,
          stepName: input.stepName,
          decision: input.decision,
          comments: input.comments,
          completedByName: input.completedByName,
        });
      } catch (error) {
        console.error(
          `Workflow-decision email failed for ${user.id}:`,
          error
        );
      }
    })
  );
}