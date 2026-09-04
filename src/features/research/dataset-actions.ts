"use server";

import {
  ActivityAction,
  PermissionKey,
  ResearchDatasetStatus,
  ResearchResponseDisposition,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import type { FormActionState } from "@/core/actions/action-state";
import { logActivity } from "@/core/activity-log/activity-log.service";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";

const text = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
const failure = (cause: unknown): FormActionState => ({
  status: "ERROR",
  message:
    cause instanceof Error
      ? cause.message
      : "Dataset governance could not be updated.",
});
const refresh = () => revalidatePath("/research", "layout");

export async function reviewResearchResponse(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const responseId = text(data, "assignmentId");
    const requestedSource = text(data, "responseSource");
    const responseSource =
      requestedSource === "PUBLIC" || requestedSource === "FIELDWORK"
        ? requestedSource
        : "ASSIGNED";
    const raw = text(data, "disposition");
    if (
      !Object.values(ResearchResponseDisposition).includes(
        raw as ResearchResponseDisposition,
      )
    )
      throw new Error("Select a valid response disposition.");
    const notes = text(data, "qualityNotes");
    if (raw !== ResearchResponseDisposition.INCLUDED && !notes)
      throw new Error(
        "Quality notes are required when flagging or excluding a response.",
      );

    const response =
      responseSource === "PUBLIC"
        ? await prisma.researchPublicResponse.findFirst({
            where: { id: responseId, organizationId },
            include: { collection: true },
          })
        : responseSource === "FIELDWORK"
          ? await prisma.researchFieldworkResponse.findFirst({
              where: { id: responseId, organizationId },
              include: { collection: true },
            })
          : await prisma.researchQuestionnaireAssignment.findFirst({
            where: { id: responseId, organizationId, status: "COMPLETED" },
            include: { collection: true },
          });
    if (!response) throw new Error("Completed response not found.");
    if (
      response.collection.datasetStatus === ResearchDatasetStatus.LOCKED ||
      response.collection.datasetStatus === ResearchDatasetStatus.APPROVED
    )
      throw new Error("Locked or approved datasets cannot be changed.");

    const update = {
      disposition: raw as ResearchResponseDisposition,
      qualityNotes: notes || null,
      reviewedById: user.id,
      reviewedAt: new Date(),
    };
    if (responseSource === "PUBLIC")
      await prisma.researchPublicResponse.update({
        where: { id: response.id },
        data: update,
      });
    else if (responseSource === "FIELDWORK")
      await prisma.researchFieldworkResponse.update({
        where: { id: response.id },
        data: {
          disposition: update.disposition,
          backcheckNotes: update.qualityNotes,
          backcheckedById: user.id,
          backcheckedAt: update.reviewedAt,
          backcheckStatus:
            update.disposition === ResearchResponseDisposition.INCLUDED
              ? "APPROVED"
              : update.disposition === ResearchResponseDisposition.EXCLUDED
                ? "REJECTED"
                : "PENDING",
        },
      });
    else
      await prisma.researchQuestionnaireAssignment.update({
        where: { id: response.id },
        data: update,
      });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.UPDATE,
      entityType: "ResearchResponseQuality",
      entityId: response.id,
      title: "Research response disposition updated",
      description: raw,
      metadata: {
        collectionId: response.collectionId,
        responseSource,
        qualityNotes: notes || null,
      },
    });
    refresh();
    return { status: "SUCCESS", message: "Response quality decision saved." };
  } catch (cause) {
    return failure(cause);
  }
}

export async function changeResearchDatasetStatus(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  const [{ organizationId, user }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  if (!permissions.includes(PermissionKey.MANAGE_RESEARCH_DATASETS))
    throw new Error("Dataset management permission is required.");
  try {
    const collectionId = text(data, "collectionId");
    const raw = text(data, "status") as ResearchDatasetStatus;
    if (!Object.values(ResearchDatasetStatus).includes(raw))
      throw new Error("Select a valid dataset status.");
    const dataset = await prisma.researchCollectionWave.findFirst({
      where: { id: collectionId, organizationId },
      include: {
        assignments: {
          where: { status: "COMPLETED", disposition: "FLAGGED" },
          select: { id: true },
        },
        publicResponses: {
          where: { disposition: "FLAGGED" },
          select: { id: true },
        },
      },
    });
    if (!dataset) throw new Error("Research dataset not found.");
    const allowed: Record<ResearchDatasetStatus, ResearchDatasetStatus[]> = {
      OPEN: [ResearchDatasetStatus.UNDER_REVIEW],
      UNDER_REVIEW: [ResearchDatasetStatus.OPEN, ResearchDatasetStatus.LOCKED],
      LOCKED: [
        ResearchDatasetStatus.UNDER_REVIEW,
        ResearchDatasetStatus.APPROVED,
      ],
      APPROVED: [],
    };
    if (!allowed[dataset.datasetStatus].includes(raw))
      throw new Error(
        `Dataset cannot move from ${dataset.datasetStatus} to ${raw}.`,
      );
    if (raw === ResearchDatasetStatus.LOCKED && dataset.status !== "CLOSED")
      throw new Error("Close the collection wave before locking its dataset.");
    if (
      raw === ResearchDatasetStatus.LOCKED &&
      (dataset.assignments.length || dataset.publicResponses.length)
    )
      throw new Error(
        "Resolve all flagged responses before locking the dataset.",
      );
    if (
      raw === ResearchDatasetStatus.APPROVED &&
      !permissions.includes(PermissionKey.APPROVE_RESEARCH_OUTPUTS)
    )
      throw new Error("Research output approval permission is required.");
    const now = new Date();
    await prisma.researchCollectionWave.update({
      where: { id: dataset.id },
      data: {
        datasetStatus: raw,
        datasetOwnerId: dataset.datasetOwnerId ?? user.id,
        datasetLockedById:
          raw === ResearchDatasetStatus.LOCKED
            ? user.id
            : raw === ResearchDatasetStatus.UNDER_REVIEW
              ? null
              : dataset.datasetLockedById,
        datasetLockedAt:
          raw === ResearchDatasetStatus.LOCKED
            ? now
            : raw === ResearchDatasetStatus.UNDER_REVIEW
              ? null
              : dataset.datasetLockedAt,
        datasetApprovedById:
          raw === ResearchDatasetStatus.APPROVED ? user.id : null,
        datasetApprovedAt: raw === ResearchDatasetStatus.APPROVED ? now : null,
      },
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.STATUS_CHANGE,
      entityType: "ResearchDataset",
      entityId: dataset.id,
      title: "Research dataset status changed",
      description: `${dataset.datasetStatus} → ${raw}`,
    });
    refresh();
    return { status: "SUCCESS", message: "Dataset governance status updated." };
  } catch (cause) {
    return failure(cause);
  }
}
