import {
  sanitizeWorkflowAutomationContext,
  type WorkflowAutomationContext,
} from "@/core/workflow/workflow-automation-rules";
import { signalWorkflowAutomation } from "@/core/workflow/workflow.service";
import { prisma } from "@/lib/prisma";
import {
  Prisma,
  WorkflowAutomationEventStatus,
  WorkflowEntityType,
  WorkflowTriggerEvent,
} from "@prisma/client";

const MAX_ATTEMPTS = 3;
const DEFAULT_BATCH_SIZE = 50;
const STALE_PROCESSING_MINUTES = 15;

export async function enqueueWorkflowAutomationEvent(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    entityType: WorkflowEntityType;
    entityId: string;
    triggerEvent: WorkflowTriggerEvent;
    context: WorkflowAutomationContext;
    initiatedById?: string | null;
    dedupeKey: string;
  },
) {
  const context = sanitizeWorkflowAutomationContext(input.context);
  return tx.workflowAutomationEvent.upsert({
    where: {
      organizationId_dedupeKey: {
        organizationId: input.organizationId,
        dedupeKey: input.dedupeKey,
      },
    },
    update: {},
    create: {
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      triggerEvent: input.triggerEvent,
      context: context as Prisma.InputJsonValue,
      initiatedById: input.initiatedById,
      dedupeKey: input.dedupeKey,
    },
  });
}

export async function processWorkflowAutomationEvents(input?: {
  organizationId?: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(input?.limit ?? DEFAULT_BATCH_SIZE, 1), 100);
  const staleBefore = new Date(
    Date.now() - STALE_PROCESSING_MINUTES * 60 * 1000,
  );
  const events = await prisma.workflowAutomationEvent.findMany({
    where: {
      ...(input?.organizationId
        ? { organizationId: input.organizationId }
        : {}),
      attempts: { lt: MAX_ATTEMPTS },
      OR: [
        { status: WorkflowAutomationEventStatus.PENDING },
        { status: WorkflowAutomationEventStatus.FAILED },
        {
          status: WorkflowAutomationEventStatus.PROCESSING,
          updatedAt: { lt: staleBefore },
        },
      ],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
  });

  let processed = 0;
  let failed = 0;
  let workflowsStarted = 0;
  let skipped = 0;

  for (const event of events) {
    const claimed = await prisma.workflowAutomationEvent.updateMany({
      where: {
        id: event.id,
        attempts: { lt: MAX_ATTEMPTS },
        OR: [
          { status: WorkflowAutomationEventStatus.PENDING },
          { status: WorkflowAutomationEventStatus.FAILED },
          {
            status: WorkflowAutomationEventStatus.PROCESSING,
            updatedAt: { lt: staleBefore },
          },
        ],
      },
      data: {
        status: WorkflowAutomationEventStatus.PROCESSING,
        attempts: { increment: 1 },
        lastError: null,
      },
    });
    if (claimed.count !== 1) {
      skipped += 1;
      continue;
    }

    try {
      const context = jsonContext(event.context);
      const result = await signalWorkflowAutomation({
        organizationId: event.organizationId,
        userId: event.initiatedById,
        entityType: event.entityType,
        entityId: event.entityId,
        triggerEvent: event.triggerEvent,
        context,
      });
      await prisma.workflowAutomationEvent.update({
        where: { id: event.id },
        data: {
          status: WorkflowAutomationEventStatus.PROCESSED,
          startedWorkflowCount: result.started.length,
          processedAt: new Date(),
          lastError: null,
        },
      });
      processed += 1;
      workflowsStarted += result.started.length;
      skipped += result.skipped.length;
    } catch (error) {
      console.error(
        `Workflow automation event ${event.id} failed during processing:`,
        error,
      );
      await prisma.workflowAutomationEvent.update({
        where: { id: event.id },
        data: {
          status: WorkflowAutomationEventStatus.FAILED,
          lastError:
            "Workflow orchestration failed. Review the template and retry processing.",
        },
      });
      failed += 1;
    }
  }

  return {
    checked: events.length,
    processed,
    failed,
    workflowsStarted,
    skipped,
  };
}

function jsonContext(value: Prisma.JsonValue | null) {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return sanitizeWorkflowAutomationContext(value);
}
