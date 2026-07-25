"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  createPerformanceIndicatorService,
  createPerformanceTargetService,
  recordPerformanceMeasurementService,
  reviewPerformanceMeasurementService,
  setPerformanceIndicatorActiveService,
} from "@/modules/performance/performance-scorecard.service";
import {
  PerformanceIndicatorDirection,
  PerformanceIndicatorFrequency,
  PerformanceIndicatorSource,
  PerformanceIndicatorType,
  PerformanceMeasurementStatus,
  PerformanceSystemMetric,
  PermissionKey,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

const success = (message: string): FormActionState => ({
  status: "SUCCESS",
  message,
});
const failure = (error: unknown, fallback: string): FormActionState => ({
  status: "ERROR",
  message: error instanceof Error ? error.message : fallback,
});
const required = (data: FormData, key: string) => {
  const value = String(data.get(key) ?? "").trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
};
const optional = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim() || null;
const requiredNumber = (data: FormData, key: string) => {
  const value = Number(required(data, key));
  if (!Number.isFinite(value)) throw new Error(`Enter a valid ${key}.`);
  return value;
};
const requiredDate = (data: FormData, key: string) => {
  const value = new Date(required(data, key));
  if (Number.isNaN(value.getTime())) throw new Error(`Enter a valid ${key}.`);
  return value;
};
const optionalDate = (data: FormData, key: string) => {
  const raw = optional(data, key);
  if (!raw) return null;
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) throw new Error(`Enter a valid ${key}.`);
  return value;
};
const enumValue = <T extends Record<string, string>>(
  values: T,
  raw: string,
  message: string,
) => {
  if (!Object.values(values).includes(raw)) throw new Error(message);
  return raw as T[keyof T];
};

export async function createPerformanceIndicator(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  try {
    await requirePermission(PermissionKey.MANAGE_PERFORMANCE_SCORECARDS);
    const { organizationId, user } = await getCurrentUserTenant();
    const source = enumValue(
      PerformanceIndicatorSource,
      required(data, "source"),
      "Select a valid data source.",
    );
    const rawSystemMetric = optional(data, "systemMetric");
    const systemMetric = rawSystemMetric
      ? enumValue(
          PerformanceSystemMetric,
          rawSystemMetric,
          "Select a valid system metric.",
        )
      : null;
    const unit =
      source === PerformanceIndicatorSource.SYSTEM
        ? "calculated"
        : required(data, "unit");

    await createPerformanceIndicatorService({
      organizationId,
      userId: user.id,
      code: required(data, "code"),
      name: required(data, "name"),
      description: optional(data, "description"),
      category: required(data, "category"),
      type: enumValue(
        PerformanceIndicatorType,
        required(data, "type"),
        "Select a valid indicator type.",
      ),
      direction: enumValue(
        PerformanceIndicatorDirection,
        required(data, "direction"),
        "Select a valid performance direction.",
      ),
      unit,
      reportingFrequency: enumValue(
        PerformanceIndicatorFrequency,
        required(data, "reportingFrequency"),
        "Select a valid reporting frequency.",
      ),
      source,
      systemMetric,
      methodology: optional(data, "methodology"),
      ownerId: optional(data, "ownerId"),
    });
    revalidatePath("/performance");
    return success("Performance indicator created.");
  } catch (error) {
    return failure(error, "The performance indicator could not be created.");
  }
}

export async function createPerformanceTarget(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  try {
    await requirePermission(PermissionKey.MANAGE_PERFORMANCE_SCORECARDS);
    const { organizationId, user } = await getCurrentUserTenant();
    await createPerformanceTargetService({
      organizationId,
      userId: user.id,
      indicatorId: required(data, "indicatorId"),
      siteId: optional(data, "siteId"),
      departmentId: optional(data, "departmentId"),
      targetValue: requiredNumber(data, "targetValue"),
      warningThreshold: requiredNumber(data, "warningThreshold"),
      criticalThreshold: requiredNumber(data, "criticalThreshold"),
      effectiveFrom: requiredDate(data, "effectiveFrom"),
      effectiveTo: optionalDate(data, "effectiveTo"),
      rationale: optional(data, "rationale"),
    });
    revalidatePath("/performance");
    return success("Effective-dated performance target created.");
  } catch (error) {
    return failure(error, "The performance target could not be created.");
  }
}

export async function recordPerformanceMeasurement(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  try {
    await requirePermission(PermissionKey.MANAGE_PERFORMANCE_SCORECARDS);
    const { organizationId, user } = await getCurrentUserTenant();
    await recordPerformanceMeasurementService({
      organizationId,
      userId: user.id,
      indicatorId: required(data, "indicatorId"),
      siteId: optional(data, "siteId"),
      departmentId: optional(data, "departmentId"),
      periodStart: requiredDate(data, "periodStart"),
      periodEnd: requiredDate(data, "periodEnd"),
      value: requiredNumber(data, "value"),
      evidenceSummary: optional(data, "evidenceSummary"),
      notes: optional(data, "notes"),
    });
    revalidatePath("/performance");
    return success("Measurement saved as a draft for review.");
  } catch (error) {
    return failure(error, "The performance measurement could not be recorded.");
  }
}

export async function reviewPerformanceMeasurement(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  try {
    await requirePermission(PermissionKey.MANAGE_PERFORMANCE_SCORECARDS);
    const { organizationId, user } = await getCurrentUserTenant();
    const status = enumValue(
      PerformanceMeasurementStatus,
      required(data, "status"),
      "Select a valid review decision.",
    );
    if (
      status !== PerformanceMeasurementStatus.APPROVED &&
      status !== PerformanceMeasurementStatus.REJECTED
    ) {
      throw new Error("A measurement can only be approved or rejected.");
    }
    await reviewPerformanceMeasurementService({
      organizationId,
      userId: user.id,
      measurementId: required(data, "measurementId"),
      status,
      reviewNotes: optional(data, "reviewNotes"),
    });
    revalidatePath("/performance");
    return success(`Measurement ${status.toLowerCase()}.`);
  } catch (error) {
    return failure(error, "The measurement review could not be completed.");
  }
}

export async function setPerformanceIndicatorActive(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  try {
    await requirePermission(PermissionKey.MANAGE_PERFORMANCE_SCORECARDS);
    const { organizationId, user } = await getCurrentUserTenant();
    const isActive = required(data, "isActive") === "true";
    await setPerformanceIndicatorActiveService({
      organizationId,
      userId: user.id,
      indicatorId: required(data, "indicatorId"),
      isActive,
    });
    revalidatePath("/performance");
    return success(`Indicator ${isActive ? "activated" : "retired"}.`);
  } catch (error) {
    return failure(error, "The indicator status could not be changed.");
  }
}
