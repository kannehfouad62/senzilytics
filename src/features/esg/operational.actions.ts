"use server";

import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { transitionEsgDisclosureService } from "@/modules/esg/esg-disclosure.service";
import {
  EnvironmentalDataStatus,
  EsgDataQuality,
  EsgDisclosureStatus,
  EsgInitiativeStatus,
  EsgPillar,
  PermissionKey,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const req = (data: FormData, key: string) => {
  const value = String(data.get(key) || "").trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
};
const opt = (data: FormData, key: string) =>
  String(data.get(key) || "").trim() || null;
const optionalDate = (data: FormData, key: string) => {
  const value = opt(data, key);
  return value ? new Date(value) : null;
};

export async function rollupEnvironmentalEsgData(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_ESG);
  const { organizationId, user } = await getCurrentUserTenant();
  const periodId = req(data, "periodId");
  const period = await prisma.esgDisclosurePeriod.findFirst({
    where: {
      id: periodId,
      organizationId,
      status: {
        in: [
          EsgDisclosureStatus.DATA_COLLECTION,
          EsgDisclosureStatus.UNDER_REVIEW,
        ],
      },
    },
  });
  if (!period) {
    throw new Error(
      "Environmental data can only be rolled up during collection or review."
    );
  }
  const metrics = await prisma.esgMetricDefinition.findMany({
    where: {
      organizationId,
      isActive: true,
      environmentalMetricId: { not: null },
    },
  });
  for (const metric of metrics) {
    const records = await prisma.environmentalDataPoint.findMany({
      where: {
        metricId: metric.environmentalMetricId!,
        status: EnvironmentalDataStatus.APPROVED,
        periodEnd: { gte: period.periodStart, lte: period.periodEnd },
      },
    });
    const value = records.reduce(
      (sum, record) => sum + record.normalizedValue,
      0
    );
    await prisma.esgDataPoint.upsert({
      where: { periodId_metricId: { periodId, metricId: metric.id } },
      update: {
        value,
        quality: EsgDataQuality.CALCULATED,
        sourceDescription: "Approved environmental metric rollup",
        enteredById: user.id,
        isAutoCalculated: true,
        sourceRecordCount: records.length,
      },
      create: {
        periodId,
        metricId: metric.id,
        value,
        quality: EsgDataQuality.CALCULATED,
        sourceDescription: "Approved environmental metric rollup",
        enteredById: user.id,
        isAutoCalculated: true,
        sourceRecordCount: records.length,
      },
    });
  }
  revalidatePath("/esg");
  revalidatePath(`/esg/${periodId}`);
}

async function transitionPeriod(data: FormData, status: EsgDisclosureStatus) {
  await requirePermission(PermissionKey.MANAGE_ESG);
  const { organizationId, user } = await getCurrentUserTenant();
  const id = req(data, "id");
  await transitionEsgDisclosureService({
    organizationId,
    userId: user.id,
    periodId: id,
    status,
  });
  revalidatePath("/esg");
  revalidatePath(`/esg/${id}`);
  revalidatePath("/esg/operations");
}

export async function submitEsgPeriodForReview(data: FormData) {
  return transitionPeriod(data, EsgDisclosureStatus.UNDER_REVIEW);
}

export async function approveCompleteEsgPeriod(data: FormData) {
  return transitionPeriod(data, EsgDisclosureStatus.APPROVED);
}

export async function publishEsgPeriod(data: FormData) {
  return transitionPeriod(data, EsgDisclosureStatus.PUBLISHED);
}

export async function createEsgTarget(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_ESG);
  const { organizationId } = await getCurrentUserTenant();
  const metricId = req(data, "metricId");
  if (
    !(await prisma.esgMetricDefinition.findFirst({
      where: { id: metricId, organizationId },
    }))
  ) {
    throw new Error("Select a valid ESG metric.");
  }
  await prisma.esgTarget.create({
    data: {
      metricId,
      baselineYear: Number(req(data, "baselineYear")),
      baselineValue: Number(req(data, "baselineValue")),
      targetYear: Number(req(data, "targetYear")),
      targetValue: Number(req(data, "targetValue")),
      description: opt(data, "description"),
    },
  });
  redirect("/esg/governance");
}

export async function createEsgInitiative(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_ESG);
  const { organizationId } = await getCurrentUserTenant();
  const pillar = req(data, "pillar") as EsgPillar;
  const ownerId = opt(data, "ownerId");
  if (!Object.values(EsgPillar).includes(pillar)) {
    throw new Error("Select a valid pillar.");
  }
  if (
    ownerId &&
    !(await prisma.user.findFirst({ where: { id: ownerId, organizationId } }))
  ) {
    throw new Error("Select a valid owner.");
  }
  await prisma.esgInitiative.create({
    data: {
      organizationId,
      name: req(data, "name"),
      description: opt(data, "description"),
      pillar,
      status: EsgInitiativeStatus.PLANNED,
      ownerId,
      startDate: optionalDate(data, "startDate"),
      targetDate: optionalDate(data, "targetDate"),
      budget: opt(data, "budget") ? Number(opt(data, "budget")) : null,
      expectedOutcome: opt(data, "expectedOutcome"),
    },
  });
  redirect("/esg/governance");
}
