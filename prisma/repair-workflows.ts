import "dotenv/config";

import { PrismaClient, WorkflowStepStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is missing. Confirm it exists in the project .env file."
  );
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

function calculateDueAt(slaHours?: number | null) {
  if (!slaHours) {
    return null;
  }

  return new Date(Date.now() + slaHours * 60 * 60 * 1000);
}

async function main() {
  const instances = await prisma.workflowInstance.findMany({
    include: {
      template: {
        include: {
          steps: {
            orderBy: {
              sequence: "asc",
            },
          },
        },
      },
      steps: {
        orderBy: {
          sequence: "asc",
        },
      },
    },
  });

  let repairedInstances = 0;
  let repairedSteps = 0;

  for (const instance of instances) {
    const currentInstanceStep =
      instance.steps.find((step) => step.id === instance.currentStepId) ??
      instance.steps.find(
        (step) => step.templateStepId === instance.currentStepId
      ) ??
      instance.steps.find(
        (step) => step.status === WorkflowStepStatus.IN_PROGRESS
      );

    if (!currentInstanceStep) {
      console.warn(
        `Skipped workflow instance ${instance.id}: no current step found.`
      );

      continue;
    }

    if (instance.currentStepId !== currentInstanceStep.id) {
      await prisma.workflowInstance.update({
        where: {
          id: instance.id,
        },
        data: {
          currentStepId: currentInstanceStep.id,
        },
      });

      repairedInstances++;
    }

    const templateStep = instance.template.steps.find(
      (step) => step.id === currentInstanceStep.templateStepId
    );

    if (
      currentInstanceStep.status === WorkflowStepStatus.IN_PROGRESS &&
      (!currentInstanceStep.startedAt || !currentInstanceStep.dueAt)
    ) {
      const startedAt = currentInstanceStep.startedAt ?? new Date();

      await prisma.workflowInstanceStep.update({
        where: {
          id: currentInstanceStep.id,
        },
        data: {
          startedAt,
          dueAt:
            currentInstanceStep.dueAt ??
            calculateDueAt(templateStep?.slaHours),
        },
      });

      repairedSteps++;
    }

    const pendingSteps = instance.steps.filter(
      (step) =>
        step.id !== currentInstanceStep.id &&
        step.status === WorkflowStepStatus.PENDING &&
        step.dueAt !== null
    );

    for (const pendingStep of pendingSteps) {
      await prisma.workflowInstanceStep.update({
        where: {
          id: pendingStep.id,
        },
        data: {
          startedAt: null,
          dueAt: null,
        },
      });

      repairedSteps++;
    }
  }

  console.log("Workflow repair completed.");
  console.log(`Instances repaired: ${repairedInstances}`);
  console.log(`Steps repaired: ${repairedSteps}`);
}

main()
  .catch((error) => {
    console.error("Workflow repair failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });