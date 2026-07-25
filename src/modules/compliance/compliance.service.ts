import { prisma } from "@/lib/prisma";
import {
  createPreparedSubmissions,
  type PreparedSubmission,
} from "@/modules/forms/runtime-form.service";
import {
  ActivityAction,
  ComplianceObligationType,
  ComplianceRecurrence,
  ConfigurableFormModule,
  Status,
} from "@prisma/client";
import { nextComplianceDueDate } from "./compliance-recurrence";

export async function createComplianceObligationService(input: {
  organizationId: string;
  userId: string;
  siteId: string;
  ownerId?: string | null;
  regulatorySourceId?: string | null;
  title: string;
  description?: string | null;
  reference?: string | null;
  obligationType: ComplianceObligationType;
  authority?: string | null;
  jurisdiction?: string | null;
  legalReference?: string | null;
  applicability?: string | null;
  recurrence: ComplianceRecurrence;
  intervalValue: number;
  evidenceRequired?: string | null;
  dueDate: Date;
  customSubmissions?: PreparedSubmission[];
}) {
  const [site, owner, creator, regulatorySource] = await Promise.all([
    prisma.site.findFirst({
      where: {
        id: input.siteId,
        organizationId: input.organizationId,
      },
    }),
    input.ownerId
      ? prisma.user.findFirst({
          where: {
            id: input.ownerId,
            organizationId: input.organizationId,
          },
        })
      : null,
    prisma.user.findFirst({
      where: {
        id: input.userId,
        organizationId: input.organizationId,
      },
    }),
    input.regulatorySourceId ? prisma.regulatorySource.findFirst({ where: { id: input.regulatorySourceId, organizationId: input.organizationId, status: "ACTIVE" } }) : null,
  ]);

  if (!site) {
    throw new Error("Select a valid site.");
  }

  if (input.ownerId && !owner) {
    throw new Error("Select a valid owner.");
  }

  if (!creator) {
    throw new Error("The obligation creator is not a tenant user.");
  }

  if (input.regulatorySourceId && !regulatorySource) {
    throw new Error("Select a valid active regulatory source.");
  }

  if (
    !Number.isInteger(input.intervalValue) ||
    input.intervalValue < 1
  ) {
    throw new Error("Recurrence interval must be a positive whole number.");
  }

  if (Number.isNaN(input.dueDate.getTime())) {
    throw new Error("Due date must be a valid date.");
  }

  return prisma.$transaction(async (tx) => {
    const item = await tx.complianceItem.create({
      data: {
        siteId: site.id,
        ownerId: owner?.id ?? null,
        regulatorySourceId: regulatorySource?.id ?? null,
        title: input.title,
        description: input.description,
        reference: input.reference,
        obligationType: input.obligationType,
        authority: input.authority,
        jurisdiction: input.jurisdiction,
        legalReference: input.legalReference,
        applicability: input.applicability,
        recurrence: input.recurrence,
        intervalValue: input.intervalValue,
        evidenceRequired: input.evidenceRequired,
        dueDate: input.dueDate,
      },
    });

    await createPreparedSubmissions(tx, {
      organizationId: input.organizationId,
      userId: input.userId,
      module: ConfigurableFormModule.COMPLIANCE,
      entityId: item.id,
      submissions: input.customSubmissions ?? [],
    });

    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: ActivityAction.CREATE,
        entityType: "ComplianceItem",
        entityId: item.id,
        title: "Compliance obligation created",
        description: item.title,
        metadata: {
          siteId: item.siteId,
          ownerId: item.ownerId,
          obligationType: item.obligationType,
          recurrence: item.recurrence,
          dueDate: item.dueDate.toISOString(),
          customFormCount: input.customSubmissions?.length ?? 0,
        },
      },
    });

    return item;
  });
}

