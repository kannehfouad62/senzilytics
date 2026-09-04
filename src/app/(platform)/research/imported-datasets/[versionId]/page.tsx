import { PermissionKey, ResearchAnalysisStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalysisGovernanceControl } from "@/features/research/analysis-governance";
import { ResearchAnalysisStudio } from "@/features/research/analysis-studio";
import { ResearchModelingLab } from "@/features/research/research-modeling-lab";
import { ResearchDataQualityWorkbench } from "@/features/research/research-data-quality-workbench";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getImportedAnalysisDataset } from "@/modules/research/imported-analysis-dataset.service";
import { buildResearchQualityProfile } from "@/modules/research/research-quality-profile";

export const dynamic = "force-dynamic";
export default async function ImportedDatasetAnalysisPage({
  params,
}: {
  params: Promise<{ versionId: string }>;
}) {
  await requirePermission(PermissionKey.RUN_RESEARCH_ANALYSIS);
  const [{ versionId }, { organizationId, user }, permissions] =
    await Promise.all([
      params,
      getCurrentUserTenant(),
      getCurrentUserPermissions(),
    ]);
  const dataset = await getImportedAnalysisDataset(organizationId, versionId);
  if (!dataset) notFound();
  const { version, variables, rows } = dataset,
    canManage = permissions.includes(PermissionKey.MANAGE_RESEARCH_DATASETS),
    canApprove = permissions.includes(PermissionKey.APPROVE_RESEARCH_OUTPUTS);
  const qualityProfile=buildResearchQualityProfile(rows,variables);
  return (
    <div>
      <Link
        href={`/research/projects/${version.dataset.projectId}/imports`}
        className="text-sm text-cyan-300"
      >
        ← Data Import & Dictionary
      </Link>
      <div className="mt-5">
        <p className="text-sm text-cyan-300">
          {version.dataset.project.reference} ·{" "}
          {version.dataset.project.client?.name ?? "Internal research"}
        </p>
        <h1 className="mt-2 text-4xl font-bold">
          {version.dataset.name} · Version {version.version}
        </h1>
        <p className="mt-2 text-slate-400">
          Approved immutable dataset · {rows.length.toLocaleString()} rows ·{" "}
          {variables.length} variables
        </p>
      </div>
      <ResearchDataQualityWorkbench profile={qualityProfile} versionId={version.id} canExport={permissions.includes(PermissionKey.EXPORT_RESEARCH_OUTPUTS)}/>
      <div className="mt-9">
        <ResearchAnalysisStudio
          variables={variables}
          rows={rows}
          datasetVersionId={version.id}
        />
      </div>
      <ResearchModelingLab
        variables={variables}
        rows={rows}
        datasetVersionId={version.id}
      />
      <section className="mt-9 rounded-3xl border border-white/10 bg-white/[.04] p-6">
        <h2 className="text-xl font-semibold">Saved analysis register</h2>
        <p className="mt-1 text-sm text-slate-400">
          Every output is reproducibly tied to imported dataset version{" "}
          {version.version}.
        </p>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {version.analyses.map((analysis) => {
            const next: ResearchAnalysisStatus[] = [];
            if (
              analysis.status === ResearchAnalysisStatus.DRAFT &&
              (analysis.analystId === user.id || canManage)
            )
              next.push(ResearchAnalysisStatus.UNDER_REVIEW);
            if (
              analysis.status === ResearchAnalysisStatus.UNDER_REVIEW &&
              canManage
            )
              next.push(ResearchAnalysisStatus.DRAFT);
            if (
              analysis.status === ResearchAnalysisStatus.UNDER_REVIEW &&
              canApprove &&
              analysis.analystId !== user.id
            )
              next.push(ResearchAnalysisStatus.APPROVED);
            if (
              analysis.status === ResearchAnalysisStatus.APPROVED &&
              canManage
            )
              next.push(ResearchAnalysisStatus.ARCHIVED);
            return (
              <article
                key={analysis.id}
                className="rounded-2xl border border-white/10 bg-slate-950/40 p-5"
              >
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="text-xs text-cyan-300">
                      {analysis.method.replaceAll("_", " ")} · v
                      {analysis.version}
                    </p>
                    <h3 className="mt-1 font-semibold">{analysis.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {analysis.datasetResponseCount} rows · Analyst:{" "}
                      {analysis.analyst.name ?? "Assigned analyst"}
                    </p>
                  </div>
                  <span className="text-xs">
                    {analysis.status.replaceAll("_", " ")}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <a
                    href={`/api/research/analyses/${analysis.id}/workbook`}
                    className="rounded-lg border border-emerald-400/20 px-3 py-1.5 text-xs text-emerald-300"
                  >
                    Excel output
                  </a>
                  <a
                    href={`/api/research/analyses/${analysis.id}/presentation`}
                    className="rounded-lg border border-violet-400/20 px-3 py-1.5 text-xs text-violet-300"
                  >
                    PowerPoint output
                  </a>
                </div>
                <div className="mt-4">
                  <AnalysisGovernanceControl
                    analysisId={analysis.id}
                    nextStatuses={next}
                  />
                </div>
              </article>
            );
          })}
          {!version.analyses.length && (
            <p className="rounded-2xl border border-dashed border-white/10 p-8 text-sm text-slate-500">
              No saved analyses yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
