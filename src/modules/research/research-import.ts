import ExcelJS from "exceljs";
import {
  ResearchMeasurementLevel,
  ResearchVariableDataType,
} from "@prisma/client";

export type ImportedVariable = {
  sourceColumn: string;
  key: string;
  label: string;
  dataType: ResearchVariableDataType;
  measurementLevel: ResearchMeasurementLevel;
  position: number;
};

export async function profileResearchFile(
  bytes: ArrayBuffer,
  mimeType: string,
  fileName: string,
) {
  const rows = fileName.toLowerCase().endsWith(".csv") || mimeType === "text/csv"
    ? parseCsv(new TextDecoder().decode(bytes))
    : await parseWorkbook(bytes);
  if (rows.length < 2) throw new Error("The file must contain a header and at least one data row.");
  if (rows.length > 50_001) throw new Error("This import supports up to 50,000 rows per file.");
  const headers = uniqueHeaders(rows[0] ?? []);
  if (!headers.length || headers.length > 250) throw new Error("Files must contain between 1 and 250 named columns.");
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell !== ""));
  const variables = headers.map((label, position) => {
    const values = dataRows.map((row) => row[position] ?? "").filter(Boolean);
    const dataType = inferType(values);
    return {
      sourceColumn: label,
      key: uniqueKey(label, position),
      label,
      dataType,
      measurementLevel:
        dataType === ResearchVariableDataType.NUMBER
          ? ResearchMeasurementLevel.RATIO
          : ResearchMeasurementLevel.NOMINAL,
      position,
    };
  });
  return {
    rowCount: dataRows.length,
    columnCount: headers.length,
    variables,
    preview: dataRows.slice(0, 20).map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
    ),
  };
}

async function parseWorkbook(bytes: ArrayBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The workbook does not contain a worksheet.");
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : Object.values(row.values);
    rows.push(values.map(cellValue));
  });
  return rows;
}

function cellValue(value: ExcelJS.CellValue | undefined) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("result" in value) return String(value.result ?? "");
    if ("text" in value) return String(value.text ?? "");
    return "";
  }
  return String(value).trim();
}

export function parseCsv(input: string) {
  const rows: string[][] = [[""]];
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"' && quoted && input[index + 1] === '"') {
      rows[rows.length - 1]![rows[rows.length - 1]!.length - 1] += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) rows.at(-1)!.push("");
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      rows.push([""]);
    } else rows[rows.length - 1]![rows[rows.length - 1]!.length - 1] += character;
  }
  return rows.filter((row) => row.some((cell) => cell.trim() !== "")).map((row) => row.map((cell) => cell.trim()));
}

function uniqueHeaders(input: string[]) {
  const used = new Map<string, number>();
  return input.map((raw, index) => {
    const base = raw.trim().slice(0, 160) || `Column ${index + 1}`;
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return count ? `${base} (${count + 1})` : base;
  });
}

function uniqueKey(label: string, position: number) {
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 70);
  return `${key || "variable"}_${position + 1}`;
}

function inferType(values: string[]) {
  if (values.length && values.every((value) => Number.isFinite(Number(value)))) return ResearchVariableDataType.NUMBER;
  if (values.length && values.every((value) => /^(true|false|yes|no)$/i.test(value))) return ResearchVariableDataType.BOOLEAN;
  if (values.length && values.every((value) => /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(Date.parse(value)))) return ResearchVariableDataType.DATE;
  return ResearchVariableDataType.TEXT;
}
