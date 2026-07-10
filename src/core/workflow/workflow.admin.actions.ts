"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions";
import { PermissionKey, UserRole, WorkflowEntityType, WorkflowStepType,
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

export async function createWorkflowTemplate(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);

  const { organizationId } = await getCurrentUserTenant();

  const name = String(formData.get("name"));
  const description = String(formData.get("description"));
  const entityType = formData.get("entityType") as WorkflowEntityType;

  const template = await prisma.workflowTemplate.create({
    data: {
      organizationId,
      name,
      description,
      entityType,
      isActive: true,
    },
  });

  const stepNames = formData.getAll("stepName").map(String);
  const stepTypes = formData.getAll("stepType").map(String);
  const requiredRoles = formData.getAll("requiredRole").map(String);
  const slaHours = formData.getAll("slaHours").map(String);

  for (let index = 0; index < stepNames.length; index++) {
    if (!stepNames[index]) continue;

    await prisma.workflowTemplateStep.create({
      data: {
        templateId: template.id,
        name: stepNames[index],
        stepType: stepTypes[index] as WorkflowStepType,
        sequence: index + 1,
        requiredRole:
          requiredRoles[index] === "NONE"
            ? null
            : (requiredRoles[index] as UserRole),
        slaHours: slaHours[index] ? Number(slaHours[index]) : null,
      },
    });
  }

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

  const { organizationId } = await getCurrentUserTenant();

  const workflowId = String(formData.get("workflowId"));
  const name = String(formData.get("name"));
  const description = String(formData.get("description"));
  const entityType = formData.get("entityType") as WorkflowEntityType;

  await prisma.workflowTemplate.updateMany({
    where: {
      id: workflowId,
      organizationId,
    },
    data: {
      name,
      description,
      entityType,
    },
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