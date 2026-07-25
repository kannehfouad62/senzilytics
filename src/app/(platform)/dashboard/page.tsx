import { ExecutiveCommandCenterCharts } from "@/core/analytics/executive-command-center-charts";
import {
  getExecutiveCommandCenter,
  parseExecutiveDashboardFilters,
} from "@/core/analytics/executive-command-center.service";
import { GlobalExecutivePortfolio } from "@/core/analytics/global-executive-portfolio";
import { GenerateEnterpriseAiForm } from "@/features/intelligence/enterprise-ai-forms";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Download,
  FileChartColumn,
  Gauge,
  Network,
  RefreshCw,
  ShieldAlert,
  Target,
  TimerReset,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams: Promise<{
    days?: string;
    siteId?: string;
    departmentId?: string;
  }>;
};

const metricIcons = {
  incidents: ShieldAlert,
  actions: TimerReset,
  audits: FileChartColumn,
  inspections: CheckCircle2,
  training: Gauge,
  risk: AlertTriangle,
  scorecards: Target,
  workflow: Network,
} as const;

const ratingTone: Record<string, string> = {
  CRITICAL: "border-red-400/25 bg-red-400/10 text-red-200",
  OFF_TARGET: "border-orange-400/25 bg-orange-400/10 text-orange-200",
  WATCH: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  ON_TARGET: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  await requirePermission(PermissionKey.VIEW_DASHBOARD);
  const [{ organizationId, user }, permissions, params] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
    searchParams,
  ]);
  const dashboard = await getExecutiveCommandCenter({
    organizationId,
    userId: user.id,
    permissions,
    filters: parseExecutiveDashboardFilters(params),
  });
  const allowed = new Set(permissions);
  const query = new URLSearchParams({
    days: String(dashboard.filters.days),
    ...(dashboard.scope.siteId ? { siteId: dashboard.scope.siteId } : {}),
    ...(dashboard.scope.departmentId
      ? { departmentId: dashboard.scope.departmentId }
      : {}),
  }).toString();

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-3xl border border-cyan-400/15 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.16),transparent_35%),linear-gradient(135deg,rgba(15,23,42,.98),rgba(2,6,23,.96))] p-6 shadow-2xl sm:p-8">
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-cyan-300">
              Global Executive Dashboard 2.0
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Welcome back, {user.name}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              A permission-aware command center for enterprise EHS performance,
              control exposure, workflow reliability, and management decisions.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                Scope: {dashboard.scope.label}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                Window: {dashboard.filters.days} days
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                Updated {dashboard.generatedAt.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {allowed.has(PermissionKey.VIEW_REPORTS) ? (
              <Link
                href="/reports"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-cyan-400/30"
              >
                <FileChartColumn size={17} />
                Board report
              </Link>
            ) : null}
            <Link
              href={`/api/dashboard/export?${query}`}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              <Download size={17} />
              Export evidence
            </Link>
          </div>
        </div>
      </header>

      <section className="rounded-3xl border border-white/10 bg-white/[.04] p-5 shadow-xl">
        <form className="grid gap-4 lg:grid-cols-[.65fr_1fr_1.35fr_auto] lg:items-end">
          <label className="text-sm text-slate-300">
            Reporting window
            <select
              name="days"
              defaultValue={String(dashboard.filters.days)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 text-white outline-none focus:border-cyan-400/50"
            >
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">365 days</option>
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Site
            <select
              name="siteId"
              defaultValue={dashboard.scope.siteId ?? ""}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 text-white outline-none focus:border-cyan-400/50"
            >
              <option value="">All sites</option>
              {dashboard.sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Department
            <select
              name="departmentId"
              defaultValue={dashboard.scope.departmentId ?? ""}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 text-white outline-none focus:border-cyan-400/50"
            >
              <option value="">All departments</option>
              {dashboard.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.site.name} · {department.name}
                </option>
              ))}
            </select>
          </label>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-5 py-3 font-semibold text-cyan-200 transition hover:bg-cyan-400/15">
            <RefreshCw size={17} />
            Apply
          </button>
        </form>
        <div className="mt-4 space-y-1 text-xs leading-5 text-slate-500">
          {dashboard.scopeNotes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-cyan-300">Decision scorecard</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">
              Executive performance and exposure
            </h2>
          </div>
          <p className="text-sm text-slate-500">
            Empty denominators display as no data—not artificial 0%.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {dashboard.headline.map((metric) => {
            const Icon =
              metricIcons[metric.key as keyof typeof metricIcons] ?? BarChart3;
            return (
              <Link
                key={metric.key}
                href={metric.href}
                className="group rounded-3xl border border-white/10 bg-white/[.04] p-5 shadow-xl transition hover:-translate-y-0.5 hover:border-cyan-400/30 hover:bg-white/[.06]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-400">{metric.label}</p>
                    <p className="mt-3 text-3xl font-bold text-white">
                      {metric.value === null
                        ? "—"
                        : `${metric.value}${metric.suffix ?? ""}`}
                    </p>
                  </div>
                  <span
                    className={`rounded-2xl p-3 ${
                      metric.tone === "danger"
                        ? "bg-red-400/10 text-red-300"
                        : "bg-cyan-400/10 text-cyan-300"
                    }`}
                  >
                    <Icon size={20} />
                  </span>
                </div>
                <p className="mt-3 text-sm leading-5 text-slate-500">
                  {metric.note}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <GlobalExecutivePortfolio
        modules={dashboard.portfolio.modules}
        attentionCount={dashboard.portfolio.attentionCount}
      />

      <ExecutiveCommandCenterCharts
        trend={dashboard.trend}
        enabledSeries={dashboard.enabledTrendSeries}
        performance={dashboard.performance}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-red-400/15 bg-red-400/[.035] p-6 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-red-300">Management attention</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">
                Ranked assurance priorities
              </h2>
            </div>
            <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs text-red-200">
              {dashboard.assuranceSummary.signalCount} signals ·{" "}
              {dashboard.assuranceSummary.criticalCount} critical
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {dashboard.priorities.map((priority) => (
              <Link
                key={priority.id}
                href={priority.href}
                className="block rounded-2xl border border-white/10 bg-slate-950/40 p-4 transition hover:border-red-400/25"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{priority.title}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-400">
                      {priority.detail}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {priority.source}
                      {priority.site ? ` · ${priority.site}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${
                      priority.severity === "CRITICAL"
                        ? "border-red-400/25 bg-red-400/10 text-red-200"
                        : priority.severity === "HIGH"
                          ? "border-orange-400/25 bg-orange-400/10 text-orange-200"
                          : "border-amber-400/25 bg-amber-400/10 text-amber-200"
                    }`}
                  >
                    {priority.severity}
                  </span>
                </div>
              </Link>
            ))}
            {dashboard.priorities.length === 0 ? (
              <EmptyState message="No elevated assurance signals are visible for your authorized modules." />
            ) : null}
          </div>
          <Link
            href="/assurance"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300"
          >
            Open operational assurance <ArrowRight size={16} />
          </Link>
        </section>

        <section className="rounded-3xl border border-violet-400/15 bg-violet-400/[.035] p-6 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-violet-300">Governed scorecards</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">
                Indicators requiring intervention
              </h2>
            </div>
            {dashboard.performance ? (
              <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs text-violet-200">
                {dashboard.performance.summary.coverageRate ?? 0}% data coverage
              </span>
            ) : null}
          </div>
          <div className="mt-5 space-y-3">
            {dashboard.performance?.attentionRows.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{row.name}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Actual: {row.value ?? "No data"} {row.unit} · Target:{" "}
                      {row.targetValue ?? "Not set"} {row.unit}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      ratingTone[row.rating] ??
                      "border-slate-400/20 bg-slate-400/10 text-slate-300"
                    }`}
                  >
                    {row.rating.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {row.provenance}
                </p>
              </div>
            ))}
            {!dashboard.performance ? (
              <EmptyState message="Performance scorecards are not available to this role." />
            ) : dashboard.performance.attentionRows.length === 0 ? (
              <EmptyState message="No configured indicators are currently off target or critical." />
            ) : null}
          </div>
          {dashboard.performance ? (
            <Link
              href={`/performance?${query}`}
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-violet-300"
            >
              Open performance scorecards <ArrowRight size={16} />
            </Link>
          ) : null}
        </section>
      </div>

      {dashboard.workflow ? (
        <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-sky-300">Process intelligence</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">
                Workflow speed, reliability, and bottlenecks
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Enterprise-wide control-process evidence for the selected reporting window.
              </p>
            </div>
            <Link
              href={`/workflows/analytics?days=${dashboard.filters.days}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-sky-300"
            >
              Full workflow analysis <ArrowRight size={16} />
            </Link>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MiniMetric
              label="Completion"
              value={formatPercent(dashboard.workflow.summary.completionRate)}
            />
            <MiniMetric
              label="Median cycle"
              value={formatHours(dashboard.workflow.summary.medianCycleHours)}
            />
            <MiniMetric
              label="P90 cycle"
              value={formatHours(dashboard.workflow.summary.p90CycleHours)}
            />
            <MiniMetric
              label="Outcome success"
              value={formatPercent(dashboard.workflow.summary.outcomeSuccessRate)}
            />
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {dashboard.workflow.bottlenecks.map((item) => (
              <div
                key={item.templateStepId}
                className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{item.stepName}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {item.templateName}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs text-amber-200">
                    {item.overdueActiveCount} overdue
                  </span>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Average {formatHours(item.averageCycleHours)} · P90{" "}
                  {formatHours(item.p90CycleHours)} · {item.activeCount} active
                </p>
              </div>
            ))}
            {dashboard.workflow.bottlenecks.length === 0 ? (
              <EmptyState message="No workflow bottlenecks were measured in this window." />
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6 shadow-xl">
          <p className="text-sm text-emerald-300">Evidence quality</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            Data freshness and provenance
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Counts and timestamps expose the basis of management conclusions.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {dashboard.freshness.map((item) => (
              <div
                key={item.domain}
                className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-white">{item.domain}</p>
                  <span className="text-xs text-slate-500">
                    {item.recordCount} records
                  </span>
                </div>
                <p className="mt-2 text-sm text-emerald-200">
                  {item.latestAt
                    ? `Latest ${item.latestAt.toLocaleString()}`
                    : "No source records in scope"}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {item.provenance}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-purple-400/20 bg-purple-400/[.045] p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm text-purple-300">
                <BrainCircuit size={17} />
                Governed AI briefing
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Human-reviewed intelligence
              </h2>
            </div>
            {dashboard.latestAiBriefing ? (
              <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-xs text-purple-200">
                {dashboard.latestAiBriefing.status.replaceAll("_", " ")}
              </span>
            ) : null}
          </div>
          {dashboard.latestAiBriefing ? (
            <div className="mt-5">
              <p className="font-medium text-white">
                {dashboard.latestAiBriefing.title}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {dashboard.latestAiBriefing.executiveSummary}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="rounded-full border border-white/10 px-2.5 py-1">
                  {dashboard.latestAiBriefing.confidence} confidence
                </span>
                <span className="rounded-full border border-white/10 px-2.5 py-1">
                  {dashboard.latestAiBriefing._count.sources} cited sources
                </span>
                <span className="rounded-full border border-white/10 px-2.5 py-1">
                  {dashboard.latestAiBriefing.createdAt.toLocaleDateString()}
                </span>
              </div>
              <Link
                href={`/intelligence/${dashboard.latestAiBriefing.id}`}
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-purple-300"
              >
                Review cited analysis <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState message="No approved or pending executive briefing is available." />
              {allowed.has(PermissionKey.USE_AI) ? (
                <Link
                  href="/intelligence"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-purple-300"
                >
                  Create governed analysis <ArrowRight size={16} />
                </Link>
              ) : null}
            </div>
          )}
        </section>
      </div>

      {allowed.has(PermissionKey.USE_AI) ? <GenerateEnterpriseAiForm /> : null}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-center text-sm text-slate-400">
      {message}
    </p>
  );
}

function formatPercent(value: number | null) {
  return value === null ? "No data" : `${value}%`;
}

function formatHours(value: number | null) {
  if (value === null) return "No data";
  if (value < 24) return `${value}h`;
  return `${Math.round((value / 24) * 10) / 10}d`;
}
