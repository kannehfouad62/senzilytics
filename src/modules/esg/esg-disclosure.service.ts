import { prisma } from "@/lib/prisma";
import { completeMissingEntityForms } from "@/modules/forms/entity-form-completion.service";
import {
  createPreparedSubmissions,
  type PreparedSubmission,
} from "@/modules/forms/runtime-form.service";
import {
  ActivityAction,
  ConfigurableFormModule,
  EsgDisclosureStatus,
} from "@prisma/client";

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
  });
}
