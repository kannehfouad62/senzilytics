"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  reviewPredictiveSignalService,
  runPredictiveIntelligenceService,
  updatePredictivePolicyService,
} from "@/modules/intelligence/predictive-intelligence.service";
import {
  PermissionKey,
  PredictiveSignalReviewDecision,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

const value = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
const required = (data: FormData, key: string) => {
  const result = value(data, key);
  if (!result) throw new Error(`${key.replaceAll("_", " ")} is required.`);
  return result;
};
const integer = (data: FormData, key: string) => {
  const result = Number(required(data, key));
  if (!Number.isInteger(result)) {
    throw new Error(`${key.replaceAll("_", " ")} must be a whole number.`);
  }
  return result;
};
const failure = (cause: unknown, fallback: string): FormActionState => ({
  status: "ERROR",
  message: cause instanceof Error ? cause.message : fallback,
});
const success = (message: string): FormActionState => ({
  status: "SUCCESS",
  message,
});

function revalidate(signalId?: string) {
  revalidatePath("/intelligence");
  revalidatePath("/intelligence/predictive");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  if (signalId) revalidatePath(`/intelligence/predictive/${signalId}`);
}

export async function runPredictiveAnalysis(
  _state: FormActionState,
  _data: FormData,
): Promise<FormActionState> {
  void _state;
  void _data;
  await requirePermission(PermissionKey.MANAGE_PREDICTIVE_INTELLIGENCE);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const result = await runPredictiveIntelligenceService(
      organizationId,
      user.id,
    );
    revalidate();
    return success(
      `Analysis completed: ${result.created ?? 0} new, ${result.refreshed ?? 0} refreshed, and ${result.conditionsCleared ?? 0} cleared conditions.`,
    );
  } catch (cause) {
    return failure(cause, "Predictive analysis could not be completed.");
  }
}

export async function updatePredictivePolicy(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_PREDICTIVE_INTELLIGENCE);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    await updatePredictivePolicyService(
      {
        organizationId,
        isActive: data.get("isActive") === "on",
        lookbackDays: integer(data, "lookbackDays"),
        minimumEventCount: integer(data, "minimumEventCount"),
        deteriorationThresholdPercent: integer(
          data,
          "deteriorationThresholdPercent",
        ),
        overdueActionThreshold: integer(data, "overdueActionThreshold"),
        controlFailureThreshold: integer(data, "controlFailureThreshold"),
        reviewCadenceDays: integer(data, "reviewCadenceDays"),
      },
      user.id,
    );
    revalidate();
    return success("Predictive intelligence policy updated.");
  } catch (cause) {
    return failure(cause, "Predictive intelligence policy could not be updated.");
  }
}

export async function reviewPredictiveSignal(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_PREDICTIVE_INTELLIGENCE);
  const { organizationId, user } = await getCurrentUserTenant();
  const signalId = required(data, "signalId");
  try {
    const rawDecision = required(data, "decision");
    if (!Object.values(PredictiveSignalReviewDecision).includes(
      rawDecision as PredictiveSignalReviewDecision,
    )) {
      throw new Error("Select a valid review decision.");
    }
    await reviewPredictiveSignalService(
      {
        organizationId,
        signalId,
        decision: rawDecision as PredictiveSignalReviewDecision,
        rationale: required(data, "rationale"),
        ownerId: value(data, "ownerId") || null,
      },
      user.id,
    );
    revalidate(signalId);
    return success("Predictive signal review recorded.");
  } catch (cause) {
    return failure(cause, "Predictive signal review could not be recorded.");
  }
}
