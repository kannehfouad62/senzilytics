import { PermissionKey, ResearchSamplingExecutionStatus, UserRole } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ResearchFieldworkCharts } from "@/features/research/research-fieldwork-charts";
import { BackcheckReviewForm, BackcheckSampleForm } from "@/features/research/sampling-fieldwork-forms";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { buildFieldworkAnalytics } from "@/modules/research/research-fieldwork-analytics";
import { summarizeFieldworkAssurance } from "@/modules/research/research-fieldwork-assurance";

export const dynamic = "force-dynamic";

export default async function ResearchFieldworkDashboard({
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
    select: {
      id: true,
      reference: true,
      title: true,
      samplingExecutions: {
        where: {
          status: {
            in: [
              ResearchSamplingExecutionStatus.ACTIVE,
              ResearchSamplingExecutionStatus.CLOSED,
            ],
          },
        },
        orderBy: { version: "desc" },
        take: 1,
        include: {
          samplingDesign: true,
          samplingFrame: true,
          units: { include: { assignedTo: { select: { name: true } }, fieldworkResponse: { include: { enumerator: { select: { name: true } }, backcheckedBy: { select: { name: true } }, backcheckAssignedTo: { select: { name: true } }, collection: { select: { name: true } } } } } },
        },
      },
    },
  });
  if (!project) notFound();
  const execution = project.samplingExecutions[0];
  if (!execution) return <Empty project={project} />;
  const analytics = buildFieldworkAnalytics(execution.units);
  const responses = execution.units.flatMap((unit) => unit.fieldworkResponse ? [unit.fieldworkResponse] : []);
  const assurance = summarizeFieldworkAssurance(responses);
  const canManage = permissions.includes(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const reviewerRoles = canManage ? await prisma.rolePermission.findMany({ where: { permission: PermissionKey.MANAGE_RESEARCH_DATASETS }, select: { role: true } }) : [];
  const reviewers = canManage ? await prisma.user.findMany({ where: { organizationId, isActive: true, OR: [{ role: UserRole.SUPER_ADMIN }, { role: { in: reviewerRoles.map((item) => item.role) } }] }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  return (
    <div>
      <Link href={`/research/projects/${id}`} className="text-sm text-cyan-300">
        ← {project.reference}
      </Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-cyan-300">
            Operational research intelligence
          </p>
          <h1 className="mt-2 text-4xl font-bold">Fieldwork Command Center</h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Live workload, response, nonresponse and sampling-segment
            performance for {project.title}. Metrics use the complete governed
            selection register.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/research/sampling-executions/${execution.id}/fieldwork-workbook`}
            className="rounded-xl border border-emerald-400/20 px-4 py-2 text-sm text-emerald-300"
          >
            Excel operations workbook
          </a>
          <a
            href={`/api/research/sampling-executions/${execution.id}/fieldwork-presentation`}
            className="rounded-xl border border-violet-400/20 px-4 py-2 text-sm text-violet-300"
          >
            PowerPoint briefing
          </a>
        </div>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Selected primary" value={analytics.selected} />
        <Metric label="Completed" value={analytics.completed} />
        <Metric
          label="Response rate"
          value={`${analytics.responseRate.toFixed(1)}%`}
        />
        <Metric
          label="Cooperation rate"
          value={`${analytics.cooperationRate.toFixed(1)}%`}
        />
        <Metric
          label="Overdue"
          value={analytics.overdue}
          alert={analytics.overdue > 0}
        />
        <Metric
          label="Unassigned"
          value={analytics.unassigned}
          alert={analytics.unassigned > 0}
        />
        <Metric label="Refused" value={analytics.refused} />
        <Metric
          label="Average attempts"
          value={analytics.averageAttempts.toFixed(1)}
        />
      </div>
      <ResearchFieldworkCharts
        dispositions={analytics.dispositions}
        researchers={analytics.researchers}
        strata={analytics.strata}
        clusters={analytics.clusters}
      />
      <section className="mt-6 rounded-3xl border border-cyan-400/15 bg-cyan-400/[.035] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-sm text-cyan-300">Independent quality control</p><h2 className="mt-1 text-xl font-semibold">Fieldwork assurance</h2><p className="mt-2 max-w-3xl text-sm text-slate-400">Select a deterministic percentage of synchronized interviews for independent verification. Enumerators cannot review their own work, and every decision retains evidence and audit lineage.</p></div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">Reviewer: {user.name}</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Responses" value={assurance.total} />
          <Metric label="Selected" value={assurance.selected} />
          <Metric label="Pending / recontact" value={assurance.pending} alert={assurance.overdue > 0} />
          <Metric label="Verified" value={assurance.approved} />
          <Metric label="Rejected" value={assurance.rejected} alert={assurance.rejected > 0} />
          <Metric label="High-risk signals" value={assurance.highRisk} alert={assurance.highRisk > 0} />
          <Metric label="Overdue reviews" value={assurance.overdue} alert={assurance.overdue > 0} />
          <Metric label="GPS captured" value={`${assurance.locationCaptured}/${assurance.total}`} />
        </div>
        {canManage && assurance.total ? <BackcheckSampleForm executionId={execution.id} reviewers={reviewers} /> : null}
      </section>
      <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[.035]">
        <div className="border-b border-white/10 p-6"><h2 className="text-xl font-semibold">Interview integrity register</h2><p className="mt-1 text-sm text-slate-400">Operational signals support review prioritization; they do not automatically invalidate a response.</p></div>
        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-white/[.03] text-xs text-slate-400"><tr><th className="px-4 py-3">Unit / enumerator</th><th className="px-4 py-3">Interview</th><th className="px-4 py-3">Integrity</th><th className="px-4 py-3">Back-check</th>{canManage ? <th className="px-4 py-3">Review</th> : null}</tr></thead><tbody className="divide-y divide-white/10">{assurance.assessed.map(({ response, integrity }) => <tr key={response.id} className="align-top"><td className="px-4 py-4"><p className="font-medium">{execution.units.find((unit) => unit.fieldworkResponse?.id === response.id)?.unitReference}</p><p className="text-xs text-slate-500">{response.enumerator.name} · {response.collection.name}</p></td><td className="px-4 py-4"><p>{integrity.durationMinutes.toFixed(1)} min</p><p className="text-xs text-slate-500">Sync delay {integrity.syncDelayHours.toFixed(1)}h</p></td><td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs ${integrity.risk === "HIGH" ? "bg-red-400/10 text-red-200" : integrity.risk === "MEDIUM" ? "bg-amber-400/10 text-amber-200" : "bg-emerald-400/10 text-emerald-200"}`}>{integrity.risk}</span><p className="mt-2 max-w-xs text-xs text-slate-500">{integrity.signals.length ? integrity.signals.map((item) => item.replaceAll("_", " ")).join(" · ") : "No automated signals"}</p></td><td className="px-4 py-4"><p>{response.backcheckRequired ? response.backcheckStatus.replaceAll("_", " ") : "NOT SELECTED"}</p><p className="text-xs text-slate-500">{response.backcheckAssignedTo?.name ?? "—"}{response.backcheckDueAt ? ` · Due ${response.backcheckDueAt.toLocaleDateString("en-US")}` : ""}</p></td>{canManage ? <td className="px-4 py-4">{response.backcheckRequired && response.backcheckAssignedToId === user.id && (response.backcheckStatus === "PENDING" || response.backcheckStatus === "RECONTACT_REQUIRED") && response.enumeratorId !== user.id ? <BackcheckReviewForm responseId={response.id} /> : <span className="text-xs text-slate-500">{response.backcheckRequired && response.backcheckAssignedToId !== user.id ? `Assigned to ${response.backcheckAssignedTo?.name ?? "another reviewer"}` : response.enumeratorId === user.id && response.backcheckRequired ? "Independent reviewer required" : "No action"}</span>}</td> : null}</tr>)}</tbody></table></div>
      </section>
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[.035] p-6">
        <h2 className="text-xl font-semibold">Governance and interpretation</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Metric
            label="Execution"
            value={`v${execution.version} · ${execution.status}`}
          />
          <Metric
            label="Sampling method"
            value={execution.samplingDesign.type.replaceAll("_", " ")}
          />
          <Metric
            label="Validated frame"
            value={`${execution.samplingFrame.name} · ${execution.samplingFrame.rowCount.toLocaleString()} units`}
          />
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          Response rate excludes ineligible units and includes completed,
          refused and withdrawn eligible cases in its resolved denominator.
          Cooperation rate compares completed responses with completed plus
          refusals. These operational indicators do not replace the approved
          sampling design or inferential weighting.
        </p>
      </section>
    </div>
  );
}

function Empty({
  project,
}: {
  project: { id: string; reference: string; title: string };
}) {
  return (
    <div>
      <Link
        href={`/research/projects/${project.id}`}
        className="text-sm text-cyan-300"
      >
        ← {project.reference}
      </Link>
      <div className="mt-8 rounded-3xl border border-dashed border-white/10 p-12 text-center">
        <h1 className="text-2xl font-semibold">Fieldwork is not active</h1>
        <p className="mt-2 text-slate-400">
          Approve and activate a sampling execution before opening the command
          center.
        </p>
        <Link
          href={`/research/projects/${project.id}/sampling-design`}
          className="mt-5 inline-block rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
        >
          Open sampling register
        </Link>
      </div>
    </div>
  );
}
function Metric({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${alert ? "border-red-400/20 bg-red-400/[.05]" : "border-white/10 bg-white/[.04]"}`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold ${alert ? "text-red-200" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
