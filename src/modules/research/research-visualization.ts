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

export function buildFunnelData(rows: ResearchDataRow[], variable: ResearchVariable) {
  const counts = new Map<string, number>();
  for (const row of rows) for (const value of values(row.values[variable.key])) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].map(([name, value]) => ({ name, value })).sort((first, second) => second.value - first.value || first.name.localeCompare(second.name)).slice(0, 20);
}

export function buildRadarData(rows: ResearchDataRow[], category: ResearchVariable, outcome?: ResearchVariable | null) {
  if (!outcome || outcome.type !== "NUMBER") return buildFunnelData(rows, category).slice(0, 12);
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const current = row.values[outcome.key];
    if (typeof current !== "number" || !Number.isFinite(current)) continue;
    for (const name of values(row.values[category.key])) groups.set(name, [...(groups.get(name) ?? []), current]);
  }
  return [...groups].map(([name, observations]) => ({ name, value: observations.reduce((sum, value) => sum + value, 0) / observations.length, count: observations.length })).sort((first, second) => second.value - first.value).slice(0, 12);
}

export function buildHeatmapData(rows: ResearchDataRow[], rowVariable: ResearchVariable, columnVariable: ResearchVariable) {
  const rowLabels = researchFilterOptions(rows, rowVariable.key).slice(0, 20);
  const columnLabels = researchFilterOptions(rows, columnVariable.key).slice(0, 20);
  const cells = rowLabels.map(rowLabel => columnLabels.map(columnLabel => rows.reduce((count, row) => count + (values(row.values[rowVariable.key]).includes(rowLabel) && values(row.values[columnVariable.key]).includes(columnLabel) ? 1 : 0), 0)));
  return { rowLabels, columnLabels, cells, maximum: Math.max(1, ...cells.flat()) };
}

export function buildSmallMultipleData(rows: ResearchDataRow[], category: ResearchVariable, outcome: ResearchVariable) {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const current = row.values[outcome.key];
    if (typeof current !== "number" || !Number.isFinite(current)) continue;
    for (const name of values(row.values[category.key])) groups.set(name, [...(groups.get(name) ?? []), current]);
  }
  return [...groups].map(([name, observations]) => ({ name, observations, minimum: Math.min(...observations), maximum: Math.max(...observations), mean: observations.reduce((sum, value) => sum + value, 0) / observations.length })).sort((first, second) => first.name.localeCompare(second.name)).slice(0, 12);
}
