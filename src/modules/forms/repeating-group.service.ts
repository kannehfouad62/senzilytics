export const REPEATING_GROUP_COLUMN_TYPES = ["SHORT_TEXT", "LONG_TEXT", "NUMBER", "DATE", "SINGLE_SELECT", "BOOLEAN"] as const;
export type RepeatingGroupColumnType = (typeof REPEATING_GROUP_COLUMN_TYPES)[number];
export type RepeatingGroupColumn = { key: string; label: string; type: RepeatingGroupColumnType; required: boolean; options: string[]; showWhen: { columnKey: string; value: string } | null };
export type RepeatingGroupConfig = { minRows: number; maxRows: number; columns: RepeatingGroupColumn[] };
export type RepeatingGroupRow = { id: string; values: Record<string, string | number | boolean> };

const keyOf = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);
const list = (value: string) => [...new Set(value.split(";").map((item) => item.trim()).filter(Boolean))];

export function parseRepeatingGroupColumns(value: string): RepeatingGroupColumn[] {
  const columns = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [rawKey, rawLabel, rawType = "SHORT_TEXT", rawRequired = "", rawOptions = "", rawShowWhen = ""] = line.split("|").map((item) => item.trim());
    const key = keyOf(rawKey || rawLabel), label = rawLabel || rawKey;
    const type = rawType.toUpperCase() as RepeatingGroupColumnType;
    if (!key || !label) throw new Error("Every roster column requires a stable key and label.");
    if (!REPEATING_GROUP_COLUMN_TYPES.includes(type)) throw new Error(`Roster column ${label} has an unsupported type.`);
    const options = list(rawOptions);
    if (type === "SINGLE_SELECT" && options.length < 2) throw new Error(`Roster column ${label} requires at least two choices.`);
    const [controller, ...expectedParts] = rawShowWhen.split("=");
    const showWhen = controller?.trim() && expectedParts.length ? { columnKey: keyOf(controller), value: expectedParts.join("=").trim() } : null;
    return { key, label: label.slice(0, 120), type, required: rawRequired.toLowerCase() === "required", options, showWhen };
  });
  if (!columns.length || columns.length > 20) throw new Error("Repeating groups require between 1 and 20 columns.");
  if (new Set(columns.map((column) => column.key)).size !== columns.length) throw new Error("Roster column keys must be unique.");
  for (const column of columns) if (column.showWhen && !columns.some((candidate) => candidate.key === column.showWhen?.columnKey)) throw new Error(`Conditional roster column ${column.label} references an unknown column.`);
  return columns;
}

export function repeatingGroupConfig(value: unknown): RepeatingGroupConfig | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const candidate = value as { minRows?: unknown; maxRows?: unknown; columns?: unknown };
  if (!Number.isInteger(candidate.minRows) || !Number.isInteger(candidate.maxRows) || !Array.isArray(candidate.columns)) return null;
  const minRows = Number(candidate.minRows), maxRows = Number(candidate.maxRows);
  if (minRows < 0 || maxRows < Math.max(1, minRows) || maxRows > 50) return null;
  try {
    const columns = parseRepeatingGroupColumns(candidate.columns.map((column) => {
      if (!column || typeof column !== "object" || Array.isArray(column)) throw new Error("Invalid roster column.");
      const item = column as RepeatingGroupColumn;
      return [item.key, item.label, item.type, item.required ? "required" : "optional", item.options?.join(";") || "", item.showWhen ? `${item.showWhen.columnKey}=${item.showWhen.value}` : ""].join("|");
    }).join("\n"));
    return { minRows, maxRows, columns };
  } catch { return null; }
}

export function validateRepeatingGroup(value: unknown, config: RepeatingGroupConfig, label: string): RepeatingGroupRow[] {
  if (!Array.isArray(value) || value.length < config.minRows || value.length > config.maxRows) throw new Error(`${label} requires between ${config.minRows} and ${config.maxRows} rows.`);
  const ids = new Set<string>();
  return value.map((raw, index) => {
    if (!raw || Array.isArray(raw) || typeof raw !== "object") throw new Error(`${label} row ${index + 1} is invalid.`);
    const candidate = raw as { id?: unknown; values?: unknown };
    const id = typeof candidate.id === "string" ? candidate.id : "";
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(id) || ids.has(id)) throw new Error(`${label} contains an invalid or duplicate row identifier.`);
    ids.add(id);
    if (!candidate.values || Array.isArray(candidate.values) || typeof candidate.values !== "object") throw new Error(`${label} row ${index + 1} is invalid.`);
    const source = candidate.values as Record<string, unknown>, values: RepeatingGroupRow["values"] = {};
    for (const column of config.columns) {
      const visible = !column.showWhen || String(source[column.showWhen.columnKey] ?? "") === column.showWhen.value;
      if (!visible) continue;
      const rawValue = source[column.key]; const empty = rawValue === undefined || rawValue === null || rawValue === "";
      if (empty) { if (column.required) throw new Error(`${label}, row ${index + 1}: ${column.label} is required.`); continue; }
      if (column.type === "NUMBER") { const number = Number(rawValue); if (!Number.isFinite(number)) throw new Error(`${label}, row ${index + 1}: ${column.label} must be a number.`); values[column.key] = number; }
      else if (column.type === "BOOLEAN") values[column.key] = rawValue === true || rawValue === "true" || rawValue === "on";
      else { const text = String(rawValue).trim().slice(0, column.type === "LONG_TEXT" ? 4000 : 500); if (column.type === "DATE" && !/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${label}, row ${index + 1}: ${column.label} must be a valid date.`); if (column.type === "SINGLE_SELECT" && !column.options.includes(text)) throw new Error(`${label}, row ${index + 1}: select a valid ${column.label}.`); values[column.key] = text; }
    }
    return { id, values };
  });
}
