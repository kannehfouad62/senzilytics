import ExcelJS from "exceljs";
import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ analysisId: string }> },
) {
  await requirePermission(PermissionKey.EXPORT_RESEARCH_OUTPUTS);
  const [{ analysisId }, { organizationId }] = await Promise.all([
      params,
      getCurrentUserTenant(),
    ]),
    analysis = await prisma.researchAnalysis.findFirst({
      where: { id: analysisId, organizationId },
      include: {
        collection: { include: { project: true } },
        datasetVersion: { include: { dataset: { include: { project: true } } } },
        analyst: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
    });
  if (!analysis) return new Response("Analysis not found.", { status: 404 });
  const project=analysis.collection?.project??analysis.datasetVersion?.dataset.project;
  if(!project)return new Response("Analysis source not found.",{status:404});
  const source=analysis.collection?`Collection ${analysis.collection.name}`:`Imported dataset v${analysis.datasetVersion?.version}`;
  const workbook = new ExcelJS.Workbook(),
    governance = workbook.addWorksheet("Governance"),
    results = workbook.addWorksheet("Model Results");
  governance.addRows(
    [
      ["Senzilytics Governed Research Model"],
      ["Project", project.reference],
      ["Governed source",source],
      ["Dataset version ID",analysis.datasetVersionId??""],
      ["Title", analysis.title],
      ["Method", analysis.method],
      ["Version", analysis.version],
      ["Status", analysis.status],
      ["Analyst", analysis.analyst.name ?? ""],
      ["Approved by", analysis.approvedBy?.name ?? ""],
      ["Analytical population", analysis.datasetResponseCount],
      ["Variables", analysis.variableKeys.join(", ")],
      ["Weight variable",analysis.weightVariableKey??"Unweighted"],
    ].map((row) => row.map(safeSpreadsheetValue)),
  );
  results.addRow(["Result path", "Value"]);
  for (const [path, value] of flatten(analysis.resultSnapshot))
    results.addRow([safeSpreadsheetValue(path), safeSpreadsheetValue(value)]);
  for (const sheet of workbook.worksheets) {
    sheet.columns.forEach((column) => (column.width = 30));
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${project.reference}-model-v${analysis.version}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
function flatten(
  value: unknown,
  path = "result",
): Array<[string, string | number | boolean]> {
  if (value === null || value === undefined) return [[path, ""]];
  if (typeof value !== "object")
    return [[path, value as string | number | boolean]];
  return (
    Array.isArray(value)
      ? value.map((item, index) => [String(index), item] as const)
      : Object.entries(value)
  ).flatMap(([key, item]) => flatten(item, `${path}.${key}`));
}

function safeSpreadsheetValue(value: string | number | boolean) {
  return typeof value === "string" && /^[=+\-@\t\r]/.test(value)
    ? `'${value}`
    : value;
}
