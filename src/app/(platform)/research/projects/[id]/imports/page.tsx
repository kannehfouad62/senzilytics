import { PermissionKey, ResearchDatasetVersionStatus } from "@prisma/client";
import { ArrowLeft, DatabaseZap } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResearchImportUpload } from "@/features/research/research-import-upload";
import { ResearchTransformationForm } from "@/features/research/research-transformation-form";
import {
  DatasetVersionStatusControl,
  MaterializeDatasetVersion,
} from "@/features/research/research-dataset-version-controls";
import {
  FinalizeDictionary,
  ResearchVariableEditor,
} from "@/features/research/research-variable-editor";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export default async function ResearchImportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_RESEARCH);
  const [{ id }, { organizationId, user }, permissions] = await Promise.all([
    params,
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const project = await prisma.researchProject.findFirst({
    where: { id, organizationId },
    include: {
      importedDatasets: {
        include: {
          variables: { orderBy: { position: "asc" } },
          transformations: {
            include: { createdBy: { select: { name: true } } },
            orderBy: { position: "asc" },
          },
          importedBy: { select: { name: true } },
          versions: {
            include: {
              createdBy: { select: { name: true } },
              approvedBy: { select: { name: true } },
            },
            orderBy: { version: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!project) notFound();
  return (
    <div>
      <Link
        href={`/research/projects/${id}`}
        className="inline-flex items-center gap-2 text-sm text-slate-400"
      >
        <ArrowLeft size={16} />
        {project.reference}
      </Link>
      <div className="mt-6">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <DatabaseZap size={17} />
          Governed Data Intake
        </p>
        <h1 className="mt-2 text-4xl font-bold">Data Import & Dictionary</h1>
        <p className="mt-2 max-w-3xl text-slate-400">
          Preserve source evidence, inspect a safe preview, and establish
          variable metadata for {project.title}.
        </p>
      </div>
      {permissions.includes(PermissionKey.MANAGE_RESEARCH_DATASETS) && (
        <div className="mt-8">
          <ResearchImportUpload projectId={id} />
        </div>
      )}
      <div className="mt-8 space-y-5">
        {project.importedDatasets.map((dataset) => (
          <details
            key={dataset.id}
            className="rounded-3xl border border-white/10 bg-white/[.04] p-6"
          >
            <summary className="cursor-pointer">
              <span className="font-semibold">{dataset.name}</span>
              <span className="ml-3 text-xs text-cyan-300">
                {dataset.status}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {dataset.rowCount.toLocaleString()} rows · {dataset.columnCount}{" "}
                columns · {dataset.sourceFileName} · {dataset.importedBy.name}
              </span>
            </summary>
            {dataset.profileErrors.map((error) => (
              <p key={error} className="mt-4 text-sm text-red-300">
                {error}
              </p>
            ))}
            {!!dataset.variables.length && (
              <div className="mt-5">
                {permissions.includes(
                  PermissionKey.MANAGE_RESEARCH_DATASETS,
                ) ? (
                  dataset.variables.map((variable) => (
                    <ResearchVariableEditor
                      key={variable.id}
                      variable={variable}
                    />
                  ))
                ) : (
                  <div className="grid gap-2">
                    {dataset.variables.map((variable) => (
                      <p key={variable.id} className="text-sm">
                        {variable.label} · {variable.dataType} ·{" "}
                        {variable.measurementLevel}
                      </p>
                    ))}
                  </div>
                )}
                {dataset.status === "PROFILED" &&
                  permissions.includes(
                    PermissionKey.MANAGE_RESEARCH_DATASETS,
                  ) && <FinalizeDictionary datasetId={dataset.id} />}
                {dataset.status === "MAPPED" &&
                  permissions.includes(
                    PermissionKey.MANAGE_RESEARCH_DATASETS,
                  ) && (
                    <>
                      <ResearchTransformationForm datasetId={dataset.id} variables={dataset.variables}/>
                      <MaterializeDatasetVersion datasetId={dataset.id}/>
                    </>
                  )}
                {!!dataset.transformations.length && (
                  <section className="mt-5 rounded-2xl border border-white/10 p-5">
                    <h3 className="font-semibold">Transformation lineage</h3>
                    <div className="mt-3 divide-y divide-white/10">
                      {dataset.transformations.map((step) => (
                        <div key={step.id} className="grid gap-2 py-3 text-sm md:grid-cols-[auto_1fr_1fr]">
                          <span className="text-cyan-300">#{step.position}</span>
                          <div>
                            <strong>{step.type.replaceAll("_", " ")}</strong>
                            <p className="text-xs text-slate-500">
                              {step.sourceVariableKey ?? "Dataset"}
                              {step.outputVariableKey
                                ? ` → ${step.outputVariableKey}`
                                : ""}
                            </p>
                          </div>
                          <div className="text-xs text-slate-400">
                            <p>{step.rationale}</p>
                            <p className="mt-1 text-slate-600">
                              {step.createdBy.name} · {step.createdAt.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {!!dataset.versions.length && (
                  <section className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/[.03] p-5">
                    <h3 className="font-semibold">Analysis-ready versions</h3>
                    <p className="mt-1 text-xs text-slate-500">Immutable transformation and quality snapshots with independent approval.</p>
                    <div className="mt-3 space-y-3">
                      {dataset.versions.map((version) => (
                        <div key={version.id} className="rounded-xl border border-white/10 p-4 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div><strong>Version {version.version}</strong><span className="ml-2 text-xs text-cyan-300">{version.status.replaceAll("_", " ")}</span><p className="mt-1 text-xs text-slate-500">{version.rowCount.toLocaleString()} rows · {version.columnCount} columns · {version.createdBy.name} · {version.createdAt.toLocaleString()}</p></div>
                            {(version.status === ResearchDatasetVersionStatus.APPROVED || version.status === ResearchDatasetVersionStatus.SUPERSEDED) && permissions.includes(PermissionKey.EXPORT_RESEARCH_OUTPUTS) && <a href={`/api/research/imports/versions/${version.id}/download`} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs">Download CSV</a>}
                            {version.status === ResearchDatasetVersionStatus.APPROVED && permissions.includes(PermissionKey.RUN_RESEARCH_ANALYSIS) && <Link href={`/research/imported-datasets/${version.id}`} className="rounded-lg bg-violet-300 px-3 py-1.5 text-xs font-semibold text-slate-950">Open Analysis Studio</Link>}
                          </div>
                          <p className="mt-2 text-xs text-slate-400">Quality snapshot: {JSON.stringify(version.qualitySnapshot)}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {version.status === ResearchDatasetVersionStatus.DRAFT && permissions.includes(PermissionKey.MANAGE_RESEARCH_DATASETS) && <DatasetVersionStatusControl versionId={version.id} target={ResearchDatasetVersionStatus.UNDER_REVIEW} label="Submit for review"/>}
                            {version.status === ResearchDatasetVersionStatus.UNDER_REVIEW && permissions.includes(PermissionKey.MANAGE_RESEARCH_DATASETS) && <DatasetVersionStatusControl versionId={version.id} target={ResearchDatasetVersionStatus.DRAFT} label="Return to draft"/>}
                            {version.status === ResearchDatasetVersionStatus.UNDER_REVIEW && version.createdById !== user.id && permissions.includes(PermissionKey.APPROVE_RESEARCH_OUTPUTS) && <DatasetVersionStatusControl versionId={version.id} target={ResearchDatasetVersionStatus.APPROVED} label="Approve version"/>}
                          </div>
                          {version.approvedBy && <p className="mt-2 text-xs text-emerald-300">Approved independently by {version.approvedBy.name}</p>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </details>
        ))}
        {!project.importedDatasets.length && (
          <p className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-slate-500">
            No external datasets imported.
          </p>
        )}
      </div>
    </div>
  );
}
