import type { SamplingFrameRow } from "@/modules/research/research-sampling-execution";

export function validateSamplingFrame(input: {
  rows: string[][];
  identifierColumn: string;
  strataColumn?: string | null;
  clusterColumn?: string | null;
}) {
  if (input.rows.length < 2)
    throw new Error(
      "The sampling frame must contain a header and at least one unit.",
    );
  if (input.rows.length > 50_001)
    throw new Error("Sampling frames support up to 50,000 units.");
  const headers = (input.rows[0] ?? []).map((header) => header.trim());
  if (!headers.length || headers.some((header) => !header))
    throw new Error("Every sampling-frame column requires a header.");
  if (new Set(headers).size !== headers.length)
    throw new Error("Sampling-frame column headers must be unique.");
  const identifierIndex = headers.indexOf(input.identifierColumn);
  const strataIndex = input.strataColumn
    ? headers.indexOf(input.strataColumn)
    : -1;
  const clusterIndex = input.clusterColumn
    ? headers.indexOf(input.clusterColumn)
    : -1;
  if (identifierIndex < 0)
    throw new Error(
      "The identifier column is not present in the sampling frame.",
    );
  if (input.strataColumn && strataIndex < 0)
    throw new Error("The strata column is not present in the sampling frame.");
  if (input.clusterColumn && clusterIndex < 0)
    throw new Error("The cluster column is not present in the sampling frame.");

  const dataRows = input.rows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim()));
  const frameRows: SamplingFrameRow[] = dataRows.map((row, index) => ({
    frameRowNumber: index + 2,
    unitReference: String(row[identifierIndex] ?? "")
      .trim()
      .slice(0, 200),
    stratum:
      strataIndex >= 0
        ? String(row[strataIndex] ?? "")
            .trim()
            .slice(0, 200) || null
        : null,
    cluster:
      clusterIndex >= 0
        ? String(row[clusterIndex] ?? "")
            .trim()
            .slice(0, 200) || null
        : null,
  }));
  const missingIdentifiers = frameRows
    .filter((row) => !row.unitReference)
    .map((row) => row.frameRowNumber);
  if (missingIdentifiers.length)
    throw new Error(
      `Sampling-frame identifiers are missing on row${missingIdentifiers.length === 1 ? "" : "s"} ${missingIdentifiers.slice(0, 10).join(", ")}.`,
    );
  const duplicates = duplicateValues(frameRows.map((row) => row.unitReference));
  if (duplicates.length)
    throw new Error(
      `Sampling-frame identifiers must be unique. Duplicate: ${duplicates.slice(0, 5).join(", ")}.`,
    );
  const strata = counts(frameRows.map((row) => row.stratum));
  const clusters = counts(frameRows.map((row) => row.cluster));
  return {
    headers,
    frameRows,
    validation: {
      rowCount: frameRows.length,
      uniqueIdentifiers: frameRows.length,
      strataCount: Object.keys(strata).length,
      clusterCount: Object.keys(clusters).length,
      strata,
      clusters,
      validatedAt: new Date().toISOString(),
    },
  };
}

function duplicateValues(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

function counts(values: Array<string | null>) {
  const result: Record<string, number> = {};
  for (const value of values)
    if (value) result[value] = (result[value] ?? 0) + 1;
  return result;
}
