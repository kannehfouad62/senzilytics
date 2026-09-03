export type ResearchReportAnalysisEvidence = {
  id: string;
  title: string;
  method: string;
  version: number;
  population: number;
  result: unknown;
  approvedAt: string | Date | null;
  approvedBy: { name: string | null } | null;
  collection: { name: string; datasetStatus: string };
};

export function reportAnalysisEvidence(snapshot: unknown): ResearchReportAnalysisEvidence[] {
  if (!snapshot || typeof snapshot !== "object" || !("analyses" in snapshot)) return [];
  const analyses = (snapshot as { analyses?: unknown }).analyses;
  if (!Array.isArray(analyses)) return [];
  return analyses.filter(isAnalysisEvidence).slice(0, 50);
}

function isAnalysisEvidence(value: unknown): value is ResearchReportAnalysisEvidence {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ResearchReportAnalysisEvidence>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.method === "string" &&
    typeof candidate.version === "number" &&
    typeof candidate.population === "number" &&
    Boolean(candidate.collection && typeof candidate.collection.name === "string")
  );
}

export function researchResultLines(
  result: unknown,
  maximum = 16,
): Array<{ label: string; value: string }> {
  const output: Array<{ label: string; value: string }> = [];
  visit(result, "Result", output, maximum);
  return output;
}

function visit(
  value: unknown,
  path: string,
  output: Array<{ label: string; value: string }>,
  maximum: number,
) {
  if (output.length >= maximum || value === null || value === undefined) return;
  if (["string", "number", "boolean"].includes(typeof value)) {
    output.push({
      label: path,
      value:
        typeof value === "number" && Number.isFinite(value)
          ? Number(value.toFixed(4)).toString()
          : String(value),
    });
    return;
  }
  if (typeof value !== "object") return;
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index + 1), item] as const)
    : Object.entries(value);
  for (const [key, item] of entries) {
    if (key === "diagnostics" || output.length >= maximum) continue;
    visit(item, `${path} › ${humanize(key)}`, output, maximum);
  }
}

const humanize = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
