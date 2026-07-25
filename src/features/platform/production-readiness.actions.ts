"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePlatformAdministrator } from "@/lib/platform-admin";
import {
  decideProductionReadinessReview,
  initializeProductionReadinessReview,
  submitProductionReadinessReview,
  updateProductionReadinessControl,
  updateProductionReadinessMetadata,
} from "@/modules/platform/production-readiness.service";
import {
  ProductionReadinessControlStatus,
  ProductionReadinessReviewStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

const value = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
const optional = (data: FormData, key: string) => value(data, key) || null;

function dateValue(data: FormData, key: string) {
  const raw = value(data, key);
  if (!raw) return null;
  const result = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(result.getTime())) {
    throw new Error(`${key} is not a valid date.`);
  }
  return result;
}

function failure(cause: unknown, fallback: string): FormActionState {
  return {
    status: "ERROR",
    message: cause instanceof Error ? cause.message : fallback,
  };
}

function revalidateProductionAssurance(organizationId: string) {
  revalidatePath("/platform/operations");
  revalidatePath("/platform/tenants");
  revalidatePath(`/platform/tenants/${organizationId}`);
}

export async function initializeProductionReadinessAction(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const actor = await requirePlatformAdministrator();
  const organizationId = value(data, "organizationId");
  try {
    if (!organizationId) throw new Error("Select a production tenant.");
    await initializeProductionReadinessReview(organizationId, actor);
    revalidateProductionAssurance(organizationId);
    return {
      status: "SUCCESS",
      message: "Production Assurance review initialized.",
    };
  } catch (cause) {
    return failure(cause, "The Production Assurance review could not be initialized.");
  }
}

export async function updateProductionReadinessMetadataAction(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const actor = await requirePlatformAdministrator();
  const organizationId = value(data, "organizationId");
  try {
    await updateProductionReadinessMetadata(
      {
        organizationId,
        reviewId: value(data, "reviewId"),
        targetReviewAt: dateValue(data, "targetReviewAt"),
        executiveSummary: optional(data, "executiveSummary"),
      },
      actor,
    );
    revalidateProductionAssurance(organizationId);
    return { status: "SUCCESS", message: "Readiness ownership updated." };
  } catch (cause) {
    return failure(cause, "The Production Assurance review could not be updated.");
  }
}

export async function updateProductionReadinessControlAction(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const actor = await requirePlatformAdministrator();
  const organizationId = value(data, "organizationId");
  try {
    const rawStatus = value(data, "status") as ProductionReadinessControlStatus;
    if (!Object.values(ProductionReadinessControlStatus).includes(rawStatus)) {
      throw new Error("Select a valid control result.");
    }
    await updateProductionReadinessControl(
      {
        organizationId,
        controlId: value(data, "controlId"),
        status: rawStatus,
        ownerId: optional(data, "ownerId"),
        dueAt: dateValue(data, "dueAt"),
        testMethod: optional(data, "testMethod"),
        evidenceSummary: optional(data, "evidenceSummary"),
        resultNotes: optional(data, "resultNotes"),
        evidenceUrl: optional(data, "evidenceUrl"),
        testedAt: dateValue(data, "testedAt"),
      },
      actor,
    );
    revalidateProductionAssurance(organizationId);
    return { status: "SUCCESS", message: "Control evidence recorded." };
  } catch (cause) {
    return failure(cause, "The readiness control could not be updated.");
  }
}

export async function submitProductionReadinessAction(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const actor = await requirePlatformAdministrator();
  const organizationId = value(data, "organizationId");
  try {
    await submitProductionReadinessReview(
      {
        organizationId,
        reviewId: value(data, "reviewId"),
        submissionNotes: optional(data, "submissionNotes"),
      },
      actor,
    );
    revalidateProductionAssurance(organizationId);
    return {
      status: "SUCCESS",
      message: "Production Assurance review submitted for approval.",
    };
  } catch (cause) {
    return failure(cause, "The readiness review could not be submitted.");
  }
}

export async function decideProductionReadinessAction(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const actor = await requirePlatformAdministrator();
  const organizationId = value(data, "organizationId");
  try {
    const rawDecision = value(data, "decision");
    if (
      rawDecision !== ProductionReadinessReviewStatus.APPROVED &&
      rawDecision !== ProductionReadinessReviewStatus.REJECTED
    ) {
      throw new Error("Select approve or reject.");
    }
    await decideProductionReadinessReview(
      {
        organizationId,
        reviewId: value(data, "reviewId"),
        decision: rawDecision,
        reviewNotes: optional(data, "reviewNotes"),
      },
      actor,
    );
    revalidateProductionAssurance(organizationId);
    return {
      status: "SUCCESS",
      message: `Production Assurance review ${rawDecision.toLowerCase()}.`,
    };
  } catch (cause) {
    return failure(cause, "The readiness decision could not be recorded.");
  }
}