export async function completeComplianceFormsService(input: {
  organizationId: string;
  userId: string;
  complianceItemId: string;
  submissions: PreparedSubmission[];
}) {
  const item = await prisma.complianceItem.findFirst({
    where: {
      id: input.complianceItemId,
      site: {
        organizationId: input.organizationId,
      },
    },
  });

  if (!item) {
    throw new Error("Compliance obligation not found in this organization.");
  }

  const existing = await prisma.configurableFormSubmission.findMany({
    where: {
      organizationId: input.organizationId,
      entityType: ConfigurableFormModule.COMPLIANCE,
      entityId: item.id,
    },
    select: {
      definitionId: true,
    },
  });
  const completedDefinitionIds = new Set(
    existing.map((submission) => submission.definitionId)
  );
  const missing = input.submissions.filter(
    (submission) => !completedDefinitionIds.has(submission.definitionId)
  );

  if (missing.length === 0) {
    throw new Error(
      "All published compliance forms have already been captured."
    );
  }

  await prisma.$transaction(async (tx) => {
    await createPreparedSubmissions(tx, {
      organizationId: input.organizationId,
      userId: input.userId,
      module: ConfigurableFormModule.COMPLIANCE,
      entityId: item.id,
      submissions: missing,
    });

    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: ActivityAction.UPDATE,
        entityType: "ComplianceItem",
        entityId: item.id,
        title: "Compliance forms captured",
        description: `${missing.length} tenant form${
          missing.length === 1 ? "" : "s"
        } completed.`,
        metadata: {
          formCount: missing.length,
        },
      },
    });
  });
}

export async function evaluateComplianceObligationService(input: {
  organizationId: string;
  userId: string;
  complianceItemId: string;
  isCompliant: boolean;
  findings?: string | null;
  evidenceSummary?: string | null;
}) {
  const [item, evaluator] = await Promise.all([
    prisma.complianceItem.findFirst({
      where: {
        id: input.complianceItemId,
        site: { organizationId: input.organizationId },
      },
    }),
    prisma.user.findFirst({
      where: {
        id: input.userId,
        organizationId: input.organizationId,
        isActive: true,
      },
      select: { id: true },
    }),
  ]);

  if (!item) {
    throw new Error("Compliance obligation not found in this organization.");
  }

  if (!evaluator) {
    throw new Error("The compliance evaluator is not an active tenant user.");
  }

  const findings = input.findings?.trim() || null;
  const evidenceSummary = input.evidenceSummary?.trim() || null;
  const nextDueDate = input.isCompliant
    ? nextComplianceDueDate(
        item.dueDate,
        item.recurrence,
        item.intervalValue
      )
    : null;
  const evaluatedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const evaluation = await tx.complianceEvaluation.create({
      data: {
        complianceItemId: item.id,
        evaluatedById: evaluator.id,
        evaluatedAt,
        isCompliant: input.isCompliant,
        findings,
        evidenceSummary,
        nextDueDate,
      },
    });

    await tx.complianceItem.update({
      where: { id: item.id },
      data: {
        status: input.isCompliant
          ? nextDueDate
            ? Status.OPEN
            : Status.COMPLETED
          : Status.IN_PROGRESS,
        completedAt:
          input.isCompliant && !nextDueDate ? evaluatedAt : null,
        lastEvaluatedAt: evaluatedAt,
        evaluationNotes: findings,
        dueDate: nextDueDate ?? item.dueDate,
        reminderSentAt: nextDueDate ? null : item.reminderSentAt,
        overdueNotifiedAt: nextDueDate ? null : item.overdueNotifiedAt,
      },
    });

    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: ActivityAction.UPDATE,
        entityType: "ComplianceItem",
        entityId: item.id,
        title: "Compliance obligation evaluated",
        description: input.isCompliant
          ? "Recorded as compliant."
          : "Recorded as noncompliant.",
        metadata: {
          isCompliant: input.isCompliant,
          nextDueDate: nextDueDate?.toISOString() ?? null,
          evidenceSummaryRecorded: Boolean(evidenceSummary),
        },
      },
    });

    return evaluation;
  });
}
