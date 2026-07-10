import { prisma } from "@/lib/prisma";
import {
  WorkflowDecision,
  WorkflowEntityType,
  WorkflowInstanceStatus,
  WorkflowStepStatus,
} from "@prisma/client";

export async function findActiveWorkflowTemplate(input: {
  organizationId: string;
  entityType: WorkflowEntityType;
}) {
  return prisma.workflowTemplate.findFirst({
    where: {
      organizationId: input.organizationId,
      entityType: input.entityType,
      isActive: true,
    },
    include: {
      steps: {
        orderBy: {
          sequence: "asc",
        },
        include: {
          approveNextStep: true,
          rejectNextStep: true,
        },
      },
    },
  });
}

export async function createWorkflowInstance(input: {
  organizationId: string;
  templateId: string;
  entityType: WorkflowEntityType;
  entityId: string;
  startedById?: string | null;
  currentStepId?: string | null;
}) {
  return prisma.workflowInstance.create({
    data: {
      organizationId: input.organizationId,
      templateId: input.templateId,
      entityType: input.entityType,
      entityId: input.entityId,
      status: WorkflowInstanceStatus.ACTIVE,
      startedById: input.startedById,
      currentStepId: input.currentStepId,
    },
  });
}

export async function createWorkflowInstanceSteps(
  steps: {
    instanceId: string;
    templateStepId: string;
    name: string;
    stepType: any;
    sequence: number;
    status: WorkflowStepStatus;
    assignedRole?: any;
    dueAt?: Date | null;
  }[]
) {
  return prisma.workflowInstanceStep.createMany({
    data: steps,
  });
}

export async function setWorkflowCurrentStep(input: {
  instanceId: string;
  currentStepId: string;
}) {
  return prisma.workflowInstance.update({
    where: {
      id: input.instanceId,
    },
    data: {
      currentStepId: input.currentStepId,
    },
  });
}

export async function findWorkflowInstanceByEntity(input: {
  organizationId: string;
  entityType: WorkflowEntityType;
  entityId: string;
}) {
  return prisma.workflowInstance.findFirst({
    where: {
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      status: WorkflowInstanceStatus.ACTIVE,
    },
    include: {
      steps: {
        orderBy: {
          sequence: "asc",
        },
      },
      template: {
        include: {
          steps: {
            orderBy: {
              sequence: "asc",
            },
            include: {
              approveNextStep: true,
              rejectNextStep: true,
            },
          },
        },
      },
    },
  });
}

export async function updateWorkflowStepStatus(input: {
  stepId: string;
  status: WorkflowStepStatus;
  startedAt?: Date | null;
  dueAt?: Date | null;
  completedAt?: Date | null;
}) {
  return prisma.workflowInstanceStep.update({
    where: {
      id: input.stepId,
    },
    data: {
      status: input.status,
      startedAt: input.startedAt,
      dueAt: input.dueAt,
      completedAt: input.completedAt,
    },
  });
}

export async function completeWorkflowInstance(input: { instanceId: string }) {
  return prisma.workflowInstance.update({
    where: {
      id: input.instanceId,
    },
    data: {
      status: WorkflowInstanceStatus.COMPLETED,
      completedAt: new Date(),
    },
  });
}

export async function completeWorkflowStepWithDecision(input: {
  stepId: string;
  status: WorkflowStepStatus;
  decision: WorkflowDecision;
  completedById: string;
  comments?: string | null;
}) {
  return prisma.workflowInstanceStep.update({
    where: {
      id: input.stepId,
    },
    data: {
      status: input.status,
      decision: input.decision,
      completedById: input.completedById,
      comments: input.comments,
      completedAt: new Date(),
    },
  });
}

export async function findWorkflowInstanceStep(input: {
  instanceId: string;
  templateStepId: string;
}) {
  return prisma.workflowInstanceStep.findFirst({
    where: {
      instanceId: input.instanceId,
      templateStepId: input.templateStepId,
    },
  });
}

export async function findWorkflowTemplateStepById(input: {
  templateId: string;
  stepId: string;
}) {
  return prisma.workflowTemplateStep.findFirst({
    where: {
      id: input.stepId,
      templateId: input.templateId,
    },
  });
}