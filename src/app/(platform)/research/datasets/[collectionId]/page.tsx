import Link from "next/link";
import { notFound } from "next/navigation";
import { PermissionKey, ResearchAnalysisStatus } from "@prisma/client";

import { AnalysisGovernanceControl } from "@/features/research/analysis-governance";
import { ResearchAnalysisStudio } from "@/features/research/analysis-studio";
import { ResearchModelingLab } from "@/features/research/research-modeling-lab";
import {
  DatasetStatusControl,
  ResponseQualityControl,
} from "@/features/research/dataset-controls";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getResearchDataset } from "@/modules/research/research-dataset.service";

export default async function ResearchDatasetPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  await requirePermission(PermissionKey.RUN_RESEARCH_ANALYSIS);
  const [{ collectionId }, { organizationId, user }, permissions] =
    await Promise.all([
      params,
      getCurrentUserTenant(),
      getCurrentUserPermissions(),
    ]);
  const dataset = await getResearchDataset(organizationId, collectionId);
  if (!dataset) notFound();
  const {
    collection,
    variables,
    rows,
    analysisRows,
    responseRows,
    qualityIssues,
  } = dataset;
  const canManage = permissions.includes(
    PermissionKey.MANAGE_RESEARCH_DATASETS,
  );
  const canApprove = permissions.includes(
    PermissionKey.APPROVE_RESEARCH_OUTPUTS,
  );
  const integrityReviews = responseRows.filter(
    (item) =>
      item.source === "PUBLIC" && item.response.integrityStatus === "REVIEW",
  ).length;
  return (
    <div>
      <Link href="/research/datasets" className="text-sm text-cyan-300">
        ← Research Datasets
      </Link>
      <div className="mt-5 flex flex-wrap justify-between gap-5">
        <div>
          <p className="text-sm text-cyan-300">
            {collection.project.reference} · {collection.questionnaire.name}
          </p>
          <h1 className="mt-2 text-4xl font-bold">{collection.name}</h1>
          <p className="mt-2 text-slate-400">
            {rows.length} completed · {analysisRows.length} included · Published
            questionnaire v{collection.formVersion.version}
          </p>
        </div>
        {canManage && (
          <DatasetStatusControl
            collectionId={collection.id}
            status={collection.datasetStatus}
            canApprove={canApprove}
            canLock={collection.status === "CLOSED"}
          />
        )}
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-5">
        <Metric label="Dataset status" value={collection.datasetStatus} />
        <Metric label="Variables" value={variables.length} />
        <Metric
          label="Auto-detected issues"
          value={[...qualityIssues.values()].reduce(
            (sum, list) => sum + list.length,
            0,
          )}
        />
        <Metric label="Saved analyses" value={collection.analyses.length} />
        <Metric label="Integrity review" value={integrityReviews} />
      </div>
      <div className="mt-9">
        <ResearchAnalysisStudio
          variables={variables}
          rows={analysisRows}
          collectionId={collection.id}
        />
      </div>
      <ResearchModelingLab
        variables={variables}
        rows={analysisRows}
        collectionId={collection.id}
      />

      <section className="mt-9 rounded-3xl border border-white/10 bg-white/[.04] p-6">
        <h2 className="text-xl font-semibold">Saved analysis register</h2>
        <p className="mt-1 text-sm text-slate-400">
          Reproducible specifications and result snapshots governed
          independently from the live exploratory workspace.
        </p>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {collection.analyses.map((analysis) => {
            const next: ResearchAnalysisStatus[] = [];
            if (
              analysis.status === ResearchAnalysisStatus.DRAFT &&
              (analysis.analystId === user.id || canManage) &&
              ["LOCKED", "APPROVED"].includes(collection.datasetStatus)
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
              analysis.analystId !== user.id &&
              collection.datasetStatus === "APPROVED"
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
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-cyan-300">
                      {analysis.method.replaceAll("_", " ")} · v
                      {analysis.version}
                    </p>
                    <h3 className="mt-1 font-semibold">{analysis.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {analysis.datasetResponseCount} responses · Analyst:{" "}
                      {analysis.analyst.name ?? "Assigned analyst"}
                    </p>
                  </div>
                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs">
                    {analysis.status.replaceAll("_", " ")}
                  </span>
                </div>
                {analysis.hypothesis && (
                  <p className="mt-3 text-sm text-slate-300">
                    <span className="text-slate-500">Hypothesis:</span>{" "}
                    {analysis.hypothesis}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
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
          {!collection.analyses.length && (
            <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
              No saved analysis specifications yet.
            </p>
          )}
        </div>
      </section>

      {canManage && (
        <section className="mt-9 rounded-3xl border border-white/10 bg-white/[.04] p-6">
          <h2 className="text-xl font-semibold">Response quality review</h2>
          <p className="mt-1 text-sm text-slate-400">
            Automated signals support human review and never exclude assigned or
            public responses automatically.
          </p>
          <div className="mt-5 space-y-5">
            {responseRows.map((item) => (
              <div
                key={`${item.source}-${item.response.id}`}
                className="rounded-2xl border border-white/5 bg-slate-950/35 p-4"
              >
                <div className="mb-3 flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      Response {item.response.id.slice(-8).toUpperCase()}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.source === "PUBLIC"
                        ? "Public link"
                        : "Assigned respondent"}{" "}
                      · {new Date(item.row.submittedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right text-xs text-amber-300">
                    {item.source === "PUBLIC" &&
                      item.response.integrityStatus === "REVIEW" && (
                        <p>
                          Integrity review ·{" "}
                          {item.response.completionSeconds ?? "—"}s
                        </p>
                      )}
                    {item.source === "PUBLIC" &&
                      Array.isArray(item.response.integrityFlags) &&
                      item.response.integrityFlags.map((flag) => (
                        <p key={String(flag)}>
                          {String(flag).replaceAll("_", " ")}
                        </p>
                      ))}
                    {(qualityIssues.get(item.response.id) ?? []).map(
                      (issue) => (
                        <p key={issue}>{issue}</p>
                      ),
                    )}
                  </div>
                </div>
                <ResponseQualityControl
                  assignmentId={item.response.id}
                  responseSource={item.source}
                  disposition={item.response.disposition}
                  notes={item.response.qualityNotes}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}
