import { PrintReportButton } from "@/features/reports/print-report-button";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getExecutiveReviewService } from "@/modules/executive-review/executive-review.service";
import { ExecutiveReviewStatus, PermissionKey, Prisma } from "@prisma/client";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ExecutiveBoardPackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_EXECUTIVE_REVIEWS);
  const [{ id }, { organizationId }] = await Promise.all([
    params,
    getCurrentUserTenant(),
  ]);
  const workspace = await getExecutiveReviewService(
    organizationId,
    id,
  ).catch(() => null);
  if (!workspace) notFound();
  const { review } = workspace;
  const snapshot = snapshotMetrics(review.evidenceSnapshot);
  const controlled =
    review.status === ExecutiveReviewStatus.PUBLISHED ||
    review.status === ExecutiveReviewStatus.ARCHIVED;

  return (
    <article className="mx-auto max-w-6xl print:max-w-none print:text-black">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <Link
          href={`/management-reviews/${review.id}`}
          className="inline-flex items-center gap-2 text-sm text-slate-400"
        >
          <ArrowLeft size={16} />
          Review workspace
        </Link>
        <PrintReportButton />
      </div>

      <header className="mt-8 border-b border-white/10 pb-8 print:mt-0 print:border-slate-300">
        <p className="flex items-center gap-2 text-sm font-semibold text-cyan-300 print:text-slate-700">
          <ShieldCheck size={17} />
          Senzilytics controlled executive record
        </p>
        <h1 className="mt-3 text-4xl font-bold">Management Review Board Pack</h1>
        <p className="mt-3 text-xl">{review.title}</p>
        <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Meta label="Reference" value={review.reference} />
          <Meta label="Status" value={pretty(review.status)} />
          <Meta
            label="Reporting period"
            value={`${review.periodStart.toLocaleDateString()} – ${review.periodEnd.toLocaleDateString()}`}
          />
          <Meta
            label="Meeting"
            value={review.scheduledAt.toLocaleString()}
          />
          <Meta
            label="Scope"
            value={review.site?.name ?? "Enterprise-wide"}
          />
          <Meta label="Chair" value={review.chair.name} />
          <Meta
            label="Evidence version"
            value={review.snapshotVersion ?? "Not captured"}
          />
          <Meta
            label="Data coverage"
            value={
              review.dataQualityScore === null
                ? "Not assessed"
                : `${review.dataQualityScore}%`
            }
          />
        </div>
        <p
          className={`mt-6 rounded-xl border p-4 text-sm ${
            controlled
              ? "border-emerald-300/20 bg-emerald-300/[.05] text-emerald-100 print:border-slate-400 print:bg-white print:text-black"
              : "border-amber-300/20 bg-amber-300/[.05] text-amber-100 print:border-slate-400 print:bg-white print:text-black"
          }`}
        >
          {controlled
            ? `Controlled copy published ${review.publishedAt?.toLocaleString() ?? ""} by ${review.publishedBy?.name ?? "authorized publisher"}.`
            : "DRAFT / UNCONTROLLED COPY — this review has not completed the approval and publication lifecycle."}
        </p>
      </header>

      <section className="py-8">
        <h2 className="text-2xl font-semibold">Review mandate</h2>
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <Narrative label="Scope" value={review.scope} />
          <Narrative label="Objectives" value={review.objectives} />
        </div>
      </section>

      <section className="border-t border-white/10 py-8 print:border-slate-300">
        <h2 className="text-2xl font-semibold">Cross-module evidence snapshot</h2>
        <p className="mt-2 text-sm text-slate-400 print:text-slate-600">
          Captured{" "}
          {review.snapshotGeneratedAt?.toLocaleString() ?? "not yet captured"}.
          Values are decision-support evidence, not causal conclusions.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {snapshot.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-white/10 p-4 print:border-slate-300"
            >
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-bold">{item.value}</p>
            </div>
          ))}
          {!snapshot.length ? (
            <p className="text-sm text-slate-400">
              No evidence snapshot has been captured.
            </p>
          ) : null}
        </div>
      </section>

      <section className="border-t border-white/10 py-8 print:border-slate-300">
        <h2 className="text-2xl font-semibold">Agenda record</h2>
        <div className="mt-5 space-y-5">
          {review.agendaItems.map((item) => (
            <article
              key={item.id}
              className="break-inside-avoid rounded-2xl border border-white/10 p-5 print:border-slate-300"
            >
              <p className="text-xs font-semibold text-cyan-300 print:text-slate-600">
                {item.position}. {pretty(item.sourceModule)} ·{" "}
                {pretty(item.status)}
              </p>
              <h3 className="mt-2 text-lg font-semibold">{item.topic}</h3>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <Narrative
                  label="Discussion"
                  value={item.discussion ?? "Not recorded"}
                />
                <Narrative
                  label="Conclusion"
                  value={item.conclusion ?? "Not recorded"}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 py-8 print:border-slate-300">
        <h2 className="text-2xl font-semibold">Leadership conclusions</h2>
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <Narrative
            label="Executive summary"
            value={review.executiveSummary ?? "Not recorded"}
          />
          <Narrative
            label="Performance"
            value={review.performanceConclusion ?? "Not recorded"}
          />
          <Narrative
            label="Risk and controls"
            value={review.riskControlConclusion ?? "Not recorded"}
          />
          <Narrative
            label="Compliance"
            value={review.complianceConclusion ?? "Not recorded"}
          />
          <Narrative
            label="Resource adequacy"
            value={review.resourceAdequacy ?? "Not recorded"}
          />
          <Narrative
            label="Significant changes"
            value={review.significantChanges ?? "None recorded"}
          />
          <Narrative
            label="Decision summary"
            value={review.decisionsSummary ?? "Not recorded"}
          />
          <Narrative
            label="Overall conclusion"
            value={
              review.overallConclusion
                ? pretty(review.overallConclusion)
                : "Not recorded"
            }
          />
        </div>
      </section>

      <section className="border-t border-white/10 py-8 print:border-slate-300">
        <h2 className="text-2xl font-semibold">Decisions and commitments</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-slate-400 print:border-slate-300 print:text-slate-700">
              <tr>
                <th className="p-3">Decision</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Due</th>
                <th className="p-3">Status / control</th>
              </tr>
            </thead>
            <tbody>
              {review.decisions.map((decision) => (
                <tr
                  key={decision.id}
                  className="break-inside-avoid border-b border-white/5 print:border-slate-200"
                >
                  <td className="p-3">
                    <strong>{decision.title}</strong>
                    <p className="mt-1 text-xs text-slate-400 print:text-slate-600">
                      {pretty(decision.type)} · {decision.rationale}
                    </p>
                  </td>
                  <td className="p-3">
                    {decision.owner?.name ?? "Unassigned"}
                  </td>
                  <td className="p-3">{pretty(decision.priority)}</td>
                  <td className="p-3">
                    {decision.dueAt?.toLocaleDateString() ?? "—"}
                  </td>
                  <td className="p-3">
                    {pretty(decision.status)}
                    {decision.correctiveAction
                      ? ` · CAPA ${decision.correctiveAction.id.slice(-6)}`
                      : ""}
                  </td>
                </tr>
              ))}
              {!review.decisions.length ? (
                <tr>
                  <td colSpan={5} className="p-5 text-center text-slate-400">
                    No decisions recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-t border-white/10 py-8 print:border-slate-300">
        <h2 className="text-2xl font-semibold">Attendance and authorization</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {review.attendees.map((attendee) => (
            <Meta
              key={attendee.id}
              label={pretty(attendee.role)}
              value={`${attendee.user.name} — ${attendee.attended ? "Attended" : "Not recorded"}`}
            />
          ))}
        </div>
        <div className="mt-7 grid gap-5 md:grid-cols-3">
          <Meta
            label="Completed"
            value={
              review.completedAt
                ? `${review.completedAt.toLocaleString()} · ${review.completedBy?.name ?? "Unknown"}`
                : "Pending"
            }
          />
          <Meta
            label="Approved"
            value={
              review.approvedAt
                ? `${review.approvedAt.toLocaleString()} · ${review.approvedBy?.name ?? "Unknown"}`
                : "Pending"
            }
          />
          <Meta
            label="Published"
            value={
              review.publishedAt
                ? `${review.publishedAt.toLocaleString()} · ${review.publishedBy?.name ?? "Unknown"}`
                : "Pending"
            }
          />
        </div>
      </section>

      <footer className="border-t border-white/10 py-6 text-xs text-slate-500 print:border-slate-300">
        Generated from Senzilytics for {review.organization.name}. Verify
        controlled-copy status in the live review register. Snapshot version{" "}
        {review.snapshotVersion ?? "not available"}.
      </footer>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function Narrative({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-slate-500">{label}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{value}</p>
    </div>
  );
}

function snapshotMetrics(value: Prisma.JsonValue | null) {
  const root = record(value);
  const report = record(root?.executiveReport);
  const summary = record(report?.summary);
  const risk = record(root?.riskAndControl);
  const predictive = record(root?.predictiveIntelligence);
  const regulatory = record(root?.complianceAndRegulatory);
  if (!summary) return [];
  return [
    ["Incidents", number(summary.totalIncidents)],
    ["Audits", number(summary.totalAudits)],
    ["Inspections", number(summary.totalInspections)],
    ["Overdue CAPA", number(summary.overdueCorrectiveActions)],
    ["Overdue obligations", number(summary.overdueComplianceItems)],
    ["Elevated risks", number(risk?.elevatedRisks)],
    ["Weak controls", number(risk?.weakCriticalControls)],
    ["Predictive signals", number(predictive?.activeSignals)],
    ["Regulatory changes", number(regulatory?.openRegulatoryChanges)],
    ["Training completion", `${number(summary.trainingCompletionRate)}%`],
  ].map(([label, metric]) => ({ label: String(label), value: metric }));
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
