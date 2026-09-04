"use server";

import { randomBytes } from "node:crypto";
import {
  ActivityAction,
  PermissionKey,
  ResearchPublicLinkStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import type { FormActionState } from "@/core/actions/action-state";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";

const value = (data: FormData, key: string, max = 200) =>
  String(data.get(key) ?? "")
    .trim()
    .slice(0, max);

const fail = (error: unknown): FormActionState => ({
  status: "ERROR",
  message:
    error instanceof Error
      ? error.message
      : "Public survey link could not be updated.",
});

function refresh(collectionId: string) {
  revalidatePath("/research", "layout");
  revalidatePath(`/research/collections/${collectionId}`);
}

export async function createPublicSurveyLink(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();

  try {
    const collectionId = value(data, "collectionId", 100);
    const label = value(data, "label", 160);
    const maxRaw = value(data, "maxResponses", 20);
    const expiryRaw = value(data, "expiresAt", 40);
    const maxResponses = maxRaw ? Number(maxRaw) : null;
    const expiresAt = expiryRaw ? new Date(expiryRaw) : null;
    const minimumRaw = value(data, "minimumCompletionSeconds", 10);
    const minimumCompletionSeconds = minimumRaw ? Number(minimumRaw) : null;
    const screeningFieldId = value(data, "screeningFieldId", 100) || null;
    const screeningAllowedValues = value(data, "screeningAllowedValues", 3000)
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 100);
    const disqualificationMessage =
      value(data, "disqualificationMessage", 1000) || null;

    if (label.length < 3) throw new Error("Enter a descriptive link label.");
    if (
      maxResponses !== null &&
      (!Number.isInteger(maxResponses) || maxResponses < 1)
    ) {
      throw new Error("Maximum responses must be a positive whole number.");
    }
    if (
      minimumCompletionSeconds !== null &&
      (!Number.isInteger(minimumCompletionSeconds) ||
        minimumCompletionSeconds < 10 ||
        minimumCompletionSeconds > 86400)
    )
      throw new Error("Minimum completion time must be 10 to 86,400 seconds.");
    if (
      expiresAt &&
      (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date())
    ) {
      throw new Error("Link expiry must be a valid future date and time.");
    }

    const collection = await prisma.researchCollectionWave.findFirst({
      where: { id: collectionId, organizationId },
      select: {
        id: true,
        name: true,
        questionnaire: { select: { name: true } },
        formVersion: {
          select: {
            fields: {
              where: { fieldType: { not: "FILE" } },
              select: { id: true },
            },
          },
        },
      },
    });
    if (!collection) throw new Error("Research collection wave not found.");
    if (
      screeningFieldId &&
      (!collection.formVersion.fields.some(
        (field) => field.id === screeningFieldId,
      ) ||
        !screeningAllowedValues.length ||
        !disqualificationMessage)
    )
      throw new Error(
        "Screening requires a version field, eligible values and participant message.",
      );

    const link = await prisma.researchPublicSurveyLink.create({
      data: {
        organizationId,
        collectionId,
        token: randomBytes(32).toString("base64url"),
        label,
        maxResponses,
        expiresAt,
        allowSaveResume: data.get("allowSaveResume") === "on",
        randomizeQuestions: data.get("randomizeQuestions") === "on",
        minimumCompletionSeconds,
        screeningFieldId,
        screeningAllowedValues: screeningFieldId
          ? screeningAllowedValues
          : undefined,
        disqualificationMessage: screeningFieldId
          ? disqualificationMessage
          : null,
        createdById: user.id,
      },
    });

    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.CREATE,
      entityType: "ResearchPublicSurveyLink",
      entityId: link.id,
      title: "Public research survey link created",
      description: `${collection.questionnaire.name} — ${label}`,
      metadata: {
        collectionId,
        maxResponses,
        expiresAt: expiresAt?.toISOString() ?? null,
        minimumCompletionSeconds,
      },
    });
    refresh(collectionId);
    return {
      status: "SUCCESS",
      message: "Public survey link created and ready to copy.",
    };
  } catch (error) {
    return fail(error);
  }
}

export async function changePublicSurveyLinkStatus(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();

  try {
    const linkId = value(data, "linkId", 100);
    const target = value(data, "status", 30) as ResearchPublicLinkStatus;
    if (!Object.values(ResearchPublicLinkStatus).includes(target)) {
      throw new Error("Select a valid public-link status.");
    }
    const link = await prisma.researchPublicSurveyLink.findFirst({
      where: { id: linkId, organizationId },
    });
    if (!link) throw new Error("Public survey link not found.");

    const allowed: Record<
      ResearchPublicLinkStatus,
      ResearchPublicLinkStatus[]
    > = {
      ACTIVE: [
        ResearchPublicLinkStatus.PAUSED,
        ResearchPublicLinkStatus.REVOKED,
      ],
      PAUSED: [
        ResearchPublicLinkStatus.ACTIVE,
        ResearchPublicLinkStatus.REVOKED,
      ],
      REVOKED: [],
    };
    if (!allowed[link.status].includes(target)) {
      throw new Error(
        `Public link cannot move from ${link.status} to ${target}.`,
      );
    }

    await prisma.researchPublicSurveyLink.update({
      where: { id: link.id },
      data: {
        status: target,
        revokedAt:
          target === ResearchPublicLinkStatus.REVOKED ? new Date() : null,
      },
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.STATUS_CHANGE,
      entityType: "ResearchPublicSurveyLink",
      entityId: link.id,
      title: "Public research survey link status changed",
      description: `${link.status} → ${target}`,
      metadata: { collectionId: link.collectionId },
    });
    refresh(link.collectionId);
    return { status: "SUCCESS", message: "Public survey link status updated." };
  } catch (error) {
    return fail(error);
  }
}
