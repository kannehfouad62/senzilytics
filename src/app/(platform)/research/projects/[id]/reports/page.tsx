import { PermissionKey, ResearchAnalysisStatus } from "@prisma/client";
import { ArrowLeft, ArrowRight, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ResearchReportForm } from "@/features/research/research-report-forms";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function ResearchReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_RESEARCH);
  const [{ id }, { organizationId }, permissions] = await Promise.all([
    params,
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const project = await prisma.researchProject.findFirst({
    where: { id, organizationId },
    include: {
      reports: {
        include: {
          author: { select: { name: true } },
          approvedBy: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
      collectionWaves: {
        include: {
          analyses: {
            where: { status: ResearchAnalysisStatus.APPROVED },
            select: { id: true, title: true, method: true },
            orderBy: { approvedAt: "desc" },
          },
        },
      },
      importedDatasets:{include:{versions:{where:{status:"APPROVED"},include:{analyses:{where:{status:ResearchAnalysisStatus.APPROVED},select:{id:true,title:true,method:true},orderBy:{approvedAt:"desc"}}}}}},
    },
  });
  if (!project) notFound();
  const analyses = project.collectionWaves.flatMap((collection) =>
    collection.analyses.map((analysis) => ({
      ...analysis,
      collectionName: collection.name,
    })),
  ).concat(project.importedDatasets.flatMap(dataset=>dataset.versions.flatMap(version=>version.analyses.map(analysis=>({...analysis,collectionName:`${dataset.name} · imported v${version.version}`})))));
  const canCreate = permissions.includes(PermissionKey.RUN_RESEARCH_ANALYSIS);

  return (
    <div>
      <Link
        href={`/research/projects/${project.id}`}
        className="inline-flex items-center gap-2 text-sm text-slate-400"
      >
        <ArrowLeft size={16} />
        {project.reference}
      </Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <FileText size={17} />
            Governed Research Publishing
          </p>
          <h1 className="mt-2 text-4xl font-bold">Research Report Builder</h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Create versioned, independently reviewed reports for {project.title}.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[.04] px-5 py-4">
          <p className="text-xs text-slate-500">Approved evidence available</p>
          <p className="mt-1 text-2xl font-bold">{analyses.length}</p>
        </div>
      </div>

      {canCreate && (
        <div className="mt-8">
          <ResearchReportForm projectId={project.id} analyses={analyses} />
        </div>
      )}

      <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[.04]">
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <div>
            <h2 className="text-xl font-semibold">Controlled report register</h2>
            <p className="mt-1 text-sm text-slate-500">
              Draft, review, approval, publication, and archival remain auditable.
            </p>
          </div>
          <ShieldCheck className="text-cyan-300" size={20} />
        </div>
        <div className="divide-y divide-white/10">
          {project.reports.map((report) => (
            <Link
              key={report.id}
              href={`/research/reports/${report.id}`}
              className="grid gap-4 p-5 hover:bg-white/[.03] md:grid-cols-[1.4fr_.6fr_.8fr_auto] md:items-center"
            >
              <div>
                <strong>{report.title}</strong>
                <p className="mt-1 text-xs text-slate-500">
                  {report.reference} · v{report.version}
                </p>
              </div>
              <span className="text-sm text-cyan-200">
                {report.status.replaceAll("_", " ")}
              </span>
              <span className="text-xs text-slate-500">
                Author {report.author.name ?? "Assigned author"}
                {report.approvedBy?.name ? ` · Approved by ${report.approvedBy.name}` : ""}
              </span>
              <ArrowRight size={18} className="text-cyan-300" />
            </Link>
          ))}
          {!project.reports.length && (
            <p className="p-12 text-center text-sm text-slate-500">
              No governed reports have been created for this project.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
