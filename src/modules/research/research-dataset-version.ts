export type ResearchDataRow = Record<string, unknown>;

export function createDatasetQualitySnapshot(sourceRows: ResearchDataRow[], outputRows: ResearchDataRow[], columns: string[]) {
  return {
    sourceRows: sourceRows.length,
    outputRows: outputRows.length,
    removedRows: sourceRows.length - outputRows.length,
    missingCells: outputRows.reduce((total, row) => total + columns.filter((key) => row[key] === null || row[key] === undefined || row[key] === "").length, 0),
    outlierFlags: outputRows.reduce((total, row) => total + Object.entries(row).filter(([key, value]) => key.endsWith("_outlier") && value === true).length, 0),
  };
}

export function researchRowsToCsv(rows: ResearchDataRow[], columns: string[]) {
  return [columns, ...rows.map((row) => columns.map((key) => row[key]))]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}

function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
