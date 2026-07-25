"use server";

import {
  parseWorkflowTriggerConditions,
  workflowConditionsJson,
} from "@/core/workflow/workflow-automation-rules";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions";
import {
  ActivityAction,
  PermissionKey,
  Prisma,
  UserRole,
  WorkflowEntityType,
  WorkflowStepType,
  WorkflowTriggerEvent,
} from "@prisma/client";
import { redirect } from "next/navigation";

type WorkflowBranchStep = {
  id: string;
  approveNextStepId: string | null;
  rejectNextStepId: string | null;
};

function hasWorkflowCycle(steps: WorkflowBranchStep[]) {
  const stepsById = new Map(steps.map((step) => [step.id, step]));
  const visited = new Set<string>();
  const activePath = new Set<string>();

  function visit(stepId: string): boolean {
    if (activePath.has(stepId)) {
      return true;
    }

    if (visited.has(stepId)) {
      return false;
    }

    const step = stepsById.get(stepId);

    if (!step) {
      return false;
    }

    visited.add(stepId);
    activePath.add(stepId);

    const targets = [
      step.approveNextStepId,
      step.rejectNextStepId,
    ].filter((target): target is string => Boolean(target));

    for (const targetId of targets) {
      if (visit(targetId)) {
        return true;
      }
    }

    activePath.delete(stepId);

    return false;
  }

  return steps.some((step) => visit(step.id));
}

function workflowTriggerSettings(formData: FormData) {
  const triggerEvent = String(
    formData.get("triggerEvent") || WorkflowTriggerEvent.RECORD_CREATED,
  ) as WorkflowTriggerEvent;
  if (!Object.values(WorkflowTriggerEvent).includes(triggerEvent)) {
    throw new Error("Select a valid workflow trigger event.");
  }
  const conditions = parseWorkflowTriggerConditions({
    fields: formData.getAll("conditionField").map(String),
    operators: formData.getAll("conditionOperator").map(String),
    values: formData.getAll("conditionValue").map(String),
  });
  return {
    triggerEvent,
    triggerConditions: conditions.length
      ? workflowConditionsJson(conditions)
      : Prisma.JsonNull,
    conditionCount: conditions.length,
  };
}

export async function createWorkflowTemplate(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);

  const { organizationId, user } = await getCurrentUserTenant();

  const name = String(formData.get("name")).trim();
  const description = String(formData.get("description")).trim();
  const entityType = formData.get("entityType") as WorkflowEntityType;
  const trigger = workflowTriggerSettings(formData);
  if (!name || name.length > 120) {
    throw new Error("Workflow name is required and must be 120 characters or fewer.");
  }
  if (!Object.values(WorkflowEntityType).includes(entityType)) {
    throw new Error("Select a valid workflow entity type.");
  }

  const stepNames = formData.getAll("stepName").map(String);
  const stepTypes = formData.getAll("stepType").map(String);
  const requiredRoles = formData.getAll("requiredRole").map(String);
  const slaHours = formData.getAll("slaHours").map(String);
  const steps: Prisma.WorkflowTemplateStepCreateWithoutTemplateInput[] = [];
  for (let index = 0; index < stepNames.length; index++) {
    const stepName = stepNames[index].trim();
    if (!stepName) continue;
    const stepType = stepTypes[index] as WorkflowStepType;
    const requiredRole = requiredRoles[index];
    const parsedSla = slaHours[index] ? Number(slaHours[index]) : null;
    if (!Object.values(WorkflowStepType).includes(stepType)) {
      throw new Error("Select a valid workflow step type.");
    }
    if (
      requiredRole !== "NONE" &&
      !Object.values(UserRole).includes(requiredRole as UserRole)
    ) {
      throw new Error("Select a valid workflow step role.");
    }
    if (
      parsedSla !== null &&
      (!Number.isInteger(parsedSla) || parsedSla < 0)
    ) {
      throw new Error("SLA hours must be a non-negative whole number.");
    }
    steps.push({
      name: stepName,
      stepType,
      sequence: steps.length + 1,
      requiredRole:
        requiredRole === "NONE" ? null : (requiredRole as UserRole),
      slaHours: parsedSla,
    });
  }
  if (!steps.length) throw new Error("Add at least one workflow step.");

  await prisma.$transaction(async (tx) => {
    await tx.workflowTemplate.updateMany({
      where: { organizationId, entityType, isActive: true },
      data: { isActive: false },
    });
    const template = await tx.workflowTemplate.create({
      data: {
        organizationId,
        name,
        description: description || null,
        entityType,
        triggerEvent: trigger.triggerEvent,
        triggerConditions: trigger.triggerConditions,
        isActive: true,
        steps: { create: steps },
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId,
        userId: user.id,
        action: ActivityAction.CREATE,
        entityType: "WorkflowTemplate",
        entityId: template.id,
        title: "Workflow automation created",
        description: template.name,
        metadata: {
          entityType,
          triggerEvent: trigger.triggerEvent,
          conditionCount: trigger.conditionCount,
          stepCount: steps.length,
        },
      },
    });
  });

  redirect("/workflows");
}

