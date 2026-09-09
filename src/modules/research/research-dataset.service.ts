import { prisma } from "@/lib/prisma";
import { detectQualityIssues } from "@/modules/research/research-analysis";
import type {
  ResearchDataRow,
  ResearchValue,
  ResearchVariable,
} from "@/modules/research/research-analysis";
import { repeatingGroupConfig } from "@/modules/forms/repeating-group.service";

type ResearchVariableSource = {
  fieldId: string;
  matrixRow: string | null;
  rankingOption: string | null;
  rosterRow?: number;
  rosterColumn?: string;
  variable: ResearchVariable;
};

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
  const variableSources = collection.formVersion.fields
    .filter((field) => field.fieldType !== "FILE")
    .flatMap<ResearchVariableSource>((field) => {
      if (field.fieldType === "MATRIX") return matrixOptions(field.options).rows.map((row) => ({ fieldId: field.id, matrixRow: row, rankingOption: null, variable: { id: `${field.id}:${row}`, key: `${field.key}__${variableKey(row)}`, label: `${field.label} — ${row}`, type: "SINGLE_SELECT", required: field.isRequired } satisfies ResearchVariable }));
      if (field.fieldType === "RANKING") return optionList(field.options).map((option) => ({ fieldId: field.id, matrixRow: null, rankingOption: option, variable: { id: `${field.id}:${option}`, key: `${field.key}__rank__${variableKey(option)}`, label: `${field.label} — rank: ${option}`, type: "NUMBER", required: field.isRequired } satisfies ResearchVariable }));
      if (field.fieldType === "REPEATING_GROUP") { const roster=repeatingGroupConfig(field.options); return roster ? Array.from({length:roster.maxRows},(_,rowIndex)=>roster.columns.map((column)=>({fieldId:field.id,matrixRow:null,rankingOption:null,rosterRow:rowIndex,rosterColumn:column.key,variable:{id:`${field.id}:${rowIndex+1}:${column.key}`,key:`${field.key}__row_${rowIndex+1}__${variableKey(column.key)}`,label:`${field.label} — row ${rowIndex+1}: ${column.label}`,type:column.type,required:field.isRequired&&rowIndex<roster.minRows&&column.required}satisfies ResearchVariable}))).flat() : []; }
      return [{ fieldId: field.id, matrixRow: null, rankingOption: null, variable: { id: field.id, key: field.key, label: field.label, type: field.fieldType, required: field.isRequired } satisfies ResearchVariable }];
    });
  const variables = variableSources.map((source) => source.variable);
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
      values: Object.fromEntries(variableSources.map((source) => {
        const raw = byId.get(source.fieldId);
        if (source.matrixRow) return [source.variable.key, matrixAnswer(raw, source.matrixRow)];
        if (source.rankingOption) return [source.variable.key, rankingPosition(raw, source.rankingOption)];
        if (source.rosterRow !== undefined && source.rosterColumn) return [source.variable.key, rosterValue(raw, source.rosterRow, source.rosterColumn)];
        return [source.variable.key, (raw ?? null) as ResearchValue];
      })),
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

function rosterValue(value: unknown, rowIndex: number, columnKey: string): ResearchValue {
  if (!Array.isArray(value)) return null;
  const row=value[rowIndex];
  if(!row||Array.isArray(row)||typeof row!=="object")return null;
  const values=(row as {values?:unknown}).values;
  if(!values||Array.isArray(values)||typeof values!=="object")return null;
  const result=(values as Record<string,unknown>)[columnKey];
  return typeof result==="string"||typeof result==="number"||typeof result==="boolean"?result:null;
}

const optionList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
function matrixOptions(value: unknown) { if (!value || Array.isArray(value) || typeof value !== "object") return { rows: [] as string[] }; const rows = (value as { rows?: unknown }).rows; return { rows: Array.isArray(rows) ? rows.filter((item): item is string => typeof item === "string") : [] }; }
const variableKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60) || "item";
export function matrixAnswer(value: unknown, row: string): ResearchValue { if (!Array.isArray(value)) return null; for (const encoded of value) { if (typeof encoded !== "string") continue; try { const pair = JSON.parse(encoded) as unknown; if (Array.isArray(pair) && pair[0] === row && typeof pair[1] === "string") return pair[1]; } catch { continue; } } return null; }
export function rankingPosition(value: unknown, option: string): ResearchValue { if (!Array.isArray(value)) return null; const index = value.indexOf(option); return index >= 0 ? index + 1 : null; }

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
