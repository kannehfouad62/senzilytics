import { prisma } from "@/lib/prisma";
import { detectQualityIssues } from "@/modules/research/research-analysis";
import type {
  ResearchDataRow,
  ResearchValue,
  ResearchVariable,
} from "@/modules/research/research-analysis";

export async function getResearchDataset(
  organizationId: string,
  collectionId: string,
) {
  const collection = await prisma.researchCollectionWave.findFirst({
    where: { id: collectionId, organizationId },
    include: {
      project: { include: { client: true } },
      questionnaire: true,
      formVersion: { include: { fields: { orderBy: { sequence: "asc" } } } },
      datasetOwner: { select: { id: true, name: true } },
      datasetLockedBy: { select: { name: true } },
      datasetApprovedBy: { select: { name: true } },
      analyses: {
        include: {
          analyst: { select: { name: true } },
          reviewer: { select: { name: true } },
          approvedBy: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
      assignments: {
        where: { status: "COMPLETED", submissionId: { not: null } },
        include: {
          respondent: { select: { name: true, email: true } },
          reviewedBy: { select: { name: true } },
          submission: { include: { answers: true } },
        },
        orderBy: { completedAt: "asc" },
        take: 5000,
      },
      publicResponses: {
        where: { submissionId: { not: null } },
        include: {
          reviewedBy: { select: { name: true } },
          submission: { include: { answers: true } },
        },
        orderBy: { submittedAt: "asc" },
        take: 5000,
      },
      fieldworkResponses: {
        include: {
          enumerator: { select: { name: true, email: true } },
          backcheckedBy: { select: { name: true } },
          submission: { include: { answers: true } },
        },
        orderBy: { capturedAt: "asc" },
        take: 5000,
      },
    },
  });
  if (!collection) return null;
  const variables: ResearchVariable[] = collection.formVersion.fields
    .filter((field) => field.fieldType !== "FILE")
    .map((field) => ({
      id: field.id,
      key: field.key,
      label: field.label,
      type: field.fieldType,
      required: field.isRequired,
    }));
  const createRow = (
    id: string,
    submissionId: string,
    submittedAt: Date,
    answers: Array<{ fieldId: string; value: unknown }>,
  ): ResearchDataRow => {
    const byId = new Map(
      answers.map((answer) => [answer.fieldId, answer.value]),
    );
    return {
      assignmentId: id,
      responseId: submissionId,
      submittedAt: submittedAt.toISOString(),
      values: Object.fromEntries(
        variables.map((variable) => [
          variable.key,
          (byId.get(variable.id) ?? null) as ResearchValue,
        ]),
      ),
    };
  };
  const assigned = collection.assignments.map((response) => ({
    response,
    source: "ASSIGNED" as const,
    row: createRow(
      response.id,
      response.submissionId!,
      response.completedAt!,
      response.submission?.answers ?? [],
    ),
  }));
  const external = collection.publicResponses.map((response) => ({
    response,
    source: "PUBLIC" as const,
    row: createRow(
      response.id,
      response.submissionId!,
      response.submittedAt,
      response.submission?.answers ?? [],
    ),
  }));
  const fieldwork = collection.fieldworkResponses.map((response) => ({
    response: {
      ...response,
      qualityNotes: response.backcheckNotes,
      reviewedBy: response.backcheckedBy,
      reviewedAt: response.backcheckedAt,
    },
    source: "FIELDWORK" as const,
    row: createRow(
      response.sampleUnitId,
      response.submissionId,
      response.capturedAt,
      response.submission.answers,
    ),
  }));
  const responseRows = [...assigned, ...external, ...fieldwork].sort((a, b) =>
    a.row.submittedAt.localeCompare(b.row.submittedAt),
  );
  const rows = responseRows.map((item) => item.row);
  const analysisRows = responseRows
    .filter((item) => item.response.disposition === "INCLUDED")
    .map((item) => item.row);
  return {
    collection,
    variables,
    rows,
    analysisRows,
    responseRows,
    qualityIssues: detectQualityIssues(variables, rows),
  };
}

export function listResearchDatasets(organizationId: string) {
  return prisma.researchCollectionWave.findMany({
    where: { organizationId },
    include: {
      project: { include: { client: true } },
      questionnaire: true,
      _count: {
        select: {
          assignments: { where: { status: "COMPLETED" } },
          publicResponses: true,
          fieldworkResponses: true,
        },
      },
      assignments: {
        where: { status: "COMPLETED", disposition: "FLAGGED" },
        select: { id: true },
      },
      publicResponses: {
        where: { disposition: "FLAGGED" },
        select: { id: true },
      },
      fieldworkResponses: {
        where: { disposition: "FLAGGED" },
        select: { id: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}
