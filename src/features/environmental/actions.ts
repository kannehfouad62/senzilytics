"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  completeEnvironmentalFormsService,
  recordEnvironmentalDataService,
  reviewEnvironmentalDataService,
} from "@/modules/environmental/environmental-data.service";
import { preparePublishedFormSubmissions } from "@/modules/forms/runtime-form.service";
import {
  ConfigurableFormModule,
  EnvironmentalDataQuality,
  EnvironmentalDataStatus,
  EnvironmentalMetricType,
  PermissionKey,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const required = (data: FormData, key: string) => {
  const value = String(data.get(key) || "").trim();

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
};

const optional = (data: FormData, key: string) =>
  String(data.get(key) || "").trim() || null;

const requiredDate = (data: FormData, key: string) => {
  const value = new Date(required(data, key));

  if (Number.isNaN(value.getTime())) {
    throw new Error(`Enter a valid ${key}.`);
  }

  return value;
};

export async function createEnvironmentalMetric(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_ENVIRONMENTAL);
  const { organizationId } = await getCurrentUserTenant();
  const type = required(data, "type") as EnvironmentalMetricType;

  if (!Object.values(EnvironmentalMetricType).includes(type)) {
    throw new Error("Select a valid metric type.");
  }

  await prisma.environmentalMetricDefinition.create({
    data: {
      organizationId,
      code: required(data, "code").toUpperCase(),
      name: required(data, "name"),
      description: optional(data, "description"),
      type,
      sourceUnit: required(data, "sourceUnit"),
      reportingUnit: required(data, "reportingUnit"),
      conversionFactor: Number(required(data, "conversionFactor")),
      methodology: optional(data, "methodology"),
    },
  });

  redirect("/environmental/metrics");
}

export async function recordEnvironmentalData(
  _previousState: FormActionState,
  data: FormData
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_ENVIRONMENTAL);
  const { organizationId, user } = await getCurrentUserTenant();
  let dataPointId: string;

  try {
    const quality = required(data, "quality") as EnvironmentalDataQuality;

    if (!Object.values(EnvironmentalDataQuality).includes(quality)) {
      throw new Error("Select a valid data-quality classification.");
    }

    const customSubmissions = await preparePublishedFormSubmissions({
      organizationId,
      module: ConfigurableFormModule.ENVIRONMENTAL,
      data,
    });
    const point = await recordEnvironmentalDataService({
      organizationId,
      userId: user.id,
      metricId: required(data, "metricId"),
      siteId: required(data, "siteId"),
      value: Number(required(data, "value")),
      quality,
      periodStart: requiredDate(data, "periodStart"),
      periodEnd: requiredDate(data, "periodEnd"),
      evidenceSummary: optional(data, "evidenceSummary"),
      notes: optional(data, "notes"),
      customSubmissions,
    });

    dataPointId = point.id;
  } catch (error) {
    return {
      status: "ERROR",
      message:
        error instanceof Error
          ? error.message
          : "The environmental data point could not be recorded.",
    };
  }

  redirect(`/environmental/${dataPointId}`);
}

export async function completeEnvironmentalForms(
  _previousState: FormActionState,
  data: FormData
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_ENVIRONMENTAL);
  const { organizationId, user } = await getCurrentUserTenant();
  const dataPointId = required(data, "dataPointId");

  try {
    const submissions = await preparePublishedFormSubmissions({
      organizationId,
      module: ConfigurableFormModule.ENVIRONMENTAL,
      data,
    });
    await completeEnvironmentalFormsService({
      organizationId,
      userId: user.id,
      dataPointId,
      submissions,
    });
  } catch (error) {
    return {
      status: "ERROR",
      message:
        error instanceof Error
          ? error.message
          : "The environmental forms could not be saved.",
    };
  }

  revalidatePath(`/environmental/${dataPointId}`);
  return {
    status: "SUCCESS",
    message: "Environmental forms captured successfully.",
  };
}

export async function reviewEnvironmentalData(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_ENVIRONMENTAL);
  const { organizationId, user } = await getCurrentUserTenant();
  const id = required(data, "id");
  const status = required(data, "status") as EnvironmentalDataStatus;

  if (
    status !== EnvironmentalDataStatus.APPROVED &&
    status !== EnvironmentalDataStatus.REJECTED
  ) {
    throw new Error("Select an approval decision.");
  }

  await reviewEnvironmentalDataService({
    organizationId,
    userId: user.id,
    dataPointId: id,
    status,
  });

  revalidatePath("/environmental");
  revalidatePath(`/environmental/${id}`);
}

export async function createEnvironmentalTarget(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_ENVIRONMENTAL);
  const { organizationId } = await getCurrentUserTenant();
  const metricId = required(data, "metricId");

  if (
    !(await prisma.environmentalMetricDefinition.findFirst({
      where: { id: metricId, organizationId },
    }))
  ) {
    throw new Error("Select a valid metric.");
  }

  await prisma.environmentalTarget.create({
    data: {
      organizationId,
      metricId,
      name: required(data, "name"),
      baselineYear: Number(required(data, "baselineYear")),
      baselineValue: Number(required(data, "baselineValue")),
      targetYear: Number(required(data, "targetYear")),
      targetValue: Number(required(data, "targetValue")),
      description: optional(data, "description"),
    },
  });

  redirect("/environmental/dashboard");
}
