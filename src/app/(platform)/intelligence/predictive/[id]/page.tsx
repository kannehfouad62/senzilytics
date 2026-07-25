import { PredictiveReviewForm } from "@/features/intelligence/predictive-forms";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getPredictiveSignalService } from "@/modules/intelligence/predictive-intelligence.service";
import { PermissionKey } from "@prisma/client";
import { ArrowLeft, Database, ShieldCheck } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PredictiveSignalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_PREDICTIVE_INTELLIGENCE);
  const [{ organizationId }, permissions, { id }] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
    params,
  ]);
  const canManage = permissions.includes(
    PermissionKey.MANAGE_PREDICTIVE_INTELLIGENCE,
  );
  const [signal, users] = await Promise.all([
    getPredictiveSignalService(organizationId, id),
    canManage
      ? prisma.user.findMany({
          where: { organizationId, isActive: true },
          select: { id: true, name: true, jobTitle: true },
          orderBy: { name: "asc" },
        })
      : [],
  ]);

  return (
    <div>
      <Link
        href="/intelligence/predictive"
        className="inline-flex items-center gap-2 text-sm text-cyan-300"
      >
        <ArrowLeft size={16} />
        Predictive intelligence
      </Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-cyan-300">
            {signal.category.replaceAll("_", " ")}
          </p>
          <h1 className="mt-2 text-4xl font-bold">{signal.title}</h1>
          <p className="mt-2 max-w-3xl text-slate-400">{signal.summary}</p>
        </div>
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[.06] px-5 py-4 text-right">
          <p className="text-3xl font-bold text-cyan-200">
            {signal.attentionScore}
          </p>
          <p className="text-xs text-slate-400">attention score / 100</p>
        </div>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Severity" value={signal.severity} />
        <Fact label="Direction" value={signal.direction} />
        <Fact label="Review status" value={signal.status} />
        <Fact
          label="Indicator condition"
          value={signal.conditionActive ? "ACTIVE" : "CLEARED"}
        />
        <Fact label="Current value" value={signal.currentValue} />
        <Fact label="Baseline value" value={signal.baselineValue} />
        <Fact
          label="Change"
          value={
            signal.changePercent === null
              ? "Threshold rule"
              : `${signal.changePercent}%`
          }
        />
        <Fact label="Data quality" value={`${signal.dataQualityScore}/100`} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
            <h2 className="text-xl font-semibold">Interpretation &amp; action</h2>
            <h3 className="mt-5 text-sm font-semibold text-slate-300">
              Why this was detected
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {signal.rationale}
            </p>
            <h3 className="mt-5 text-sm font-semibold text-slate-300">
              Recommended next step
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {signal.recommendedAction}
            </p>
            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[.05] p-4 text-sm text-amber-100">
              <ShieldCheck className="mr-2 inline" size={16} />
              This indicator prioritizes review. It does not establish cause,
              predict an event, or authorize an automated source-record change.
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
            <p className="flex items-center gap-2 text-sm text-cyan-300">
              <Database size={16} />
              Preserved evidence snapshot
            </p>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950/70 p-4 text-xs leading-6 text-slate-300">
              {JSON.stringify(signal.evidence, null, 2)}
            </pre>
            <div className="mt-4 grid gap-3 text-xs text-slate-500 sm:grid-cols-2">
              <p>
                Window: {signal.run.windowStart.toLocaleDateString()}–
                {signal.run.windowEnd.toLocaleDateString()}
              </p>
              <p>
                Comparison: {signal.run.comparisonStart.toLocaleDateString()}–
                {signal.run.comparisonEnd.toLocaleDateString()}
              </p>
              <p>Algorithm: {signal.run.algorithmVersion}</p>
              <p>Threshold: {signal.thresholdValue}</p>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
            <h2 className="text-xl font-semibold">Review history</h2>
            <div className="mt-5 space-y-4">
              {signal.reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-semibold text-white">
                      {review.decision.replaceAll("_", " ")}
                    </span>
                    <span className="text-slate-500">
                      {review.createdAt.toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {review.rationale}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {review.reviewer.name} · {review.statusBefore} →{" "}
                    {review.statusAfter}
                  </p>
                </div>
              ))}
              {!signal.reviews.length && (
                <p className="text-sm text-slate-500">
                  No qualified review has been recorded.
                </p>
              )}
            </div>
          </section>
        </div>
        {canManage && <PredictiveReviewForm signalId={signal.id} users={users} />}
      </div>
    </div>
  );
}

function Fact({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 font-semibold text-white">
        {typeof value === "string" ? value.replaceAll("_", " ") : value}
      </p>
    </div>
  );
}
