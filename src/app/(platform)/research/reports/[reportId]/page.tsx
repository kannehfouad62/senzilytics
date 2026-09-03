import { PermissionKey, ResearchReportStatus } from "@prisma/client";
import { ArrowLeft, FileDown, Presentation, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ResearchReportDraftEditor,
  ResearchReportGovernance,
} from "@/features/research/research-report-forms";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function ResearchReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_RESEARCH);
  const [{ reportId }, { organizationId, user }, permissions] = await Promise.all([
    params,
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const report = await prisma.researchReport.findFirst({
    where: { id: reportId, organizationId },
    include: {
      project: { include: { client: true } },
      author: { select: { name: true } },
      reviewer: { select: { name: true } },
      approvedBy: { select: { name: true } },
      publishedBy: { select: { name: true } },
    },
  });
  if (!report) notFound();

  const canManage = permissions.includes(PermissionKey.MANAGE_RESEARCH_PROJECTS);
  const canApprove = permissions.includes(PermissionKey.APPROVE_RESEARCH_OUTPUTS);
  const canExport = permissions.includes(PermissionKey.EXPORT_RESEARCH_OUTPUTS);
  const statuses: ResearchReportStatus[] = [];
  if (
    report.status === ResearchReportStatus.DRAFT &&
    (report.authorId === user.id || canManage)
  ) {
    statuses.push(ResearchReportStatus.UNDER_REVIEW);
  }
  if (report.status === ResearchReportStatus.UNDER_REVIEW && canManage) {
    statuses.push(ResearchReportStatus.DRAFT);
  }
  if (
    report.status === ResearchReportStatus.UNDER_REVIEW &&
    canApprove &&
    report.authorId !== user.id
  ) {
    statuses.push(ResearchReportStatus.APPROVED);
  }
  if (report.status === ResearchReportStatus.APPROVED && canManage) {
    statuses.push(ResearchReportStatus.PUBLISHED);
  }
  if (report.status === ResearchReportStatus.PUBLISHED && canManage) {
    statuses.push(ResearchReportStatus.ARCHIVED);
  }

  return (
    <div>
      <Link
        href={`/research/projects/${report.projectId}/reports`}
        className="inline-flex items-center gap-2 text-sm text-slate-400"
      >
        <ArrowLeft size={16} />
        Report register
      </Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm text-cyan-300">
            {report.reference} · Version {report.version}
          </p>
          <h1 className="mt-2 text-4xl font-bold">{report.title}</h1>
          <p className="mt-2 text-slate-400">
            {report.project.reference} · {report.project.client?.name ?? "Internal research"}
          </p>
        </div>
        <span className="rounded-full bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
          {report.status.replaceAll("_", " ")}
        </span>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <ResearchReportGovernance reportId={report.id} statuses={statuses} />
        {canExport && (
          <>
            <Link
              href={`/research/reports/${report.id}/print`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm"
            >
              <FileDown size={16} />
              Print / Save PDF
            </Link>
            <a
              href={`/api/research/reports/${report.id}/presentation`}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-400/20 px-4 py-2 text-sm text-violet-200"
            >
              <Presentation size={16} />
              PowerPoint
            </a>
          </>
        )}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_.6fr]">
        <article className="space-y-7 rounded-3xl border border-white/10 bg-white/[.04] p-7">
          <ReportSection title="Executive summary" value={report.executiveSummary} />
          <ReportSection title="Background" value={report.background} />
          <ReportSection title="Methodology" value={report.methodology} />
          <ReportSection title="Findings" value={report.findings} />
          <ReportSection title="Discussion" value={report.discussion} />
          <ReportSection title="Conclusions" value={report.conclusions} />
          <ReportSection title="Recommendations" value={report.recommendations} />
          <ReportSection title="Limitations" value={report.limitations} />
        </article>
        <aside className="h-fit rounded-3xl border border-white/10 bg-white/[.04] p-6">
          <h2 className="flex items-center gap-2 font-semibold">
            <ShieldCheck size={18} className="text-cyan-300" />
            Governance record
          </h2>
          <Meta label="Author" value={report.author.name} />
          <Meta label="Reviewer" value={report.reviewer?.name} />
          <Meta label="Approver" value={report.approvedBy?.name} />
          <Meta label="Publisher" value={report.publishedBy?.name} />
          <Meta label="Frozen analyses" value={report.analysisIds.length.toString()} />
          <Meta label="Snapshot" value={report.snapshotGeneratedAt.toLocaleString()} />
        </aside>
      </div>
      {report.status === ResearchReportStatus.DRAFT &&
        (report.authorId === user.id || canManage) && (
          <ResearchReportDraftEditor report={report} />
        )}
    </div>
  );
}

function ReportSection({ title, value }: { title: string; value: string | null }) {
  if (!value) return null;
  return (
    <section>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-300">{value}</p>
    </section>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm">{value ?? "Pending"}</p>
    </div>
  );
}