export async function toggleWorkflowTemplateStatus(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);

  const { organizationId } = await getCurrentUserTenant();

  const workflowId = String(formData.get("workflowId"));
  const isActive = String(formData.get("isActive")) === "true";

  const workflow = await prisma.workflowTemplate.findFirst({
    where: {
      id: workflowId,
      organizationId,
    },
  });

  if (!workflow) {
    throw new Error("Workflow template not found.");
  }

  if (isActive) {
    await prisma.workflowTemplate.update({
      where: {
        id: workflow.id,
      },
      data: {
        isActive: false,
      },
    });

    redirect("/workflows");
  }

  await prisma.workflowTemplate.updateMany({
    where: {
      organizationId,
      entityType: workflow.entityType,
    },
    data: {
      isActive: false,
    },
  });

  await prisma.workflowTemplate.update({
    where: {
      id: workflow.id,
    },
    data: {
      isActive: true,
    },
  });

  redirect("/workflows");
}

export async function updateWorkflowTemplateStep(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);

  const { organizationId } = await getCurrentUserTenant();

  const workflowId = String(formData.get("workflowId"));
  const stepId = String(formData.get("stepId"));
  const name = String(formData.get("name")).trim();
  const description = String(formData.get("description")).trim();
  const stepType = formData.get("stepType") as WorkflowStepType;
  const requiredRole = String(formData.get("requiredRole"));
  const slaHoursValue = String(formData.get("slaHours")).trim();

  const approveSelection = String(
    formData.get("approveNextStepId") || "SEQUENCE"
  );

  const rejectSelection = String(
    formData.get("rejectNextStepId") || "NONE"
  );

  if (!name) {
    throw new Error("Workflow step name is required.");
  }

  const workflow = await prisma.workflowTemplate.findFirst({
    where: {
      id: workflowId,
      organizationId,
    },
    include: {
      steps: {
        orderBy: {
          sequence: "asc",
        },
        select: {
          id: true,
          sequence: true,
          approveNextStepId: true,
          rejectNextStepId: true,
        },
      },
    },
  });

  if (!workflow) {
    throw new Error("Workflow template not found.");
  }

  const currentStep = workflow.steps.find((step) => step.id === stepId);

  if (!currentStep) {
    throw new Error("Workflow step not found.");
  }

  const validStepIds = new Set(workflow.steps.map((step) => step.id));

  for (const targetId of [approveSelection, rejectSelection]) {
    if (
      targetId !== "SEQUENCE" &&
      targetId !== "NONE" &&
      !validStepIds.has(targetId)
    ) {
      throw new Error("Invalid workflow branch target.");
    }

    if (targetId === stepId) {
      throw new Error("A workflow step cannot route directly to itself.");
    }
  }

  const nextSequentialStep =
    workflow.steps.find(
      (step) => step.sequence === currentStep.sequence + 1
    ) ?? null;

  const approveNextStepId =
    approveSelection === "SEQUENCE"
      ? nextSequentialStep?.id ?? null
      : approveSelection === "NONE"
        ? null
        : approveSelection;

  const rejectNextStepId =
    rejectSelection === "SEQUENCE"
      ? nextSequentialStep?.id ?? null
      : rejectSelection === "NONE"
        ? null
        : rejectSelection;

  const proposedSteps = workflow.steps.map((step) =>
    step.id === stepId
      ? {
          id: step.id,
          approveNextStepId,
          rejectNextStepId,
        }
      : {
          id: step.id,
          approveNextStepId: step.approveNextStepId,
          rejectNextStepId: step.rejectNextStepId,
        }
  );

  if (hasWorkflowCycle(proposedSteps)) {
    throw new Error(
      "This branch configuration creates a workflow cycle. Choose a different destination."
    );
  }

  const parsedSlaHours = slaHoursValue ? Number(slaHoursValue) : null;

  if (
    parsedSlaHours !== null &&
    (!Number.isInteger(parsedSlaHours) || parsedSlaHours < 0)
  ) {
    throw new Error("SLA hours must be a non-negative whole number.");
  }

  await prisma.workflowTemplateStep.update({
    where: {
      id: stepId,
    },
    data: {
      name,
      description: description || null,
      stepType,
      requiredRole:
        requiredRole === "NONE" ? null : (requiredRole as UserRole),
      slaHours: parsedSlaHours,
      approveNextStepId,
      rejectNextStepId,
    },
  });

  redirect(`/workflows/${workflowId}`);
}

