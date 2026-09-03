import { PermissionKey } from "@prisma/client";

import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  createResearchPresentation,
  type SlideElement,
} from "@/modules/research/research-presentation";
import {
  reportAnalysisEvidence,
  researchResultLines,
} from "@/modules/research/research-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  await requirePermission(PermissionKey.EXPORT_RESEARCH_OUTPUTS);
  const [{ reportId }, { organizationId }] = await Promise.all([
    params,
    getCurrentUserTenant(),
  ]);
  const report = await prisma.researchReport.findFirst({
    where: { id: reportId, organizationId },
    include: {
      organization: { select: { name: true } },
      project: { include: { client: true } },
      author: { select: { name: true } },
      approvedBy: { select: { name: true } },
    },
  });
  if (!report) return new Response("Research report not found.", { status: 404 });
  const evidenceSlides = reportAnalysisEvidence(report.evidenceSnapshot).map(
    (analysis) => [
      item(.7, .5, 11, .5, analysis.title, 24, true),
      item(
        .7,
        1.12,
        11,
        .38,
        `${analysis.method.replaceAll("_", " ")} · v${analysis.version} · ${analysis.population} observations`,
        12,
        false,
        "94A3B8",
      ),
      ...researchResultLines(analysis.result, 12).map((line, index) =>
        item(
          .8 + (index % 2) * 6,
          1.75 + Math.floor(index / 2) * .72,
          5.5,
          .48,
          `${line.label}: ${line.value}`,
          11,
          false,
          "CBD5E1",
        ),
      ),
    ],
  );

  const slides: SlideElement[][] = [
    [
      item(.7, .7, 10, .4, "SENZILYTICS GOVERNED RESEARCH REPORT", 13, true, "67E8F9"),
      item(.7, 1.5, 11.5, 1, report.title, 30, true),
      item(.7, 2.8, 11, .4, `${report.project.reference} · ${report.reference} · v${report.version}`, 16, false, "94A3B8"),
      item(.7, 3.8, 11, .4, report.project.client?.name ?? "Internal research", 16, false, "CBD5E1"),
      item(.7, 4.5, 11, .4, `Governance status: ${report.status}`, 14, false, "CBD5E1"),
    ],
    narrativeSlide("Executive Summary", report.executiveSummary),
    narrativeSlide("Methodology", report.methodology),
    narrativeSlide("Key Findings", report.findings),
    narrativeSlide("Discussion and Interpretation", report.discussion ?? "Not recorded"),
    narrativeSlide("Conclusions", report.conclusions),
    narrativeSlide("Recommendations", report.recommendations),
    narrativeSlide("Limitations", report.limitations),
    ...evidenceSlides,
    [
      item(.7, .5, 11, .5, "Governance Record", 26, true),
      item(.8, 1.5, 11, .5, `Organization: ${report.organization.name}`, 16, false, "CBD5E1"),
      item(.8, 2.2, 11, .5, `Author: ${report.author.name ?? "Assigned author"}`, 16, false, "CBD5E1"),
      item(.8, 2.9, 11, .5, `Approved by: ${report.approvedBy?.name ?? "Pending independent approval"}`, 16, false, "CBD5E1"),
      item(.8, 3.6, 11, .5, `Frozen analyses: ${report.analysisIds.length}`, 16, false, "CBD5E1"),
      item(.8, 4.3, 11, .5, `Snapshot generated: ${report.snapshotGeneratedAt.toISOString()}`, 14, false, "94A3B8"),
    ],
  ];
  const output = await createResearchPresentation(slides);
  const body = new Uint8Array(output.byteLength);
  body.set(output);
  return new Response(body, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${report.reference}-v${report.version}.pptx"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function narrativeSlide(title: string, narrative: string): SlideElement[] {
  const paragraphs = narrative
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
  return [
    item(.7, .5, 11, .5, title, 26, true),
    ...paragraphs.map((text, index) =>
      item(.85, 1.4 + index * .68, 11, .52, text, 14, false, "CBD5E1"),
    ),
  ];
}

function item(
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  size: number,
  bold = false,
  color?: string,
): SlideElement {
  return { x, y, w, h, text, size, bold, color };
}
