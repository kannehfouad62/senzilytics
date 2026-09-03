import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { buildChartData, summarizeVariable } from "@/modules/research/research-analysis";
import { getResearchDataset } from "@/modules/research/research-dataset.service";
import { chartElements, createResearchPresentation, type SlideElement } from "@/modules/research/research-presentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ collectionId: string }> }) {
  await requirePermission(PermissionKey.EXPORT_RESEARCH_OUTPUTS);
  const [{ collectionId }, { organizationId }] = await Promise.all([params, getCurrentUserTenant()]);
  const dataset = await getResearchDataset(organizationId, collectionId);
  if (!dataset) return new Response("Dataset not found.", { status: 404 });
  const { collection, variables, analysisRows } = dataset;
  const url = new URL(request.url);
  const x = variables.find(item => item.key === url.searchParams.get("x")) ?? variables[0];
  const y = variables.find(item => item.key === url.searchParams.get("y")) ?? null;
  const stats = x ? summarizeVariable(x, analysisRows) : null;
  const chart = (x ? buildChartData(analysisRows, x, y) : []).map((item, index) => ({
    name: "name" in item ? String(item.name) : `Observation ${index + 1}`,
    value: Number("value" in item ? item.value : "y" in item ? item.y : 0),
  }));
  const title: SlideElement[] = [
    { x: .7, y: .65, w: 7, h: .35, text: "SENZILYTICS RESEARCH INTELLIGENCE", size: 12, color: "67E8F9", bold: true },
    { x: .7, y: 1.35, w: 11.8, h: .8, text: collection.project.title, size: 30, bold: true },
    { x: .7, y: 2.35, w: 10, h: .4, text: `${collection.project.reference} · ${collection.name}`, size: 16, color: "94A3B8" },
    { x: .7, y: 3.25, w: 5.6, h: .45, text: `Client: ${collection.project.client?.name ?? "Internal research"}`, size: 16, color: "CBD5E1" },
    { x: .7, y: 3.8, w: 5.6, h: .45, text: `Included responses: ${analysisRows.length}`, size: 16, color: "CBD5E1" },
    { x: .7, y: 4.35, w: 5.6, h: .45, text: `Dataset status: ${collection.datasetStatus}`, size: 16, color: "CBD5E1" },
    { x: .7, y: 5.45, w: 11.7, h: .55, text: collection.questionnaire.purpose, size: 13, color: "94A3B8" },
  ];
  const analysis: SlideElement[] = [
    { x: .65, y: .45, w: 11.8, h: .5, text: y ? `${y.label} by ${x?.label}` : `Distribution of ${x?.label ?? "selected variable"}`, size: 24, bold: true },
    ...chartElements(chart),
    { x: 9.55, y: 1.55, w: 2.8, h: .35, text: `N  ${stats?.present ?? 0}`, size: 15, color: "67E8F9", bold: true },
    { x: 9.55, y: 2.1, w: 2.8, h: .35, text: `Missing  ${stats?.missing ?? 0}`, size: 15, color: "CBD5E1" },
    { x: 9.55, y: 2.65, w: 2.8, h: .35, text: `Mean  ${stats?.mean?.toFixed(2) ?? "—"}`, size: 15, color: "CBD5E1" },
    { x: 9.55, y: 3.2, w: 2.8, h: .35, text: `Median  ${stats?.median?.toFixed(2) ?? "—"}`, size: 15, color: "CBD5E1" },
    { x: 9.55, y: 3.75, w: 2.8, h: .35, text: `Std. dev.  ${stats?.standardDeviation?.toFixed(2) ?? "—"}`, size: 15, color: "CBD5E1" },
    { x: .7, y: 6.35, w: 11.8, h: .35, text: "Editable visualization generated from the governed analytical dataset.", size: 10, color: "64748B" },
  ];
  const governance: SlideElement[] = [
    { x: .7, y: .5, w: 11, h: .6, text: "Methodology & Governance", size: 26, bold: true },
    { x: .8, y: 1.5, w: 4, h: .35, text: "RESEARCH PURPOSE", size: 11, color: "67E8F9", bold: true },
    { x: .8, y: 1.95, w: 11.5, h: .8, text: collection.questionnaire.purpose, size: 15, color: "CBD5E1" },
    { x: .8, y: 3.1, w: 4, h: .35, text: "QUESTIONNAIRE VERSION", size: 11, color: "67E8F9", bold: true },
    { x: .8, y: 3.5, w: 4, h: .4, text: String(collection.formVersion.version), size: 16, bold: true },
    { x: 4.7, y: 3.1, w: 4, h: .35, text: "IDENTITY MODE", size: 11, color: "67E8F9", bold: true },
    { x: 4.7, y: 3.5, w: 4, h: .4, text: collection.questionnaire.identityMode, size: 16, bold: true },
    { x: 8.6, y: 3.1, w: 4, h: .35, text: "DATASET STATUS", size: 11, color: "67E8F9", bold: true },
    { x: 8.6, y: 3.5, w: 4, h: .4, text: collection.datasetStatus, size: 16, bold: true },
    { x: .8, y: 4.65, w: 4, h: .35, text: "DATA OWNER", size: 11, color: "67E8F9", bold: true },
    { x: .8, y: 5.05, w: 11, h: .45, text: collection.project.client?.dataOwnerName ?? collection.project.client?.name ?? "Internal organization", size: 16, color: "CBD5E1" },
    { x: .8, y: 6.15, w: 11.6, h: .35, text: "Automated analysis supports—rather than replaces—qualified statistical interpretation.", size: 10, color: "64748B" },
  ];
  const output = await createResearchPresentation([title, analysis, governance]);
  const body = new Uint8Array(output.byteLength);
  body.set(output);
  return new Response(body, { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "Content-Disposition": `attachment; filename="${collection.project.reference}-research-analysis.pptx"`,
    "Cache-Control": "private, no-store",
  } });
}
