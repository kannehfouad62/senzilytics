import type { ResearchDataRow, ResearchValue, ResearchVariable } from "@/modules/research/research-analysis";

export type ResearchFilterOperator = "EQUALS" | "NOT_EQUALS" | "CONTAINS" | "RANGE" | "IS_MISSING" | "IS_NOT_MISSING";
export type ResearchFilterClause = { id: string; variableKey: string; operator: ResearchFilterOperator; value?: string; minimum?: number; maximum?: number };
export type ResearchFilterDefinition = { logic: "ALL" | "ANY"; clauses: ResearchFilterClause[] };

const operators = new Set<ResearchFilterOperator>(["EQUALS", "NOT_EQUALS", "CONTAINS", "RANGE", "IS_MISSING", "IS_NOT_MISSING"]);
const missing = (value: ResearchValue | undefined) => value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
const values = (value: ResearchValue | undefined) => Array.isArray(value) ? value.map(String) : missing(value) ? [] : [String(value)];

export function normalizeResearchFilters(value: unknown, variables: ResearchVariable[]): ResearchFilterDefinition {
  const candidate = value && typeof value === "object" ? value as Partial<ResearchFilterDefinition> : {};
  const allowedKeys = new Set(variables.map(variable => variable.key));
  const clauses = Array.isArray(candidate.clauses) ? candidate.clauses.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const clause = item as Partial<ResearchFilterClause>;
    if (!clause.variableKey || !allowedKeys.has(clause.variableKey) || !clause.operator || !operators.has(clause.operator)) return [];
    const minimum = typeof clause.minimum === "number" && Number.isFinite(clause.minimum) ? clause.minimum : undefined;
    const maximum = typeof clause.maximum === "number" && Number.isFinite(clause.maximum) ? clause.maximum : undefined;
    return [{ id: String(clause.id || `filter-${index}`).slice(0, 80), variableKey: clause.variableKey, operator: clause.operator, value: String(clause.value ?? "").slice(0, 500), minimum, maximum }];
  }).slice(0, 8) : [];
  return { logic: candidate.logic === "ANY" ? "ANY" : "ALL", clauses };
}

export function applyResearchFilters(rows: ResearchDataRow[], definition: ResearchFilterDefinition) {
  if (!definition.clauses.length) return [...rows];
  return rows.filter(row => {
    const matches = definition.clauses.map(clause => {
      const current = row.values[clause.variableKey];
      if (clause.operator === "IS_MISSING") return missing(current);
      if (clause.operator === "IS_NOT_MISSING") return !missing(current);
      if (clause.operator === "RANGE") return typeof current === "number" && (clause.minimum === undefined || current >= clause.minimum) && (clause.maximum === undefined || current <= clause.maximum);
      const normalized = values(current);
      if (clause.operator === "NOT_EQUALS") return !normalized.includes(clause.value ?? "");
      if (clause.operator === "CONTAINS") return normalized.some(value => value.toLocaleLowerCase().includes((clause.value ?? "").toLocaleLowerCase()));
      return normalized.includes(clause.value ?? "");
    });
    return definition.logic === "ANY" ? matches.some(Boolean) : matches.every(Boolean);
  });
}

export function researchFilterOptions(rows: ResearchDataRow[], variableKey: string) {
  return [...new Set(rows.flatMap(row => values(row.values[variableKey])))].sort((first, second) => first.localeCompare(second));
}
