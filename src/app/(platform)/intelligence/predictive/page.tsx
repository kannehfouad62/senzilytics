import {
  PredictivePolicyForm,
  PredictiveRunForm,
} from "@/features/intelligence/predictive-forms";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getPredictiveIntelligenceWorkspace } from "@/modules/intelligence/predictive-intelligence.service";
import {
  PermissionKey,
  PredictiveIntelligenceRunStatus,
  RiskLevel,
} from "@prisma/client";
import {
  Activity,
  ArrowRight,
  DatabaseZap,
  Gauge,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PredictiveIntelligencePage() {
  await requirePermission(PermissionKey.VIEW_PREDICTIVE_INTELLIGENCE);
  const [{ organizationId }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const workspace = await getPredictiveIntelligenceWorkspace(organizationId);
  const canManage = permissions.includes(
    PermissionKey.MANAGE_PREDICTIVE_INTELLIGENCE,
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <Activity size={17} />
            Explainable Leading Indicators
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Predictive Risk Intelligence
          </h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Detect deteriorating trends and exposure concentrations from
            tenant records using governed thresholds, traceable evidence, and
            qualified human review.
          </p>
        </div>
        {canManage && <PredictiveRunForm />}
      </div>

      <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[.05] p-4 text-sm text-amber-100">
        <ShieldCheck className="mr-2 inline" size={17} />
        These are prioritization indicators—not injury probabilities,
        causal conclusions, or autonomous management decisions. Always review
        the underlying records and operating context.
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Active conditions" value={workspace.summary.active} />
        <Metric
          label="Critical"
          value={workspace.summary.critical}
          tone="text-red-300"
        />
        <Metric
          label="High"
          value={workspace.summary.high}
          tone="text-amber-300"
        />
        <Metric
          label="Awaiting review"
          value={workspace.summary.awaitingReview}
          tone="text-violet-300"
        />
        <Metric
          label="Avg. attention"
          value={`${workspace.summary.averageAttention}/100`}
          tone="text-cyan-300"
        />
      </div>

      <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[.04]">
        <div className="border-b border-white/10 p-6">
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <Gauge size={16} />
            Current signal register
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            Evidence-backed attention priorities
          </h2>
        </div>
        <div className="divide-y divide-white/10">
          {workspace.signals.map((signal) => (
            <Link
              key={signal.id}
              href={`/intelligence/predictive/${signal.id}`}
              className="flex flex-wrap items-center justify-between gap-4 p-5 transition hover:bg-white/[.03]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Severity value={signal.severity} />
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      signal.conditionActive
                        ? "bg-cyan-400/10 text-cyan-200"
                        : "bg-slate-400/10 text-slate-400"
                    }`}
                  >
                    {signal.conditionActive
                      ? "Condition active"
                      : "Condition cleared"}
                  </span>
                  <span className="text-xs text-slate-500">
                    {signal.category.replaceAll("_", " ")}
                  </span>
                </div>
                <h3 className="mt-2 font-semibold text-white">
                  {signal.title}
                </h3>
                <p className="mt-1 max-w-3xl text-sm text-slate-400">
                  {signal.summary}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Status {signal.status.replaceAll("_", " ")} · Last detected{" "}
                  {signal.lastDetectedAt.toLocaleString()} · Review due{" "}
                  {signal.reviewDueAt.toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-2xl font-bold text-cyan-200">
                    {signal.attentionScore}
                  </p>
                  <p className="text-xs text-slate-500">attention / 100</p>
                </div>
                <ArrowRight size={18} className="text-slate-500" />
              </div>
            </Link>
          ))}
          {!workspace.signals.length && (
            <div className="p-12 text-center">
              <DatabaseZap className="mx-auto text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">
                No analyses have been run for this organization. Run the first
                governed analysis to establish the signal register.
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        {canManage && <PredictivePolicyForm policy={workspace.policy} />}
        <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
          <h2 className="text-xl font-semibold">Analysis history</h2>
          <p className="mt-1 text-sm text-slate-400">
            Every run preserves its windows, algorithm version, data quality,
            and outcome.
          </p>
          <div className="mt-5 space-y-3">
            {workspace.runs.map((run) => (
              <div
                key={run.id}
                className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={
                      run.status === PredictiveIntelligenceRunStatus.COMPLETED
                        ? "text-emerald-300"
                        : run.status === PredictiveIntelligenceRunStatus.FAILED
                          ? "text-red-300"
                          : "text-amber-300"
                    }
                  >
                    {run.status}
                  </span>
                  <span className="text-xs text-slate-500">
                    {run.algorithmVersion}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  {run.signalsDetected} new · {run.signalsRefreshed} refreshed ·{" "}
                  {run.conditionsCleared} cleared
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {run.createdAt.toLocaleString()} · Data quality{" "}
                  {run.dataQualityScore}/100
                  {run.requestedBy
                    ? ` · Requested by ${run.requestedBy.name}`
                    : " · Scheduled"}
                </p>
              </div>
            ))}
            {!workspace.runs.length && (
              <p className="text-sm text-slate-500">No analysis history yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[.04] p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function Severity({ value }: { value: RiskLevel }) {
  const tones: Record<RiskLevel, string> = {
    LOW: "bg-slate-400/10 text-slate-300",
    MEDIUM: "bg-yellow-400/10 text-yellow-200",
    HIGH: "bg-amber-400/10 text-amber-200",
    CRITICAL: "bg-red-400/10 text-red-200",
  };
  return (
    <span className={`rounded-full px-2 py-1 text-xs ${tones[value]}`}>
      {value}
    </span>
  );
}
