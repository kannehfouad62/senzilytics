import { PermissionKey } from "@prisma/client";
import { notFound } from "next/navigation";

import { PrintReportButton } from "@/features/research/print-report-button";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  reportAnalysisEvidence,
  researchResultLines,
} from "@/modules/research/research-report";

export const dynamic = "force-dynamic";

export default async function PrintableResearchReport({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
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
      publishedBy: { select: { name: true } },
    },
  });
  if (!report) notFound();
  const analyses = reportAnalysisEvidence(report.evidenceSnapshot);

  return (
    <main className="mx-auto max-w-5xl bg-white p-10 text-slate-950 print:max-w-none print:p-0">
      <div className="mb-8 flex justify-end print:hidden">
        <PrintReportButton />
      </div>
      <header className="border-b-4 border-cyan-500 pb-8">
        <p className="text-sm font-bold tracking-[.2em] text-cyan-700">
          SENZILYTICS GOVERNED RESEARCH REPORT
        </p>
        <h1 className="mt-5 text-4xl font-bold">{report.title}</h1>
        <p className="mt-3 text-lg text-slate-600">
          {report.project.reference} · {report.reference} · Version {report.version}
        </p>
      </header>
      <div className="mt-8 grid grid-cols-2 gap-5 rounded-xl bg-slate-100 p-6 text-sm">
        <Meta label="Research organization" value={report.organization.name} />
        <Meta label="Commissioning client" value={report.project.client?.name ?? "Internal research"} />
        <Meta label="Data owner" value={report.project.client?.dataOwnerName ?? report.project.dataOwnershipStatement ?? "Not specified"} />
        <Meta label="Governance status" value={report.status.replaceAll("_", " ")} />
        <Meta label="Author" value={report.author.name ?? "Assigned author"} />
        <Meta label="Approved by" value={report.approvedBy?.name ?? "Pending independent approval"} />
        <Meta label="Evidence snapshot" value={report.snapshotGeneratedAt.toLocaleString()} />
        <Meta label="Supporting analyses" value={report.analysisIds.length.toString()} />
      </div>
      <div className="mt-10 space-y-10">
        <Section title="Executive Summary" value={report.executiveSummary} />
        <Section title="Background and Context" value={report.background} />
        <Section title="Research Purpose" value={report.project.purpose} />
        <Section title="Research Questions" value={report.project.researchQuestions} />
        <Section title="Methodology" value={report.methodology} />
        <Section title="Findings" value={report.findings} />
        <Section title="Discussion and Interpretation" value={report.discussion} />
        <Section title="Conclusions" value={report.conclusions} />
        <Section title="Recommendations" value={report.recommendations} />
        <Section title="Limitations" value={report.limitations} />
        <section className="break-before-page">
          <h2 className="border-b border-slate-300 pb-2 text-2xl font-bold">
            Appendix: Approved Analytical Evidence
          </h2>
          <div className="mt-5 space-y-7">
            {analyses.map((analysis) => (
              <div key={analysis.id} className="break-inside-avoid rounded-xl border border-slate-300 p-5">
                <h3 className="text-lg font-bold">{analysis.title}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {analysis.method.replaceAll("_", " ")} · Version {analysis.version} ·
                  {" "}{analysis.population} observations · {analysis.collection.name}
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
                  {researchResultLines(analysis.result, 12).map((line) => (
                    <div key={line.label} className="border-t border-slate-200 pt-2">
                      <dt className="text-slate-500">{line.label}</dt>
                      <dd className="font-medium">{line.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>
      </div>
      <footer className="mt-14 border-t border-slate-300 pt-5 text-xs text-slate-500">
        Generated from a frozen Senzilytics evidence snapshot. Status: {report.status}.
        {report.publishedBy?.name ? ` Published by ${report.publishedBy.name}.` : ""}
      </footer>
    </main>
  );
}

function Section({ title, value }: { title: string; value: string | null }) {
  if (!value) return null;
  return (
    <section className="break-inside-avoid">
      <h2 className="border-b border-slate-300 pb-2 text-2xl font-bold">{title}</h2>
      <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-700">{value}</p>
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
