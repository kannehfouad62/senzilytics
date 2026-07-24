"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  completeEsgFormsService,
  createEsgDisclosurePeriodService,
  recordEsgDataService,
  transitionEsgDisclosureService,
} from "@/modules/esg/esg-disclosure.service";
import { preparePublishedFormSubmissions } from "@/modules/forms/runtime-form.service";
import {
  ConfigurableFormModule,
  EsgDataQuality,
  EsgDisclosureStatus,
  EsgPillar,
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

export async function createEsgFramework(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_ESG);
  const { organizationId } = await getCurrentUserTenant();
  await prisma.esgFramework.create({
    data: {
      organizationId,
      code: required(data, "code").toUpperCase(),
      name: required(data, "name"),
      version: optional(data, "version"),
      description: optional(data, "description"),
    },
  });
  redirect("/esg/frameworks");
}

export async function createEsgMetric(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_ESG);
  const { organizationId } = await getCurrentUserTenant();
  const pillar = required(data, "pillar") as EsgPillar;
  const frameworkId = optional(data, "frameworkId");
  const environmentalMetricId = optional(data, "environmentalMetricId");

  if (!Object.values(EsgPillar).includes(pillar)) {
    throw new Error("Select a valid ESG pillar.");
  }

  const [framework, environmentalMetric] = await Promise.all([
    frameworkId
      ? prisma.esgFramework.findFirst({
          where: { id: frameworkId, organizationId },
        })
      : null,
    environmentalMetricId
      ? prisma.environmentalMetricDefinition.findFirst({
          where: { id: environmentalMetricId, organizationId },
        })
      : null,
  ]);

  if (frameworkId && !framework) {
    throw new Error("Select a valid tenant ESG framework.");
  }

  if (environmentalMetricId && !environmentalMetric) {
    throw new Error("Select a valid tenant environmental metric.");
  }

  await prisma.esgMetricDefinition.create({
    data: {
      organizationId,
      code: required(data, "code").toUpperCase(),
      name: required(data, "name"),
      pillar,
      unit: required(data, "unit"),
      frameworkId,
      environmentalMetricId,
      disclosureReference: optional(data, "disclosureReference"),
      methodology: optional(data, "methodology"),
    },
  });
  redirect("/esg/frameworks");
}

export async function createEsgPeriod(
  _previousState: FormActionState,
  data: FormData
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_ESG);
  const { organizationId, user } = await getCurrentUserTenant();
  let periodId: string;

  try {
    const customSubmissions = await preparePublishedFormSubmissions({
      organizationId,
      module: ConfigurableFormModule.ESG,
      data,
    });
    const period = await createEsgDisclosurePeriodService({
      organizationId,
      userId: user.id,
      name: required(data, "name"),
      periodStart: requiredDate(data, "periodStart"),
      periodEnd: requiredDate(data, "periodEnd"),
      boundaryDescription: required(data, "boundaryDescription"),
      customSubmissions,
    });

    periodId = period.id;
  } catch (error) {
    return {
      status: "ERROR",
      message:
        error instanceof Error
          ? error.message
          : "The ESG disclosure period could not be created.",
    };
  }

  redirect(`/esg/${periodId}`);
}

export async function completeEsgForms(
  _previousState: FormActionState,
  data: FormData
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_ESG);
  const { organizationId, user } = await getCurrentUserTenant();
  const periodId = required(data, "periodId");

  try {
    const submissions = await preparePublishedFormSubmissions({
      organizationId,
      module: ConfigurableFormModule.ESG,
      data,
    });
    await completeEsgFormsService({
      organizationId,
      userId: user.id,
      periodId,
      submissions,
    });
  } catch (error) {
    return {
      status: "ERROR",
      message:
        error instanceof Error
          ? error.message
          : "The ESG forms could not be saved.",
    };
  }

  revalidatePath(`/esg/${periodId}`);
  return {
    status: "SUCCESS",
    message: "ESG forms captured successfully.",
  };
}

export async function recordEsgData(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_ESG);
  const { organizationId, user } = await getCurrentUserTenant();
  const periodId = required(data, "periodId");
  const metricId = required(data, "metricId");
  const quality = required(data, "quality") as EsgDataQuality;

  if (!Object.values(EsgDataQuality).includes(quality)) {
    throw new Error("Select a valid ESG data quality.");
  }

  const value = Number(required(data, "value"));

  if (!Number.isFinite(value)) {
    throw new Error("Enter a valid ESG metric value.");
  }

  await recordEsgDataService({
    organizationId,
    userId: user.id,
    periodId,
    metricId,
    value,
    quality,
    evidenceSummary: optional(data, "evidenceSummary"),
    sourceDescription: optional(data, "sourceDescription"),
  });

  revalidatePath("/esg");
  revalidatePath(`/esg/${periodId}`);
}

export async function transitionEsgPeriod(
  _previousState: FormActionState,
  data: FormData
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_ESG);
  const { organizationId, user } = await getCurrentUserTenant();
  const id = required(data, "id");
  const status = required(data, "status") as EsgDisclosureStatus;
  try {
    if (!Object.values(EsgDisclosureStatus).includes(status)) {
      throw new Error("Select a valid ESG disclosure status.");
    }
    await transitionEsgDisclosureService({
      organizationId,
      userId: user.id,
      periodId: id,
      status,
    });
  } catch (error) {
    return {
      status: "ERROR",
      message:
        error instanceof Error
          ? error.message
          : "The ESG disclosure lifecycle could not be updated.",
    };
  }

  revalidatePath("/esg");
  revalidatePath(`/esg/${id}`);
  return {
    status: "SUCCESS",
    message: `ESG disclosure moved to ${status
      .replaceAll("_", " ")
      .toLowerCase()}.`,
  };
}