export async function addWorkflowTemplateStep(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);

  const { organizationId } = await getCurrentUserTenant();

  const workflowId = String(formData.get("workflowId"));

  const workflow = await prisma.workflowTemplate.findFirst({
    where: {
      id: workflowId,
      organizationId,
    },
    include: {
      steps: true,
    },
  });

  if (!workflow) {
    throw new Error("Workflow template not found.");
  }

  const nextSequence =
    workflow.steps.length > 0
      ? Math.max(...workflow.steps.map((step) => step.sequence)) + 1
      : 1;

  await prisma.workflowTemplateStep.create({
    data: {
      templateId: workflow.id,
      name: "New Workflow Step",
      description: "Describe this workflow step.",
      stepType: WorkflowStepType.REVIEW,
      sequence: nextSequence,
      requiredRole: null,
      slaHours: 24,
    },
  });

  redirect(`/workflows/${workflowId}`);
}

export async function deleteWorkflowTemplateStep(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);

  const { organizationId } = await getCurrentUserTenant();

  const workflowId = String(formData.get("workflowId"));
  const stepId = String(formData.get("stepId"));

  const workflow = await prisma.workflowTemplate.findFirst({
    where: {
      id: workflowId,
      organizationId,
    },
    include: {
      steps: true,
    },
  });

  if (!workflow) {
    throw new Error("Workflow template not found.");
  }

  if (workflow.steps.length <= 1) {
    throw new Error("A workflow must have at least one step.");
  }

  const targetStep = await prisma.workflowTemplateStep.findFirst({
    where: {
      id: stepId,
      templateId: workflowId,
    },
    include: {
      outcomes: {
        include: {
          _count: {
            select: {
              executions: true,
            },
          },
        },
      },
    },
  });
  if (!targetStep) {
    throw new Error("Workflow step not found.");
  }
  if (
    targetStep.outcomes.some(
      (outcome) => outcome._count.executions > 0,
    )
  ) {
    throw new Error(
      "This step has automated-outcome history and cannot be deleted. Deactivate its outcomes instead.",
    );
  }

  await prisma.workflowTemplateStep.deleteMany({
    where: {
      id: stepId,
      templateId: workflowId,
    },
  });

  const remainingSteps = await prisma.workflowTemplateStep.findMany({
    where: {
      templateId: workflowId,
    },
    orderBy: {
      sequence: "asc",
    },
  });

  for (let index = 0; index < remainingSteps.length; index++) {
    await prisma.workflowTemplateStep.update({
      where: {
        id: remainingSteps[index].id,
      },
      data: {
        sequence: index + 1,
      },
    });
  }

  redirect(`/workflows/${workflowId}`);
}

