"use server";

import {
  ActivityAction,
  NotificationType,
  PermissionKey,
  ResearchSampleUnitStatus,
  ResearchSamplingExecutionStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import type { FormActionState } from "@/core/actions/action-state";
import { logActivity } from "@/core/activity-log/activity-log.service";
import {
  getApplicationUrl,
  sendTenantNotificationEmail,
} from "@/core/email/email.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  assertActiveExecution,
  assertFieldworkTransition,
} from "@/modules/research/research-fieldwork";

const value = (data: FormData, key: string, max = 500) =>
  String(data.get(key) ?? "")
    .trim()
    .slice(0, max);
const fail = (error: unknown): FormActionState => ({
  status: "ERROR",
  message:
    error instanceof Error ? error.message : "Fieldwork could not be updated.",
});
const refresh = (projectId: string) => {
  revalidatePath("/research", "layout");
  revalidatePath(`/research/projects/${projectId}/sampling-design`);
};

export async function activateSamplingFieldwork(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const executionId = value(data, "executionId", 100);
    const execution = await prisma.researchSamplingExecution.findFirst({
      where: { id: executionId, organizationId },
    });
    if (
      !execution ||
      execution.status !== ResearchSamplingExecutionStatus.APPROVED
    )
      throw new Error("An approved sampling execution is required.");
    await prisma.researchSamplingExecution.update({
      where: { id: execution.id },
      data: {
        status: ResearchSamplingExecutionStatus.ACTIVE,
        activatedAt: new Date(),
      },
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.STATUS_CHANGE,
      entityType: "ResearchSamplingExecution",
      entityId: execution.id,
      title: "Sampling fieldwork activated",
      description: "APPROVED → ACTIVE",
      metadata: { projectId: execution.projectId },
    });
    refresh(execution.projectId);
    return { status: "SUCCESS", message: "Sampling fieldwork activated." };
  } catch (error) {
    return fail(error);
  }
}

export async function closeSamplingFieldwork(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const executionId = value(data, "executionId", 100);
    const execution = await prisma.researchSamplingExecution.findFirst({
      where: { id: executionId, organizationId },
      include: {
        units: {
          where: {
            isReserve: false,
            status: {
              in: [
                ResearchSampleUnitStatus.SELECTED,
                ResearchSampleUnitStatus.ASSIGNED,
                ResearchSampleUnitStatus.CONTACTED,
                ResearchSampleUnitStatus.PARTIAL,
              ],
            },
          },
          select: { id: true },
        },
      },
    });
    if (
      !execution ||
      execution.status !== ResearchSamplingExecutionStatus.ACTIVE
    )
      throw new Error("An active sampling execution is required.");
    if (execution.units.length)
      throw new Error(
        "Resolve every primary sample unit before closing fieldwork.",
      );
    await prisma.researchSamplingExecution.update({
      where: { id: execution.id },
      data: {
        status: ResearchSamplingExecutionStatus.CLOSED,
        closedAt: new Date(),
      },
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.STATUS_CHANGE,
      entityType: "ResearchSamplingExecution",
      entityId: execution.id,
      title: "Sampling fieldwork closed",
      description: "ACTIVE → CLOSED",
      metadata: { projectId: execution.projectId },
    });
    refresh(execution.projectId);
    return { status: "SUCCESS", message: "Sampling fieldwork closed." };
  } catch (error) {
    return fail(error);
  }
}

export async function assignResearchSampleUnit(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const unitId = value(data, "unitId", 100),
      assigneeId = value(data, "assigneeId", 100);
    const dueAt = new Date(value(data, "dueAt", 40));
    if (Number.isNaN(dueAt.valueOf()) || dueAt <= new Date())
      throw new Error("A future fieldwork due date is required.");
    const [unit, assignee] = await Promise.all([
      prisma.researchSampleUnit.findFirst({
        where: { id: unitId, execution: { organizationId } },
        include: { execution: true },
      }),
      prisma.user.findFirst({
        where: { id: assigneeId, organizationId, isActive: true },
        select: { id: true, name: true, email: true },
      }),
    ]);
    if (!unit || !assignee)
      throw new Error("The sample unit or tenant researcher was not found.");
    assertActiveExecution(unit.execution.status);
    if (unit.isReserve)
      throw new Error(
        "Reserve units must be activated through governed replacement.",
      );
    assertFieldworkTransition(unit.status, ResearchSampleUnitStatus.ASSIGNED);
    await prisma.researchSampleUnit.update({
      where: { id: unit.id },
      data: {
        assignedToId: assignee.id,
        assignedAt: new Date(),
        dueAt,
        status: ResearchSampleUnitStatus.ASSIGNED,
        escalationLevel: 0,
        lastEscalatedAt: null,
      },
    });
    const link = `/research/projects/${unit.execution.projectId}/sampling-design`;
    await Promise.allSettled([
      createNotification({
        organizationId,
        userId: assignee.id,
        type: NotificationType.ASSIGNMENT,
        title: "Research fieldwork assigned",
        message: `${unit.unitReference} is due ${dueAt.toLocaleDateString("en-US")}.`,
        link,
      }),
      sendTenantNotificationEmail({
        to: assignee.email,
        subject: "Research fieldwork assignment",
        html: `<p>Hello ${assignee.name},</p><p>Research sample unit <strong>${unit.unitReference}</strong> has been assigned to you and is due ${dueAt.toLocaleDateString("en-US")}.</p><p><a href="${getApplicationUrl()}${link}">Open fieldwork register</a></p>`,
        text: `Research sample unit ${unit.unitReference} is due ${dueAt.toLocaleDateString("en-US")}.`,
      }),
    ]);
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.ASSIGN,
      entityType: "ResearchSampleUnit",
      entityId: unit.id,
      title: "Research sample unit assigned",
      description: `${unit.unitReference} assigned to ${assignee.name}`,
      metadata: {
        projectId: unit.execution.projectId,
        dueAt: dueAt.toISOString(),
      },
    });
    refresh(unit.execution.projectId);
    return {
      status: "SUCCESS",
      message: "Sample unit assigned and researcher notified.",
    };
  } catch (error) {
    return fail(error);
  }
}

