import {
  ConfigurableFormModule,
  Prisma,
  WorkflowEntityType,
} from "@prisma/client";

export const workflowConditionOperators = [
  "EQUALS",
  "NOT_EQUALS",
  "IN",
  "NOT_IN",
  "CONTAINS",
  "EXISTS",
  "NOT_EXISTS",
  "GREATER_THAN_OR_EQUAL",
  "LESS_THAN_OR_EQUAL",
] as const;

export type WorkflowConditionOperator =
  (typeof workflowConditionOperators)[number];

export type WorkflowTriggerCondition = {
  field: string;
  operator: WorkflowConditionOperator;
  value: string | null;
};

export type WorkflowAutomationContext = Record<
  string,
  string | number | boolean | null
>;

const MAX_CONDITIONS = 5;
const MAX_CONTEXT_FIELDS = 30;
const MAX_CONTEXT_VALUE_LENGTH = 500;
const FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9_.]{0,79}$/;

export function parseWorkflowTriggerConditions(input: {
  fields: string[];
  operators: string[];
  values: string[];
}) {
  const conditions: WorkflowTriggerCondition[] = [];
  const rowCount = Math.max(
    input.fields.length,
    input.operators.length,
    input.values.length,
  );

  for (let index = 0; index < rowCount; index++) {
    const field = (input.fields[index] ?? "").trim();
    const operator = (input.operators[index] ?? "").trim();
    const value = (input.values[index] ?? "").trim();
    if (!field && !operator && !value) continue;
    if (conditions.length >= MAX_CONDITIONS) {
      throw new Error("A workflow can have at most five trigger conditions.");
    }
    if (!FIELD_PATTERN.test(field)) {
      throw new Error(
        "Trigger fields must begin with a letter and contain only letters, numbers, periods, or underscores.",
      );
    }
    if (!workflowConditionOperators.includes(operator as WorkflowConditionOperator)) {
      throw new Error("Select a valid trigger-condition operator.");
    }
    if (
      operator !== "EXISTS" &&
      operator !== "NOT_EXISTS" &&
      !value
    ) {
      throw new Error("Enter a comparison value for each trigger condition.");
    }
    if (value.length > 200) {
      throw new Error("Trigger-condition values must be 200 characters or fewer.");
    }
    conditions.push({
      field,
      operator: operator as WorkflowConditionOperator,
      value:
        operator === "EXISTS" || operator === "NOT_EXISTS" ? null : value,
    });
  }

  return conditions;
}

export function workflowConditionsMatch(
  stored: Prisma.JsonValue | null,
  context: WorkflowAutomationContext,
) {
  const parsed = storedConditions(stored);
  if (!parsed.valid) return false;
  return parsed.conditions.every((condition) =>
    conditionMatches(condition, context[condition.field]),
  );
}

export function readWorkflowTriggerConditions(stored: Prisma.JsonValue | null) {
  const parsed = storedConditions(stored);
  return parsed.valid ? parsed.conditions : [];
}

export function sanitizeWorkflowAutomationContext(
  input: Record<string, unknown>,
): WorkflowAutomationContext {
  const context: WorkflowAutomationContext = {};
  for (const [field, value] of Object.entries(input)) {
    if (Object.keys(context).length >= MAX_CONTEXT_FIELDS) break;
    if (!FIELD_PATTERN.test(field)) continue;
    if (
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      continue;
    }
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    context[field] =
      typeof value === "string"
        ? value.slice(0, MAX_CONTEXT_VALUE_LENGTH)
        : value;
  }
  return context;
}

