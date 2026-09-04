import ExcelJS from "exceljs";
import { PermissionKey } from "@prisma/client";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { summarizeVariable } from "@/modules/research/research-analysis";
import { getResearchDataset } from "@/modules/research/research-dataset.service";
import { buildAnalysisSnapshot } from "@/modules/research/research-statistics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const safe = (value: unknown) => { if (Array.isArray(value)) return value.join(" | "); if (typeof value === "string" && /^[=+\-@\t\r]/.test(value)) return `'${value}`; return value ?? ""; };

export async function GET(request: Request, { params }: { params: Promise<{ collectionId: string }> }) {
  await requirePermission(PermissionKey.EXPORT_RESEARCH_OUTPUTS);
  const [{ collectionId }, { organizationId }] = await Promise.all([params, getCurrentUserTenant()]);
  const dataset = await getResearchDataset(organizationId, collectionId);
  if (!dataset) return new Response("Dataset not found.", { status: 404 });
  const { collection, variables, rows, analysisRows, responseRows, qualityIssues } = dataset;
  const url = new URL(request.url);
  const method = url.searchParams.get("mode") ?? "AUTO";
  const x = variables.find(item => item.key === url.searchParams.get("x")) ?? variables[0];
  const y = variables.find(item => item.key === url.searchParams.get("y")) ?? null;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Senzilytics";
  workbook.subject = `Governed research dataset ${collection.project.reference}`;

  const metadata = workbook.addWorksheet("Governance");
  metadata.addRows([["Senzilytics Research Dataset"], ["Project", `${collection.project.reference} — ${collection.project.title}`], ["Commissioning client", collection.project.client?.name ?? "Internal research"], ["Research purpose", collection.questionnaire.purpose], ["Collection wave", collection.name], ["Questionnaire version", collection.formVersion.version], ["Dataset status", collection.datasetStatus], ["Identity mode", collection.questionnaire.identityMode], ["Completed responses", rows.length], ["Included analytical responses", analysisRows.length], ["Generated at", new Date().toISOString()]]);
  const data = workbook.addWorksheet("Clean Data");
  data.addRow(["response_id", "submitted_at", ...variables.map(variable => variable.key)]);
  for (const row of analysisRows) data.addRow([row.responseId, row.submittedAt, ...variables.map(variable => safe(row.values[variable.key]))]);
  const dictionary = workbook.addWorksheet("Data Dictionary");
  dictionary.addRow(["Variable key", "Label", "Type", "Required"]);
  for (const variable of variables) dictionary.addRow([variable.key, variable.label, variable.type, variable.required ? "Yes" : "No"]);
  const quality = workbook.addWorksheet("Quality Review");
  quality.addRow(["Response code", "Disposition", "Automated signals", "Reviewer notes", "Reviewed by", "Reviewed at"]);
  for (const item of responseRows) quality.addRow([item.response.id.slice(-8).toUpperCase(), item.response.disposition, (qualityIssues.get(item.response.id) ?? []).join(" | "), item.response.qualityNotes ?? "", item.response.reviewedBy?.name ?? "", item.response.reviewedAt?.toISOString() ?? ""]);
  const summary = workbook.addWorksheet("Statistics");
  summary.addRow(["Variable", "N", "Missing", "Unique", "Mean", "Median", "Std deviation", "Minimum", "Maximum"]);
  for (const variable of variables) { const stats = summarizeVariable(variable, analysisRows); summary.addRow([variable.label, stats.present, stats.missing, stats.unique, stats.mean, stats.median, stats.standardDeviation, stats.min, stats.max]); }
  const advanced = workbook.addWorksheet("Advanced Analysis");
  advanced.addRows([["Advanced analytical output"], ["Method", method], ["X variable", x?.label ?? ""], ["Y variable", y?.label ?? ""], ["Analytical population", analysisRows.length]]);
  if (x) { advanced.addRow([]); advanced.addRow(["Result path", "Value"]); for (const [path, value] of flatten(buildAnalysisSnapshot(method, analysisRows, x, y))) advanced.addRow([path, safe(value)]); }
  for (const sheet of workbook.worksheets) { sheet.views = [{ state: "frozen", ySplit: sheet.name === "Governance" ? 0 : 1 }]; sheet.getRow(1).font = { bold: true, color: { argb: "FF07111F" } }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF67E8F9" } }; sheet.columns.forEach(column => { column.width = 22; }); sheet.autoFilter = sheet.rowCount > 1 && sheet.columnCount > 1 ? { from: { row: 1, column: 1 }, to: { row: sheet.rowCount, column: sheet.columnCount } } : undefined; }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${collection.project.reference}-research-dataset.xlsx"`, "Cache-Control": "private, no-store" } });
}

function flatten(value: unknown, path = "result"): Array<[string, unknown]> {
  if (value === null || typeof value !== "object") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => flatten(item, `${path}[${index}]`));
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => flatten(item, `${path}.${key}`));
}
