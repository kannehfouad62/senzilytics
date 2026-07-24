import { prisma } from "@/lib/prisma";
import { completeMissingEntityForms } from "@/modules/forms/entity-form-completion.service";
import {
  createPreparedSubmissions,
  type PreparedSubmission,
} from "@/modules/forms/runtime-form.service";
import {
  ActivityAction,
  ConfigurableFormModule,
  EsgDataQuality,
  EsgDisclosureStatus,
  EsgInitiativeStatus,
  Prisma,
} from "@prisma/client";
import {
  isEsgDisclosureTransitionAllowed,
  isEsgInitiativeTransitionAllowed,
} from "@/modules/esg/esg-lifecycle";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";

type OfflineSubmissionInput = {
  id: string;
  capturedAt: Date;
  payloadHash: string;
};

async function recordEsgOfflineSubmission(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    userId: string;
    offlineSubmission?: OfflineSubmissionInput;
  },
  recordType: string,
  recordId: string
) {
  if (!input.offlineSubmission) return;
  await tx.offlineSubmission.create({
    data: {
      id: input.offlineSubmission.id,
      organizationId: input.organizationId,
      userId: input.userId,
      recordType,
      recordId,
      capturedAt: input.offlineSubmission.capturedAt,
      payloadHash: input.offlineSubmission.payloadHash,
    },
  });
}

export async function createEsgDisclosurePeriodService(input: {
  organizationId: string;
  userId: string;
  name: string;
  periodStart: Date;
  periodEnd: Date;
  boundaryDescription: string;
  customSubmissions?: PreparedSubmission[];
}) {
  const creator = await prisma.user.findFirst({
    where: { id: input.userId, organizationId: input.organizationId },
  });

  if (!creator) {
    throw new Error("The disclosure-period creator is not a tenant user.");
  }

  if (input.periodEnd < input.periodStart) {
    throw new Error("Period end must follow period start.");
  }

  return prisma.$transaction(async (tx) => {
    const period = await tx.esgDisclosurePeriod.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        boundaryDescription: input.boundaryDescription,
        status: EsgDisclosureStatus.DATA_COLLECTION,
      },
    });

    await createPreparedSubmissions(tx, {
      organizationId: input.organizationId,
      userId: input.userId,
      module: ConfigurableFormModule.ESG,
      entityId: period.id,
      submissions: input.customSubmissions ?? [],
    });

    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: ActivityAction.CREATE,
        entityType: "EsgDisclosurePeriod",
        entityId: period.id,
        title: "ESG disclosure period created",
        description: period.name,
        metadata: {
          periodStart: period.periodStart.toISOString(),
          periodEnd: period.periodEnd.toISOString(),
          customFormCount: input.customSubmissions?.length ?? 0,
        },
      },
    });

    return period;
  });
}

export async function completeEsgFormsService(input: {
  organizationId: string;
  userId: string;
  periodId: string;
  submissions: PreparedSubmission[];
  offlineSubmission?: OfflineSubmissionInput;
}) {
  const period = await prisma.esgDisclosurePeriod.findFirst({
    where: { id: input.periodId, organizationId: input.organizationId },
    select: { id: true },
  });

  if (!period) {
    throw new Error("ESG disclosure period not found in this organization.");
  }

  await completeMissingEntityForms({
    organizationId: input.organizationId,
    userId: input.userId,
    module: ConfigurableFormModule.ESG,
    entityId: period.id,
    activityEntityType: "EsgDisclosurePeriod",
    activityTitle: "ESG forms captured",
    formLabel: "ESG",
    submissions: input.submissions,
    offlineSubmission: input.offlineSubmission,
    offlineRecordType: input.offlineSubmission ? "ESG_FORMS" : undefined,
  });
}

export async function recordEsgDataService(input: {
  organizationId: string;
  userId: string;
  periodId: string;
  metricId: string;
  value: number;
  quality: EsgDataQuality;
  evidenceSummary?: string | null;
  sourceDescription?: string | null;
  offlineSubmission?: OfflineSubmissionInput;
}) {
  const [period, metric, user] = await Promise.all([
    prisma.esgDisclosurePeriod.findFirst({
      where: { id: input.periodId, organizationId: input.organizationId },
      select: { id: true, name: true, status: true },
    }),
    prisma.esgMetricDefinition.findFirst({
      where: {
        id: input.metricId,
        organizationId: input.organizationId,
        isActive: true,
      },
      select: { id: true, code: true, name: true },
    }),
    prisma.user.findFirst({
      where: { id: input.userId, organizationId: input.organizationId },
      select: { id: true },
    }),
  ]);
  if (!period || !metric || !user) {
    throw new Error("Select a valid tenant ESG period, metric, and user.");
  }
  if (
    period.status !== EsgDisclosureStatus.DATA_COLLECTION &&
    period.status !== EsgDisclosureStatus.UNDER_REVIEW
  ) {
    throw new Error(
      "ESG data can only be recorded while collection or review is active."
    );
  }
  if (!Number.isFinite(input.value)) {
    throw new Error("Enter a valid ESG metric value.");
  }

  return prisma.$transaction(async (tx) => {
    const point = await tx.esgDataPoint.upsert({
      where: {
        periodId_metricId: {
          periodId: period.id,
          metricId: metric.id,
        },
      },
      update: {
        value: input.value,
        quality: input.quality,
        evidenceSummary: input.evidenceSummary,
        sourceDescription: input.sourceDescription,
        enteredById: user.id,
        isAutoCalculated: false,
        sourceRecordCount: 0,
      },
      create: {
        periodId: period.id,
        metricId: metric.id,
        value: input.value,
        quality: input.quality,
        evidenceSummary: input.evidenceSummary,
        sourceDescription: input.sourceDescription,
        enteredById: user.id,
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: ActivityAction.UPDATE,
        entityType: "EsgDataPoint",
        entityId: point.id,
        title: "ESG metric data recorded",
        description: `${period.name} · ${metric.code} ${metric.name}`,
        metadata: {
          periodId: period.id,
          metricId: metric.id,
          value: point.value,
          quality: point.quality,
        },
      },
    });
    await recordEsgOfflineSubmission(tx, input, "ESG_DATA", point.id);
    return point;
  });
}

