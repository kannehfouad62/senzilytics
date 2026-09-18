import { NextResponse } from "next/server";
import { WorkflowDecision, WorkflowEntityType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { decideWorkflowStep } from "@/core/workflow/workflow.service";
import {
  authenticateMobileRequest,
  MobileAuthError,
} from "@/modules/mobile/mobile-auth.service";

const decisionSchema = z.object({
  taskId: z.string().min(1).max(100),
  entityType: z.nativeEnum(WorkflowEntityType),
  entityId: z.string().min(1).max(100),
  decision: z.enum([WorkflowDecision.APPROVE, WorkflowDecision.REJECT]),
  comments: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  try {
    const { user, organization } = await authenticateMobileRequest(request);
    const parsed = decisionSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", errorDescription: "The workflow decision is invalid." },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    const task = await prisma.workflowInstanceStep.findFirst({
      where: {
        id: parsed.data.taskId,
        status: "IN_PROGRESS",
        instance: {
          organizationId: organization.id,
          entityType: parsed.data.entityType,
          entityId: parsed.data.entityId,
          status: "ACTIVE",
        },
      },
      select: { id: true },
    });
    if (!task) {
      return NextResponse.json(
        { error: "not_found", errorDescription: "The assigned workflow step is no longer active." },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    await decideWorkflowStep({
      organizationId: organization.id,
      userId: user.id,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      decision: parsed.data.decision,
      comments: parsed.data.comments || null,
    });

    return NextResponse.json(
      { success: true },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    if (!(error instanceof MobileAuthError)) {
      console.error("Mobile workflow decision failed:", error);
    }
    return NextResponse.json(
      {
        error: error instanceof MobileAuthError ? error.code : "workflow_decision_failed",
        errorDescription:
          error instanceof MobileAuthError
            ? error.message
            : error instanceof Error
              ? error.message
              : "The workflow decision could not be completed.",
      },
      {
        status: error instanceof MobileAuthError ? error.status : 400,
        headers: { "cache-control": "no-store" },
      }
    );
  }
}