export function configurableFormWorkflowEntityType(
  module: ConfigurableFormModule,
): WorkflowEntityType | null {
  switch (module) {
    case ConfigurableFormModule.OBSERVATION:
      return WorkflowEntityType.OBSERVATION;
    case ConfigurableFormModule.INCIDENT:
      return WorkflowEntityType.INCIDENT;
    case ConfigurableFormModule.AUDIT:
      return WorkflowEntityType.AUDIT;
    case ConfigurableFormModule.INSPECTION:
      return WorkflowEntityType.INSPECTION;
    case ConfigurableFormModule.CAPA:
      return WorkflowEntityType.CORRECTIVE_ACTION;
    case ConfigurableFormModule.RISK:
      return WorkflowEntityType.RISK;
    case ConfigurableFormModule.MOC:
      return WorkflowEntityType.MOC;
    case ConfigurableFormModule.COMPLIANCE:
      return WorkflowEntityType.COMPLIANCE;
    case ConfigurableFormModule.TRAINING:
      return WorkflowEntityType.TRAINING;
    case ConfigurableFormModule.CHEMICAL:
      return WorkflowEntityType.CHEMICAL;
    case ConfigurableFormModule.ENVIRONMENTAL:
      return WorkflowEntityType.ENVIRONMENTAL;
    case ConfigurableFormModule.PERMIT_TO_WORK:
      return WorkflowEntityType.PERMIT;
    case ConfigurableFormModule.BEHAVIOR_SAFETY:
    case ConfigurableFormModule.SIF_ASSURANCE:
    case ConfigurableFormModule.CERTIFICATION_READINESS:
    case ConfigurableFormModule.ASSET_SAFETY:
    case ConfigurableFormModule.CONTRACTOR:
    case ConfigurableFormModule.INDUSTRIAL_HYGIENE:
    case ConfigurableFormModule.REGULATORY_INTELLIGENCE:
    case ConfigurableFormModule.EMERGENCY_PREPAREDNESS:
    case ConfigurableFormModule.BUSINESS_CONTINUITY:
    case ConfigurableFormModule.RESEARCH:
    case ConfigurableFormModule.ESG:
    case ConfigurableFormModule.GENERAL:
      return null;
  }
}

export function workflowConditionsJson(
  conditions: WorkflowTriggerCondition[],
): Prisma.InputJsonValue {
  return conditions.map((condition) => ({
    field: condition.field,
    operator: condition.operator,
    value: condition.value,
  }));
}

function storedConditions(value: Prisma.JsonValue | null): {
  valid: boolean;
  conditions: WorkflowTriggerCondition[];
} {
  if (value === null) return { valid: true, conditions: [] };
  if (!Array.isArray(value) || value.length > MAX_CONDITIONS) {
    return { valid: false, conditions: [] };
  }
  const conditions: WorkflowTriggerCondition[] = [];
  for (const item of value) {
    if (!item || Array.isArray(item) || typeof item !== "object") {
      return { valid: false, conditions: [] };
    }
    const record = item as Record<string, unknown>;
    if (
      typeof record.field !== "string" ||
      !FIELD_PATTERN.test(record.field) ||
      typeof record.operator !== "string" ||
      !workflowConditionOperators.includes(
        record.operator as WorkflowConditionOperator,
      ) ||
      !(
        record.value === null ||
        typeof record.value === "string"
      )
    ) {
      return { valid: false, conditions: [] };
    }
    conditions.push({
      field: record.field,
      operator: record.operator as WorkflowConditionOperator,
      value: record.value,
    });
  }
  return { valid: true, conditions };
}

function conditionMatches(
  condition: WorkflowTriggerCondition,
  actual: string | number | boolean | null | undefined,
) {
  const exists = actual !== null && actual !== undefined && actual !== "";
  if (condition.operator === "EXISTS") return exists;
  if (condition.operator === "NOT_EXISTS") return !exists;
  if (!exists || condition.value === null) return false;

  const actualText = String(actual).trim();
  const expectedText = condition.value.trim();
  const normalizedActual = actualText.toLocaleLowerCase();
  const normalizedExpected = expectedText.toLocaleLowerCase();

  if (condition.operator === "EQUALS") {
    return normalizedActual === normalizedExpected;
  }
  if (condition.operator === "NOT_EQUALS") {
    return normalizedActual !== normalizedExpected;
  }
  if (condition.operator === "CONTAINS") {
    return normalizedActual.includes(normalizedExpected);
  }
  if (condition.operator === "IN" || condition.operator === "NOT_IN") {
    const choices = expectedText
      .split(",")
      .map((choice) => choice.trim().toLocaleLowerCase())
      .filter(Boolean);
    const included = choices.includes(normalizedActual);
    return condition.operator === "IN" ? included : !included;
  }

  const actualNumber = Number(actual);
  const expectedNumber = Number(condition.value);
  if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) {
    return false;
  }
  return condition.operator === "GREATER_THAN_OR_EQUAL"
    ? actualNumber >= expectedNumber
    : actualNumber <= expectedNumber;
}