export async function reorderWorkflowTemplateSteps(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);

  const { organizationId } = await getCurrentUserTenant();

  const workflowId = String(formData.get("workflowId"));
  const orderedStepIds = String(formData.get("orderedStepIds"))
    .split(",")
    .filter(Boolean);

  const workflow = await prisma.workflowTemplate.findFirst({
    where: {
      id: workflowId,
      organizationId,
    },
  });

  if (!workflow) {
    throw new Error("Workflow template not found.");
  }

  for (let index = 0; index < orderedStepIds.length; index++) {
    await prisma.workflowTemplateStep.updateMany({
      where: {
        id: orderedStepIds[index],
        templateId: workflowId,
      },
      data: {
        sequence: index + 1,
      },
    });
  }

  redirect(`/workflows/${workflowId}`);
}

export async function updateWorkflowTemplate(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);

  const { organizationId, user } = await getCurrentUserTenant();

  const workflowId = String(formData.get("workflowId"));
  const name = String(formData.get("name")).trim();
  const description = String(formData.get("description")).trim();
  const entityType = formData.get("entityType") as WorkflowEntityType;
  const trigger = workflowTriggerSettings(formData);
  if (!name || name.length > 120) {
    throw new Error("Workflow name is required and must be 120 characters or fewer.");
  }
  if (!Object.values(WorkflowEntityType).includes(entityType)) {
    throw new Error("Select a valid workflow entity type.");
  }
  const workflow = await prisma.workflowTemplate.findFirst({
    where: { id: workflowId, organizationId },
    select: { id: true, isActive: true },
  });
  if (!workflow) throw new Error("Workflow template not found.");

  await prisma.$transaction(async (tx) => {
    if (workflow.isActive) {
      await tx.workflowTemplate.updateMany({
        where: {
          organizationId,
          entityType,
          id: { not: workflow.id },
          isActive: true,
        },
        data: { isActive: false },
      });
    }
    await tx.workflowTemplate.update({
      where: { id: workflow.id },
      data: {
        name,
        description: description || null,
        entityType,
        triggerEvent: trigger.triggerEvent,
        triggerConditions: trigger.triggerConditions,
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId,
        userId: user.id,
        action: ActivityAction.UPDATE,
        entityType: "WorkflowTemplate",
        entityId: workflow.id,
        title: "Workflow automation settings updated",
        description: name,
        metadata: {
          entityType,
          triggerEvent: trigger.triggerEvent,
          conditionCount: trigger.conditionCount,
        },
      },
    });
  });

  redirect(`/workflows/${workflowId}`);
}

export async function deleteWorkflowTemplate(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);

  const { organizationId } = await getCurrentUserTenant();

  const workflowId = String(formData.get("workflowId"));

  const workflow = await prisma.workflowTemplate.findFirst({
    where: {
      id: workflowId,
      organizationId,
    },
    include: {
      instances: true,
    },
  });

  if (!workflow) {
    throw new Error("Workflow template not found.");
  }

  if (workflow.instances.length > 0) {
    throw new Error(
      "This workflow has existing instances and cannot be deleted. Deactivate it instead."
    );
  }

  await prisma.workflowTemplate.delete({
    where: {
      id: workflow.id,
    },
  });

  redirect("/workflows");
}
