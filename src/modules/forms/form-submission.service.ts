import "server-only";

import { prisma } from "@/lib/prisma";
import {
  buildFormSubmissionCsv,
  formSubmissionDirectSourceHref,
  parseFormSubmissionFilters,
  type FormSubmissionCsvEntry,
  type FormSubmissionSearchParams,
} from "@/modules/forms/form-submission-report";
import {
  ConfigurableFormModule,
  ConfigurableSubmissionStatus,
  Prisma,
} from "@prisma/client";

const PAGE_SIZE = 30;
const MAX_EXPORT_SUBMISSIONS = 5_000;

export async function getFormSubmissionRegister(input: {
  organizationId: string;
  searchParams: FormSubmissionSearchParams;
}) {
  const filters = parseFormSubmissionFilters(input.searchParams);
  const filteredWhere = submissionWhere(
    input.organizationId,
    filters,
    true,
  );
  const statusWhere = submissionWhere(input.organizationId, filters, false);

  const [submissions, total, submittedCount, draftCount, voidedCount, definitions] =
    await prisma.$transaction([
      prisma.configurableFormSubmission.findMany({
        where: filteredWhere,
        select: {
          id: true,
          entityType: true,
          entityId: true,
          status: true,
          submittedAt: true,
          definition: {
            select: { id: true, name: true, isActive: true },
          },
          version: { select: { version: true } },
          submittedBy: { select: { name: true, email: true } },
          _count: { select: { answers: true, fileAnswers: true } },
        },
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
        skip: (filters.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.configurableFormSubmission.count({ where: filteredWhere }),
      prisma.configurableFormSubmission.count({
        where: {
          ...statusWhere,
          status: ConfigurableSubmissionStatus.SUBMITTED,
        },
      }),
      prisma.configurableFormSubmission.count({
        where: {
          ...statusWhere,
          status: ConfigurableSubmissionStatus.DRAFT,
        },
      }),
      prisma.configurableFormSubmission.count({
        where: {
          ...statusWhere,
          status: ConfigurableSubmissionStatus.VOIDED,
        },
      }),
      prisma.configurableFormDefinition.findMany({
        where: { organizationId: input.organizationId },
        select: { id: true, name: true, module: true },
        orderBy: [{ module: "asc" }, { name: "asc" }],
      }),
    ]);

  const statusCounts: Record<ConfigurableSubmissionStatus, number> = {
    [ConfigurableSubmissionStatus.SUBMITTED]: submittedCount,
    [ConfigurableSubmissionStatus.DRAFT]: draftCount,
    [ConfigurableSubmissionStatus.VOIDED]: voidedCount,
  };

  return {
    submissions,
    definitions,
    filters,
    total,
    statusCounts,
    pageSize: PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getFormSubmissionDetail(input: {
  organizationId: string;
  submissionId: string;
}) {
  const submission = await prisma.configurableFormSubmission.findFirst({
    where: {
      id: input.submissionId,
      organizationId: input.organizationId,
    },
    include: {
      definition: {
        select: {
          id: true,
          name: true,
          description: true,
          module: true,
          isActive: true,
        },
      },
      version: {
        select: {
          version: true,
          status: true,
          publishedAt: true,
          instructions: true,
          fields: { orderBy: { sequence: "asc" } },
        },
      },
      submittedBy: { select: { name: true, email: true } },
      answers: {
        include: { field: true },
        orderBy: { field: { sequence: "asc" } },
      },
      fileAnswers: {
        include: { field: true, document: true },
        orderBy: { field: { sequence: "asc" } },
      },
    },
  });
  if (!submission) return null;

  return {
    ...submission,
    sourceHref: await resolveSubmissionSourceHref({
      organizationId: input.organizationId,
      module: submission.entityType,
      entityId: submission.entityId,
    }),
  };
}

export async function exportFormSubmissionsCsv(input: {
  organizationId: string;
  searchParams: FormSubmissionSearchParams;
}) {
  const filters = parseFormSubmissionFilters(input.searchParams);
  const where = submissionWhere(input.organizationId, filters, true);
  const submissions = await prisma.configurableFormSubmission.findMany({
    where,
    include: {
      definition: { select: { name: true } },
      version: { select: { version: true } },
      submittedBy: { select: { name: true, email: true } },
      answers: {
        include: { field: true },
        orderBy: { field: { sequence: "asc" } },
      },
      fileAnswers: {
        include: { field: true, document: true },
        orderBy: { field: { sequence: "asc" } },
      },
    },
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    take: MAX_EXPORT_SUBMISSIONS + 1,
  });
  if (submissions.length > MAX_EXPORT_SUBMISSIONS) {
    throw new Error(
      "This export exceeds 5,000 submissions. Narrow the date, form, module, or status filters and try again.",
    );
  }

  const rows = submissions.flatMap<FormSubmissionCsvEntry>((submission) => {
    const common = {
      submissionId: submission.id,
      formName: submission.definition.name,
      module: submission.entityType,
      version: submission.version.version,
      status: submission.status,
      sourceEntityId: submission.entityId,
      submittedBy: submission.submittedBy.name,
      submittedByEmail: submission.submittedBy.email,
      submittedAt: submission.submittedAt,
    };
    const answers: FormSubmissionCsvEntry[] = submission.answers.map(
      (answer) => ({
        ...common,
        responseType: "ANSWER",
        fieldKey: answer.field.key,
        fieldLabel: answer.field.label,
        fieldType: answer.field.fieldType,
        value: answer.value,
      }),
    );
    const files: FormSubmissionCsvEntry[] = submission.fileAnswers.map(
      (answer) => ({
        ...common,
        responseType: "FILE",
        fieldKey: answer.field.key,
        fieldLabel: answer.field.label,
        fieldType: answer.field.fieldType,
        value: answer.document.originalName,
      }),
    );
    return answers.length || files.length
      ? [...answers, ...files]
      : [
          {
            ...common,
            responseType: "RECORD",
            fieldKey: "",
            fieldLabel: "",
            fieldType: "",
            value: "",
          },
        ];
  });

  return buildFormSubmissionCsv(rows);
}

function submissionWhere(
  organizationId: string,
  filters: ReturnType<typeof parseFormSubmissionFilters>,
  includeStatus: boolean,
): Prisma.ConfigurableFormSubmissionWhereInput {
  const submittedAt: Prisma.DateTimeFilter = {};
  if (filters.from) submittedAt.gte = filters.from;
  if (filters.toExclusive) submittedAt.lt = filters.toExclusive;

  return {
    organizationId,
    ...(filters.module ? { entityType: filters.module } : {}),
    ...(includeStatus && filters.status ? { status: filters.status } : {}),
    ...(filters.definitionId
      ? {
          definitionId: filters.definitionId,
          definition: { organizationId },
        }
      : {}),
    ...(filters.from || filters.toExclusive ? { submittedAt } : {}),
    ...(filters.q
      ? {
          OR: [
            {
              definition: {
                name: { contains: filters.q, mode: "insensitive" },
              },
            },
            {
              submittedBy: {
                name: { contains: filters.q, mode: "insensitive" },
              },
            },
            {
              submittedBy: {
                email: { contains: filters.q, mode: "insensitive" },
              },
            },
            { entityId: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

async function resolveSubmissionSourceHref(input: {
  organizationId: string;
  module: ConfigurableFormModule;
  entityId: string;
}) {
  const direct = formSubmissionDirectSourceHref(
    input.module,
    input.entityId,
  );
  if (direct) return direct;

  if (input.module === ConfigurableFormModule.ASSET_SAFETY) {
    const inspection = await prisma.assetInspection.findFirst({
      where: {
        id: input.entityId,
        organizationId: input.organizationId,
      },
      select: { assetId: true },
    });
    return inspection ? `/assets/${encodeURIComponent(inspection.assetId)}` : null;
  }

  if (input.module === ConfigurableFormModule.SIF_ASSURANCE) {
    const verification = await prisma.criticalControlVerification.findFirst({
      where: {
        id: input.entityId,
        organizationId: input.organizationId,
      },
      select: { controlId: true },
    });
    return verification
      ? `/assurance/sif/controls/${encodeURIComponent(verification.controlId)}`
      : null;
  }

  return null;
}
