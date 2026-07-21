import { prisma } from "@/lib/prisma";
import { completeMissingEntityForms } from "@/modules/forms/entity-form-completion.service";
import {
  createPreparedSubmissions,
  type PreparedSubmission,
} from "@/modules/forms/runtime-form.service";
import {
  ActivityAction,
  ConfigurableFormModule,
  EnvironmentalDataQuality,
  EnvironmentalDataStatus,
} from "@prisma/client";

export async function recordEnvironmentalDataService(input: {
  organizationId: string;
  userId: string;
  metricId: string;
  siteId: string;
  value: number;
  quality: EnvironmentalDataQuality;
  periodStart: Date;
  periodEnd: Date;
  evidenceSummary?: string | null;
  notes?: string | null;
  customSubmissions?: PreparedSubmission[];
}) {
  const [metric, site, creator] = await Promise.all([
    prisma.environmentalMetricDefinition.findFirst({
      where: {
        id: input.metricId,
        organizationId: input.organizationId,
        isActive: true,
      },
    }),
    prisma.site.findFirst({
      where: { id: input.siteId, organizationId: input.organizationId },
    }),
    prisma.user.findFirst({
      where: { id: input.userId, organizationId: input.organizationId },
    }),
  ]);

  if (!metric || !site || !creator) {
    throw new Error("Select a valid metric and site.");
  }

  if (!Number.isFinite(input.value) || input.periodEnd < input.periodStart) {
    throw new Error("Enter a valid value and reporting period.");
  }

  const existing = await prisma.environmentalDataPoint.findUnique({
    where: {
      metricId_siteId_periodStart_periodEnd: {
        metricId: metric.id,
        siteId: site.id,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      },
    },
    select: { id: true },
  });
  const captured = existing
    ? await prisma.configurableFormSubmission.findMany({
        where: {
          organizationId: input.organizationId,
          entityType: ConfigurableFormModule.ENVIRONMENTAL,
          entityId: existing.id,
        },
        select: { definitionId: true },
      })
    : [];
  const capturedIds = new Set(
    captured.map((submission) => submission.definitionId)
  );
  const missingSubmissions = (input.customSubmissions ?? []).filter(
    (submission) => !capturedIds.has(submission.definitionId)
  );

  return prisma.$transaction(async (tx) => {
    const point = await tx.environmentalDataPoint.upsert({
      where: {
        metricId_siteId_periodStart_periodEnd: {
          metricId: metric.id,
          siteId: site.id,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        },
      },
      update: {
        value: input.value,
        normalizedValue: input.value * metric.conversionFactor,
        quality: input.quality,
        evidenceSummary: input.evidenceSummary,
        notes: input.notes,
        enteredById: creator.id,
        status: EnvironmentalDataStatus.DRAFT,
        approvedById: null,
        approvedAt: null,
      },
      create: {
        metricId: metric.id,
        siteId: site.id,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        value: input.value,
        normalizedValue: input.value * metric.conversionFactor,
        quality: input.quality,
        evidenceSummary: input.evidenceSummary,
        notes: input.notes,
        enteredById: creator.id,
      },
    });

    await createPreparedSubmissions(tx, {
      organizationId: input.organizationId,
      userId: input.userId,
      module: ConfigurableFormModule.ENVIRONMENTAL,
      entityId: point.id,
      submissions: missingSubmissions,
    });

    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: existing ? ActivityAction.UPDATE : ActivityAction.CREATE,
        entityType: "EnvironmentalDataPoint",
        entityId: point.id,
        title: existing
          ? "Environmental data updated"
          : "Environmental data recorded",
        description: `${metric.name} · ${site.name}`,
        metadata: {
          metricId: metric.id,
          siteId: site.id,
          value: point.value,
          normalizedValue: point.normalizedValue,
          customFormCount: missingSubmissions.length,
        },
      },
    });

    return point;
  });
}

export async function completeEnvironmentalFormsService(input: {
  organizationId: string;
  userId: string;
  dataPointId: string;
  submissions: PreparedSubmission[];
}) {
  const point = await prisma.environmentalDataPoint.findFirst({
    where: {
      id: input.dataPointId,
      metric: { organizationId: input.organizationId },
    },
    select: { id: true },
  });

  if (!point) {
    throw new Error("Environmental data point not found in this organization.");
  }

  await completeMissingEntityForms({
    organizationId: input.organizationId,
    userId: input.userId,
    module: ConfigurableFormModule.ENVIRONMENTAL,
    entityId: point.id,
    activityEntityType: "EnvironmentalDataPoint",
    activityTitle: "Environmental forms captured",
    formLabel: "environmental",
    submissions: input.submissions,
  });
}