async function assertEsgPeriodComplete(
  organizationId: string,
  periodId: string
) {
  const [requiredMetricCount, recordedMetricCount, forms, capturedForms] =
    await Promise.all([
      prisma.esgMetricDefinition.count({
        where: { organizationId, isActive: true },
      }),
      prisma.esgDataPoint.count({
        where: {
          periodId,
          period: { organizationId },
          metric: { organizationId, isActive: true },
        },
      }),
      getPublishedRuntimeForms(organizationId, ConfigurableFormModule.ESG),
      prisma.configurableFormSubmission.findMany({
        where: {
          organizationId,
          entityType: ConfigurableFormModule.ESG,
          entityId: periodId,
        },
        select: { definitionId: true },
      }),
    ]);
  if (requiredMetricCount === 0) {
    throw new Error(
      "Configure at least one active ESG metric before submitting this disclosure."
    );
  }
  if (recordedMetricCount < requiredMetricCount) {
    throw new Error(
      `${Math.max(
        requiredMetricCount - recordedMetricCount,
        0
      )} required ESG metrics remain incomplete.`
    );
  }
  const capturedIds = new Set(
    capturedForms.map((submission) => submission.definitionId)
  );
  const missingFormCount = forms.filter(
    (form) => !capturedIds.has(form.id)
  ).length;
  if (missingFormCount) {
    throw new Error(
      `${missingFormCount} required ESG form${
        missingFormCount === 1 ? "" : "s"
      } remain incomplete.`
    );
  }
}

export async function transitionEsgDisclosureService(input: {
  organizationId: string;
  userId: string;
  periodId: string;
  status: EsgDisclosureStatus;
  offlineSubmission?: OfflineSubmissionInput;
}) {
  const period = await prisma.esgDisclosurePeriod.findFirst({
    where: { id: input.periodId, organizationId: input.organizationId },
  });
  if (!period) {
    throw new Error("ESG disclosure period not found in this organization.");
  }
  if (period.status === input.status) {
    if (input.offlineSubmission) {
      await prisma.$transaction((tx) =>
        recordEsgOfflineSubmission(
          tx,
          input,
          "ESG_DISCLOSURE_STATUS",
          period.id
        )
      );
    }
    return period;
  }
  if (!isEsgDisclosureTransitionAllowed(period.status, input.status)) {
    throw new Error(
      `A ${period.status.replaceAll("_", " ")} disclosure cannot move to ${input.status.replaceAll("_", " ")}.`
    );
  }
  if (
    input.status === EsgDisclosureStatus.UNDER_REVIEW ||
    input.status === EsgDisclosureStatus.APPROVED
  ) {
    await assertEsgPeriodComplete(input.organizationId, period.id);
  }
  const changedAt = new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.esgDisclosurePeriod.update({
      where: { id: period.id },
      data: {
        status: input.status,
        ...(input.status === EsgDisclosureStatus.APPROVED
          ? { approvedById: input.userId, approvedAt: changedAt }
          : {}),
        ...(input.status === EsgDisclosureStatus.PUBLISHED
          ? { publishedById: input.userId, publishedAt: changedAt }
          : {}),
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: ActivityAction.STATUS_CHANGE,
        entityType: "EsgDisclosurePeriod",
        entityId: period.id,
        title: "ESG disclosure lifecycle changed",
        description: `${period.status} → ${input.status}`,
        metadata: {
          previousStatus: period.status,
          newStatus: input.status,
        },
      },
    });
    await recordEsgOfflineSubmission(
      tx,
      input,
      "ESG_DISCLOSURE_STATUS",
      updated.id
    );
    return updated;
  });
}

export async function transitionEsgInitiativeService(input: {
  organizationId: string;
  userId: string;
  initiativeId: string;
  status: EsgInitiativeStatus;
  offlineSubmission?: OfflineSubmissionInput;
}) {
  const initiative = await prisma.esgInitiative.findFirst({
    where: { id: input.initiativeId, organizationId: input.organizationId },
  });
  if (!initiative) {
    throw new Error("ESG initiative not found in this organization.");
  }
  if (initiative.status === input.status) {
    if (input.offlineSubmission) {
      await prisma.$transaction((tx) =>
        recordEsgOfflineSubmission(
          tx,
          input,
          "ESG_INITIATIVE_STATUS",
          initiative.id
        )
      );
    }
    return initiative;
  }
  if (!isEsgInitiativeTransitionAllowed(initiative.status, input.status)) {
    throw new Error(
      `A ${initiative.status.replaceAll("_", " ")} initiative cannot move to ${input.status.replaceAll("_", " ")}.`
    );
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.esgInitiative.update({
      where: { id: initiative.id },
      data: { status: input.status },
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: ActivityAction.STATUS_CHANGE,
        entityType: "EsgInitiative",
        entityId: initiative.id,
        title: "ESG initiative status changed",
        description: `${initiative.name} · ${initiative.status} → ${input.status}`,
        metadata: {
          previousStatus: initiative.status,
          newStatus: input.status,
        },
      },
    });
    await recordEsgOfflineSubmission(
      tx,
      input,
      "ESG_INITIATIVE_STATUS",
      updated.id
    );
    return updated;
  });
}
