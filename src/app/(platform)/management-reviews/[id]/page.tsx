import {
  AgendaItemForm,
  AgendaOutcomeForm,
  AttendanceForm,
  AttendeeForm,
  DecisionForm,
  DecisionGovernanceForms,
  ExecutiveReviewLifecycleControls,
  ReviewCompletionForm,
} from "@/features/executive-review/executive-review-forms";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { nextExecutiveReviewDate } from "@/modules/executive-review/executive-review-lifecycle";
import { getExecutiveReviewService } from "@/modules/executive-review/executive-review.service";
import {
  ExecutiveReviewStatus,
  PermissionKey,
  Prisma,
} from "@prisma/client";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

const structurallyEditable = new Set<ExecutiveReviewStatus>([
  ExecutiveReviewStatus.DRAFT,
  ExecutiveReviewStatus.SCHEDULED,
]);
const attendanceEditable = new Set<ExecutiveReviewStatus>([
  ExecutiveReviewStatus.SCHEDULED,
  ExecutiveReviewStatus.IN_PROGRESS,
]);
const decisionGovernanceEditable = new Set<ExecutiveReviewStatus>([
  ExecutiveReviewStatus.IN_PROGRESS,
  ExecutiveReviewStatus.COMPLETED,
]);

export default async function ManagementReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_EXECUTIVE_REVIEWS);
  const [{ id }, { organizationId }, permissions] = await Promise.all([
    params,
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const [workspace, users] = await Promise.all([
    getExecutiveReviewService(organizationId, id).catch(() => null),
    prisma.user.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, jobTitle: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!workspace) notFound();
  const { review } = workspace;
  const canManage = permissions.includes(
    PermissionKey.MANAGE_EXECUTIVE_REVIEWS,
  );
  const canApprove = permissions.includes(
    PermissionKey.APPROVE_EXECUTIVE_REVIEWS,
  );
  const canCreateCapa =
    canManage && permissions.includes(PermissionKey.CREATE_CAPA);
  const snapshot = readSnapshot(review.evidenceSnapshot);
  const suggestedNextReviewAt = nextExecutiveReviewDate(
    review.frequency,
    review.scheduledAt,
  );

  return (
    <div>
      <Link
        href="/management-reviews"
        className="inline-flex items-center gap-2 text-sm text-slate-400"
      >
        <ArrowLeft size={16} />
        Management review register
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <ShieldCheck size={17} />
            {review.reference} · {pretty(review.status)}
          </p>
          <h1 className="mt-2 text-4xl font-bold">{review.title}</h1>
          <p className="mt-2 text-slate-400">
            {review.site?.name ?? "Enterprise-wide"} ·{" "}
            {review.periodStart.toLocaleDateString()} –{" "}
            {review.periodEnd.toLocaleDateString()} · Chair {review.chair.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/management-reviews/${review.id}/board-pack`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm"
          >
            <FileText size={16} />
            Board pack
          </Link>
          <ExecutiveReviewLifecycleControls
            reviewId={review.id}
            status={review.status}
            canManage={canManage}
            canApprove={canApprove}
          />
        </div>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Readiness" value={`${workspace.readiness}%`} />
        <Metric
          label="Meeting"
          value={review.scheduledAt.toLocaleDateString()}
          danger={
            review.scheduledAt < new Date() &&
            (review.status === ExecutiveReviewStatus.DRAFT ||
              review.status === ExecutiveReviewStatus.SCHEDULED)
          }
        />
        <Metric
          label="Agenda concluded"
          value={`${workspace.counts.concludedAgendaCount}/${review.agendaItems.length}`}
        />
        <Metric
          label="Attendance"
          value={`${workspace.counts.attendedCount}/${review.attendees.length}`}
        />
        <Metric
          label="Governed decisions"
          value={`${workspace.counts.governedDecisionCount}/${review.decisions.length}`}
        />
        <Metric
          label="Data quality"
          value={
            review.dataQualityScore === null
              ? "Not captured"
              : `${review.dataQualityScore}%`
          }
        />
      </div>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[.04] p-6">
        <h2 className="text-xl font-semibold">Mandate and provenance</h2>
        <dl className="mt-5 grid gap-5 md:grid-cols-2">
          <Detail label="Scope" value={review.scope} />
          <Detail label="Objectives" value={review.objectives} />
          <Detail label="Frequency" value={pretty(review.frequency)} />
          <Detail
            label="Evidence snapshot"
            value={
              review.snapshotGeneratedAt
                ? `${review.snapshotVersion} · ${review.snapshotGeneratedAt.toLocaleString()}`
                : "Not yet frozen"
            }
          />
        </dl>
        <p className="mt-5 border-t border-white/10 pt-4 text-xs text-slate-500">
          Created by {review.createdBy.name} on{" "}
          {review.createdAt.toLocaleString()}. Source modules:{" "}
          {review.sourceModules.join(", ")}.
        </p>
      </section>

      {snapshot ? (
        <section className="mt-8 rounded-3xl border border-cyan-300/15 bg-cyan-300/[.03] p-6">
          <h2 className="text-xl font-semibold">
            Frozen cross-module evidence
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Decision-support values preserved at review start; source records
            remain authoritative.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {snapshot.map((item) => (
              <Metric key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="flex items-center gap-2">
          <Users size={19} className="text-cyan-300" />
          <h2 className="text-2xl font-semibold">Participants and attendance</h2>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {review.attendees.map((attendee) => (
            <article
              key={attendee.id}
              className="rounded-2xl border border-white/10 bg-white/[.04] p-5"
            >
              <div className="flex justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{attendee.user.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {pretty(attendee.role)}
                  </p>
                </div>
                <span
                  className={
                    attendee.attended ? "text-emerald-300" : "text-slate-500"
                  }
                >
                  {attendee.attended ? "Attended" : "Pending"}
                </span>
              </div>
              {canManage && attendanceEditable.has(review.status) ? (
                <AttendanceForm
                  reviewId={review.id}
                  attendee={{
                    id: attendee.id,
                    attended: attendee.attended,
                    attendanceNote: attendee.attendanceNote,
                  }}
                />
              ) : attendee.attendanceNote ? (
                <p className="mt-3 text-sm text-slate-400">
                  {attendee.attendanceNote}
                </p>
              ) : null}
            </article>
          ))}
        </div>
        {canManage && structurallyEditable.has(review.status) ? (
          <div className="mt-4">
            <AttendeeForm reviewId={review.id} users={users} />
          </div>
        ) : null}
      </section>

      <section className="mt-8">
        <div className="flex items-center gap-2">
          <CalendarDays size={19} className="text-cyan-300" />
          <h2 className="text-2xl font-semibold">Controlled agenda</h2>
        </div>
        <div className="mt-4 space-y-4">
          {review.agendaItems.map((item) => (
            <article
              key={item.id}
              className="rounded-3xl border border-white/10 bg-white/[.04] p-6"
            >
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <p className="text-xs text-cyan-300">
                    {item.position}. {pretty(item.sourceModule)}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">{item.topic}</h3>
                  <p className="mt-2 max-w-4xl text-sm text-slate-400">
                    {item.reviewPrompt}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>{pretty(item.status)}</p>
                  <p className="mt-1">
                    {item.owner?.name ?? "No evidence owner"}
                  </p>
                  {item.sourceHref ? (
                    <Link
                      href={item.sourceHref}
                      className="mt-2 inline-block text-cyan-300"
                    >
                      Open source workspace
                    </Link>
                  ) : null}
                </div>
              </div>
              {canManage &&
              review.status === ExecutiveReviewStatus.IN_PROGRESS ? (
                <AgendaOutcomeForm
                  reviewId={review.id}
                  agendaItemId={item.id}
                  discussion={item.discussion}
                  conclusion={item.conclusion}
                  status={item.status}
                />
              ) : item.conclusion ? (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <Detail label="Discussion" value={item.discussion} />
                  <div className="mt-3">
                    <Detail label="Conclusion" value={item.conclusion} />
                  </div>
                </div>
              ) : null}
            </article>
          ))}
          {canManage && structurallyEditable.has(review.status) ? (
            <AgendaItemForm reviewId={review.id} users={users} />
          ) : null}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={19} className="text-cyan-300" />
          <h2 className="text-2xl font-semibold">
            Management decisions and actions
          </h2>
        </div>
        <div className="mt-4 space-y-4">
          {review.decisions.map((decision) => (
            <article
              key={decision.id}
              className="rounded-2xl border border-white/10 bg-white/[.04] p-5"
            >
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <p className="text-xs text-cyan-300">
                    {pretty(decision.type)} · {pretty(decision.priority)}
                  </p>
                  <h3 className="mt-1 font-semibold">{decision.title}</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    {decision.rationale}
                  </p>
                  {decision.expectedOutcome ? (
                    <p className="mt-2 text-sm text-slate-300">
                      Outcome: {decision.expectedOutcome}
                    </p>
                  ) : null}
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>{pretty(decision.status)}</p>
                  <p className="mt-1">
                    {decision.owner?.name ?? "No owner"}
                    {decision.dueAt
                      ? ` · due ${decision.dueAt.toLocaleDateString()}`
                      : ""}
                  </p>
                  {decision.correctiveAction ? (
                    <Link
                      href={`/actions/${decision.correctiveAction.id}`}
                      className="mt-2 inline-block text-cyan-300"
                    >
                      CAPA {decision.correctiveAction.id.slice(-6)}
                    </Link>
                  ) : null}
                </div>
              </div>
              {decision.closureEvidence ? (
                <p className="mt-4 border-t border-white/10 pt-4 text-sm text-emerald-200">
                  Closure evidence: {decision.closureEvidence}
                </p>
              ) : null}
              {canManage && decisionGovernanceEditable.has(review.status) ? (
                <DecisionGovernanceForms
                  reviewId={review.id}
                  decision={{
                    id: decision.id,
                    title: decision.title,
                    status: decision.status,
                    correctiveActionId: decision.correctiveActionId,
                    ownerId: decision.ownerId,
                    dueAt: decision.dueAt,
                  }}
                  users={users}
                  canCreateCapa={canCreateCapa}
                />
              ) : null}
            </article>
          ))}
          {!review.decisions.length ? (
            <p className="rounded-2xl border border-white/10 p-5 text-sm text-slate-400">
              No management decisions have been recorded.
            </p>
          ) : null}
          {canManage && review.status === ExecutiveReviewStatus.IN_PROGRESS ? (
            <DecisionForm
              reviewId={review.id}
              agenda={review.agendaItems.map((item) => ({
                id: item.id,
                topic: item.topic,
              }))}
              users={users}
            />
          ) : null}
        </div>
      </section>

      {canManage && review.status === ExecutiveReviewStatus.IN_PROGRESS ? (
        <div className="mt-8">
          <ReviewCompletionForm
            reviewId={review.id}
            frequency={review.frequency}
            suggestedNextReviewAt={suggestedNextReviewAt}
          />
        </div>
      ) : null}

      {review.completedAt ? (
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[.04] p-6">
          <h2 className="text-xl font-semibold">Controlled conclusions</h2>
          <dl className="mt-5 grid gap-5 md:grid-cols-2">
            <Detail label="Executive summary" value={review.executiveSummary} />
            <Detail
              label="Performance conclusion"
              value={review.performanceConclusion}
            />
            <Detail
              label="Risk and control conclusion"
              value={review.riskControlConclusion}
            />
            <Detail
              label="Compliance conclusion"
              value={review.complianceConclusion}
            />
            <Detail
              label="Resource adequacy"
              value={review.resourceAdequacy}
            />
            <Detail
              label="Management decisions"
              value={review.decisionsSummary}
            />
            <Detail
              label="Significant changes"
              value={review.significantChanges}
            />
            <Detail
              label="Overall conclusion"
              value={
                review.overallConclusion
                  ? pretty(review.overallConclusion)
                  : null
              }
            />
          </dl>
          <p className="mt-5 border-t border-white/10 pt-4 text-xs text-slate-500">
            Completed{" "}
            {review.completedAt.toLocaleString()} by{" "}
            {review.completedBy?.name ?? "Unknown"}
            {review.approvedAt
              ? ` · Approved ${review.approvedAt.toLocaleString()} by ${review.approvedBy?.name ?? "Unknown"}`
              : ""}
            {review.publishedAt
              ? ` · Published ${review.publishedAt.toLocaleString()} by ${review.publishedBy?.name ?? "Unknown"}`
              : ""}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-2 text-xl font-bold ${
          danger ? "text-red-300" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
        {value || "Not recorded"}
      </dd>
    </div>
  );
}

function readSnapshot(value: Prisma.JsonValue | null) {
  const root = record(value);
  if (!root) return null;
  const report = record(root.executiveReport);
  const summary = record(report?.summary);
  const risk = record(root.riskAndControl);
  const predictive = record(root.predictiveIntelligence);
  const regulatory = record(root.complianceAndRegulatory);
  const resilience = record(root.resilience);
  if (!summary) return null;
  return [
    { label: "Incidents", value: number(summary.totalIncidents) },
    { label: "Audits", value: number(summary.totalAudits) },
    {
      label: "Overdue CAPA",
      value: number(summary.overdueCorrectiveActions),
    },
    { label: "Elevated risks", value: number(risk?.elevatedRisks) },
    {
      label: "Weak critical controls",
      value: number(risk?.weakCriticalControls),
    },
    {
      label: "Predictive signals",
      value: number(predictive?.activeSignals),
    },
    {
      label: "Regulatory changes",
      value: number(regulatory?.openRegulatoryChanges),
    },
    {
      label: "Active resilience plans",
      value:
        number(resilience?.activeEmergencyPlans) +
        number(resilience?.activeContinuityPlans),
    },
    {
      label: "Training completion",
      value: `${number(summary.trainingCompletionRate)}%`,
    },
    { label: "Average audit score", value: number(summary.averageAuditScore) },
  ];
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function pretty(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