export async function recordResearchFieldworkDisposition(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.COLLECT_RESEARCH_DATA);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const unitId = value(data, "unitId", 100);
    const target = value(data, "status", 40) as ResearchSampleUnitStatus;
    const note = value(data, "note", 1000);
    const unit = await prisma.researchSampleUnit.findFirst({
      where: { id: unitId, execution: { organizationId } },
      include: { execution: true },
    });
    if (!unit) throw new Error("Sample unit not found.");
    assertActiveExecution(unit.execution.status);
    if (unit.assignedToId !== user.id)
      throw new Error(
        "Only the assigned researcher may record this disposition.",
      );
    assertFieldworkTransition(unit.status, target);
    if (target !== ResearchSampleUnitStatus.CONTACTED && note.length < 5)
      throw new Error(
        "A disposition note of at least 5 characters is required.",
      );
    const contacted =
      target === ResearchSampleUnitStatus.CONTACTED ||
      target === ResearchSampleUnitStatus.PARTIAL;
    await prisma.researchSampleUnit.update({
      where: { id: unit.id },
      data: {
        status: target,
        dispositionNote: note || unit.dispositionNote,
        contactAttempts: contacted ? { increment: 1 } : undefined,
        lastContactedAt: contacted ? new Date() : unit.lastContactedAt,
        completedAt:
          target === ResearchSampleUnitStatus.COMPLETED ? new Date() : null,
      },
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.STATUS_CHANGE,
      entityType: "ResearchSampleUnit",
      entityId: unit.id,
      title: "Research fieldwork disposition recorded",
      description: `${unit.status} → ${target}`,
      metadata: { projectId: unit.execution.projectId, note },
    });
    refresh(unit.execution.projectId);
    return { status: "SUCCESS", message: "Fieldwork disposition recorded." };
  } catch (error) {
    return fail(error);
  }
}

export async function activateReserveReplacement(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const unitId = value(data, "unitId", 100);
    const original = await prisma.researchSampleUnit.findFirst({
      where: { id: unitId, execution: { organizationId } },
      include: { execution: true },
    });
    if (!original) throw new Error("Original sample unit not found.");
    assertActiveExecution(original.execution.status);
    const replaceable = new Set<ResearchSampleUnitStatus>([
      ResearchSampleUnitStatus.INELIGIBLE,
      ResearchSampleUnitStatus.REFUSED,
      ResearchSampleUnitStatus.WITHDRAWN,
    ]);
    if (!replaceable.has(original.status))
      throw new Error(
        "Only an ineligible, refused, or withdrawn primary unit may be replaced.",
      );
    const reserve = await prisma.researchSampleUnit.findFirst({
      where: {
        executionId: original.executionId,
        isReserve: true,
        status: ResearchSampleUnitStatus.RESERVE,
        ...(original.stratum ? { stratum: original.stratum } : {}),
      },
      orderBy: { selectionOrder: "asc" },
    });
    if (!reserve)
      throw new Error(
        "No eligible reserve unit is available for this stratum.",
      );
    await prisma.$transaction([
      prisma.researchSampleUnit.update({
        where: { id: original.id },
        data: { status: ResearchSampleUnitStatus.REPLACED },
      }),
      prisma.researchSampleUnit.update({
        where: { id: reserve.id },
        data: {
          isReserve: false,
          status: original.assignedToId
            ? ResearchSampleUnitStatus.ASSIGNED
            : ResearchSampleUnitStatus.SELECTED,
          assignedToId: original.assignedToId,
          assignedAt: original.assignedToId ? new Date() : null,
          dueAt: original.dueAt,
          replacementForId: original.id,
        },
      }),
    ]);
    if (original.assignedToId)
      await createNotification({
        organizationId,
        userId: original.assignedToId,
        type: NotificationType.ASSIGNMENT,
        title: "Reserve sample activated",
        message: `${reserve.unitReference} replaced ${original.unitReference}.`,
        link: `/research/projects/${original.execution.projectId}/sampling-design`,
      }).catch(() => undefined);
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.STATUS_CHANGE,
      entityType: "ResearchSampleUnit",
      entityId: reserve.id,
      title: "Governed reserve replacement activated",
      description: `${reserve.unitReference} replaced ${original.unitReference}`,
      metadata: {
        projectId: original.execution.projectId,
        originalUnitId: original.id,
      },
    });
    refresh(original.execution.projectId);
    return {
      status: "SUCCESS",
      message: "Next eligible reserve unit activated with complete lineage.",
    };
  } catch (error) {
    return fail(error);
  }
}
