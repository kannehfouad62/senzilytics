import {
  ConfigurableFormModule,
  ConfigurableSubmissionStatus,
} from "@prisma/client";

export type FormSubmissionSearchParams = {
  q?: string | string[];
  module?: string | string[];
  status?: string | string[];
  definitionId?: string | string[];
  from?: string | string[];
  to?: string | string[];
  page?: string | string[];
};

export type FormSubmissionFilters = {
  q: string;
  module: ConfigurableFormModule | null;
  status: ConfigurableSubmissionStatus | null;
  definitionId: string | null;
  from: Date | null;
  toExclusive: Date | null;
  fromInput: string;
  toInput: string;
  page: number;
};

export type FormSubmissionCsvEntry = {
  submissionId: string;
  formName: string;
  module: ConfigurableFormModule;
  version: number;
  status: ConfigurableSubmissionStatus;
  sourceEntityId: string;
  submittedBy: string;
  submittedByEmail: string;
  submittedAt: Date;
  responseType: "ANSWER" | "FILE" | "RECORD";
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  value: unknown;
};

const MAX_QUERY_LENGTH = 100;
const MAX_DEFINITION_ID_LENGTH = 80;

export function parseFormSubmissionFilters(
  params: FormSubmissionSearchParams,
): FormSubmissionFilters {
  const q = first(params.q).trim().slice(0, MAX_QUERY_LENGTH);
  const moduleValue = first(params.module);
  const statusValue = first(params.status);
  const definitionId = first(params.definitionId)
    .trim()
    .slice(0, MAX_DEFINITION_ID_LENGTH);
  const fromInput = validDateInput(first(params.from));
  const toInput = validDateInput(first(params.to));
  const parsedPage = Number.parseInt(first(params.page), 10);

  return {
    q,
    module: enumValue(ConfigurableFormModule, moduleValue),
    status: enumValue(ConfigurableSubmissionStatus, statusValue),
    definitionId: definitionId || null,
    from: fromInput ? dateAtUtcStart(fromInput) : null,
    toExclusive: toInput ? dayAfterUtc(toInput) : null,
    fromInput,
    toInput,
    page:
      Number.isSafeInteger(parsedPage) && parsedPage > 0
        ? Math.min(parsedPage, 10_000)
        : 1,
  };
}

export function displayFormSubmissionValue(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
}

export function formSubmissionDirectSourceHref(
  module: ConfigurableFormModule,
  entityId: string,
) {
  const encodedId = encodeURIComponent(entityId);
  switch (module) {
    case ConfigurableFormModule.OBSERVATION:
      return `/observations/${encodedId}`;
    case ConfigurableFormModule.INCIDENT:
      return `/incidents/${encodedId}`;
    case ConfigurableFormModule.AUDIT:
      return `/audits/${encodedId}`;
    case ConfigurableFormModule.INSPECTION:
      return `/inspections/${encodedId}`;
    case ConfigurableFormModule.CAPA:
      return `/actions/${encodedId}`;
    case ConfigurableFormModule.RISK:
      return `/risks/${encodedId}`;
    case ConfigurableFormModule.MOC:
      return `/moc/${encodedId}`;
    case ConfigurableFormModule.COMPLIANCE:
      return `/compliance/${encodedId}`;
    case ConfigurableFormModule.TRAINING:
      return `/training/${encodedId}`;
    case ConfigurableFormModule.CHEMICAL:
      return `/chemicals/${encodedId}`;
    case ConfigurableFormModule.ENVIRONMENTAL:
      return `/environmental/${encodedId}`;
    case ConfigurableFormModule.ESG:
      return `/esg/${encodedId}`;
    case ConfigurableFormModule.CONTRACTOR:
      return `/contractors/${encodedId}`;
    case ConfigurableFormModule.PERMIT_TO_WORK:
      return `/permits-to-work/${encodedId}`;
    case ConfigurableFormModule.INDUSTRIAL_HYGIENE:
      return `/industrial-hygiene/${encodedId}`;
    case ConfigurableFormModule.CERTIFICATION_READINESS:
      return `/assurance/certification/reviews/${encodedId}`;
    case ConfigurableFormModule.BEHAVIOR_SAFETY:
      return `/behavior-safety/sessions/${encodedId}`;
    case ConfigurableFormModule.REGULATORY_INTELLIGENCE:
      return `/compliance/regulatory/changes/${encodedId}`;
    case ConfigurableFormModule.EMERGENCY_PREPAREDNESS:
      return `/emergency/plans/${encodedId}`;
    case ConfigurableFormModule.BUSINESS_CONTINUITY:
      return `/business-continuity/plans/${encodedId}`;
    case ConfigurableFormModule.SIF_ASSURANCE:
    case ConfigurableFormModule.ASSET_SAFETY:
    case ConfigurableFormModule.GENERAL:
      return null;
  }
}

export function buildFormSubmissionCsv(entries: FormSubmissionCsvEntry[]) {
  const header = [
    "submissionId",
    "formName",
    "module",
    "version",
    "status",
    "sourceEntityId",
    "submittedBy",
    "submittedByEmail",
    "submittedAt",
    "responseType",
    "fieldKey",
    "fieldLabel",
    "fieldType",
    "value",
  ];
  const rows = entries.map((entry) =>
    [
      entry.submissionId,
      entry.formName,
      entry.module,
      entry.version,
      entry.status,
      entry.sourceEntityId,
      entry.submittedBy,
      entry.submittedByEmail,
      entry.submittedAt.toISOString(),
      entry.responseType,
      entry.fieldKey,
      entry.fieldLabel,
      entry.fieldType,
      displayFormSubmissionValue(entry.value),
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.map(csvCell).join(","), ...rows].join("\n");
}

export function prettyFormSubmissionLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function enumValue<T extends Record<string, string>>(
  values: T,
  value: string,
): T[keyof T] | null {
  return Object.values(values).includes(value) ? (value as T[keyof T]) : null;
}

function validDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = dateAtUtcStart(value);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? ""
    : value;
}

function dateAtUtcStart(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dayAfterUtc(value: string) {
  const date = dateAtUtcStart(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
