import {
  PerformanceIndicatorForm,
  PerformanceIndicatorStatusForm,
  PerformanceMeasurementForm,
  PerformanceMeasurementReviewForm,
  PerformanceTargetForm,
} from "@/features/performance/performance-management-forms";
import {
  PerformanceBenchmarkChart,
  PerformanceRatingChart,
  PerformanceTrendChart,
} from "@/features/performance/performance-scorecard-charts";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  getPerformanceWorkspace,
  parsePerformanceFilters,
  type PerformanceRating,
} from "@/modules/performance/performance-scorecard.service";
import { PerformanceMeasurementStatus, PermissionKey } from "@prisma/client";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  Gauge,
  Layers3,
  Target,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PerformanceScorecardsPage({
  searchParams,
}: {
  searchParams: Promise<{
    days?: string;
    siteId?: string;
    departmentId?: string;
    indicatorId?: string;
  }>;
}) {
  await requirePermission(PermissionKey.VIEW_PERFORMANCE_SCORECARDS);
  const [{ organizationId }, permissions, params] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
    searchParams,
  ]);
  const filters = parsePerformanceFilters(params);
  const workspace = await getPerformanceWorkspace({
    organizationId,
    filters,
  });
  const canManage = permissions.includes(
    PermissionKey.MANAGE_PERFORMANCE_SCORECARDS,
  );
  const exportQuery = new URLSearchParams({
    days: String(workspace.filters.days),
    ...(workspace.scope.siteId &&
    workspace.scope.departmentId === null
      ? { siteId: workspace.scope.siteId }
      : {}),
    ...(workspace.scope.departmentId
      ? { departmentId: workspace.scope.departmentId }
      : {}),
    ...(workspace.selectedIndicator
      ? { indicatorId: workspace.selectedIndicator.id }
      : {}),
  }).toString();
  const metrics = [
    {
      label: "Active indicators",
      value: workspace.summary.activeIndicators,
      note: "Governed catalog",
      icon: Layers3,
      tone: "text-cyan-300",
    },
    {
      label: "On target",
      value: workspace.summary.onTarget,
      note: workspace.scope.label,
      icon: CheckCircle2,
      tone: "text-emerald-300",
    },
    {
      label: "Attention required",
      value: workspace.summary.attentionRequired,
      note: "Off target or critical",
      icon: AlertTriangle,
      tone:
        workspace.summary.attentionRequired > 0
          ? "text-amber-300"
          : "text-emerald-300",
    },
    {
      label: "Data coverage",
      value: formatPercent(workspace.summary.coverageRate),
      note: "Indicators with values",
      icon: Gauge,
      tone: "text-sky-300",
    },
    {
      label: "Target coverage",
      value: formatPercent(workspace.summary.targetCoverageRate),
      note: "Effective control bands",
      icon: Target,
      tone: "text-violet-300",
    },
    {
      label: "Average attainment",
      value: formatPercent(workspace.summary.averageAttainment),
      note: "Targeted indicators",
      icon: BarChart3,
      tone: "text-cyan-300",
    },
  ];
  const activeIndicators = workspace.indicators.filter(
    (indicator) => indicator.isActive,
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <Target size={16} />
            Enterprise Performance Management
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            KPI Scorecards &amp; Benchmarking
          </h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Govern leading and lagging indicators, effective-dated targets,
            approved manual values, automated module metrics, and internal
            comparisons without duplicating operational records.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            {workspace.scope.label} ·{" "}
            {workspace.filters.from.toLocaleDateString()}–{" "}
            {workspace.filters.to.toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-2xl border border-white/10 px-5 py-3 text-sm"
          >
            Global Dashboard
          </Link>
          <a
            href={`/api/performance/export?${exportQuery}`}
            className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950"
          >
            <Download size={17} />
            Export CSV
          </a>
        </div>
      </div>

      <form
        method="get"
        className="mt-8 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 md:grid-cols-2 xl:grid-cols-[1fr_1.3fr_1.5fr_1.8fr_auto]"
      >
        <FilterSelect label="Reporting window" name="days" value={String(filters.days)}>
          <option value="30">Past 30 days</option>
          <option value="90">Past 90 days</option>
          <option value="180">Past 180 days</option>
          <option value="365">Past 365 days</option>
        </FilterSelect>
        <FilterSelect
          label="Site"
          name="siteId"
          value={
            workspace.scope.departmentId === null
              ? workspace.scope.siteId ?? ""
              : ""
          }
        >
          <option value="">Organization-wide</option>
          {workspace.sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Department"
          name="departmentId"
          value={workspace.scope.departmentId ?? ""}
        >
          <option value="">All departments</option>
          {workspace.departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.site.name} — {department.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Benchmark indicator"
          name="indicatorId"
          value={workspace.selectedIndicator?.id ?? ""}
        >
          {activeIndicators.length === 0 && (
            <option value="">No active indicators</option>
          )}
          {activeIndicators.map((indicator) => (
            <option key={indicator.id} value={indicator.id}>
              {indicator.code} — {indicator.name}
            </option>
          ))}
        </FilterSelect>
        <button className="self-end rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950">
          Apply
        </button>
      </form>

      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article
              key={metric.label}
              className="rounded-3xl border border-white/10 bg-white/5 p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <div className={`rounded-2xl bg-white/5 p-3 ${metric.tone}`}>
                  <Icon size={21} />
                </div>
                <span className="text-right text-xs text-slate-500">
                  {metric.note}
                </span>
              </div>
              <p className="mt-5 text-sm text-slate-400">{metric.label}</p>
              <p className="mt-1 text-3xl font-bold">{metric.value}</p>
            </article>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <PerformanceRatingChart data={workspace.ratingCounts} />
        {workspace.selectedIndicator ? (
          <PerformanceTrendChart
            data={workspace.trend}
            indicatorName={workspace.selectedIndicator.name}
            unit={workspace.selectedIndicator.unit}
          />
        ) : (
          <EmptyCard message="Create an indicator to begin trend analysis." />
        )}
      </div>

      <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        <SectionHeader
          title="Executive scorecard"
          description="Exact-scope values use the most specific effective target, falling back from department to site and then organization."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-slate-300">
              <tr>
                <Header>Indicator</Header>
                <Header>Type</Header>
                <Header>Actual</Header>
                <Header>Target</Header>
                <Header>Status</Header>
                <Header>Attainment</Header>
                <Header>Provenance</Header>
              </tr>
            </thead>
            <tbody>
              {workspace.rows.map((row) => (
                <tr key={row.id} className="border-b border-white/5 align-top">
                  <td className="px-6 py-5">
                    <p className="font-semibold">{row.code} — {row.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.category} · {pretty(row.source)} · {pretty(row.reportingFrequency)}
                    </p>
                  </td>
                  <Cell>{pretty(row.type)}</Cell>
                  <Cell>{formatValue(row.value, row.unit)}</Cell>
                  <Cell>{formatValue(row.targetValue, row.unit)}</Cell>
                  <td className="px-6 py-5">
                    <Rating value={row.rating} />
                  </td>
                  <Cell>{formatPercent(row.attainment)}</Cell>
                  <td className="max-w-md px-6 py-5 text-xs leading-5 text-slate-400">
                    {row.provenance}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {workspace.rows.length === 0 && (
          <Empty message="No active performance indicators have been configured." />
        )}
      </section>

      {workspace.selectedIndicator && (
        <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <PerformanceBenchmarkChart
            data={workspace.benchmark}
            indicatorName={workspace.selectedIndicator.name}
            unit={workspace.selectedIndicator.unit}
          />
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
            <SectionHeader
              title="Site ranking"
              description="Best-to-worst ordering follows the indicator direction."
            />
            <div className="max-h-[320px] overflow-y-auto">
              {workspace.benchmark.map((row, index) => (
                <div
                  key={row.siteId}
                  className="flex items-center justify-between gap-4 border-t border-white/5 px-6 py-4"
                >
                  <div>
                    <p className="font-medium">{index + 1}. {row.siteName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Target {formatValue(row.targetValue, workspace.selectedIndicator!.unit)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-cyan-200">
                      {formatValue(row.value, workspace.selectedIndicator!.unit)}
                    </p>
                    <Rating value={row.rating as PerformanceRating} />
                  </div>
                </div>
              ))}
              {workspace.benchmark.length === 0 && (
                <Empty message="Add sites to enable tenant-internal benchmarking." />
              )}
            </div>
          </section>
        </div>
      )}

      {canManage && (
        <>
          <section className="mt-8">
            <SectionHeader
              title="Scorecard administration"
              description="Configuration changes and measurement decisions are tenant-scoped and recorded in the activity log."
            />
            <div className="grid gap-6 xl:grid-cols-2">
              <PerformanceIndicatorForm users={workspace.users} />
              <PerformanceTargetForm
                indicators={workspace.indicators}
                sites={workspace.sites}
                departments={workspace.departments}
              />
              <PerformanceMeasurementForm
                indicators={workspace.indicators}
                sites={workspace.sites}
                departments={workspace.departments}
              />
              <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold">Measurement review queue</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Approve governed manual values before they enter the scorecard.
                </p>
                <div className="mt-5 max-h-[540px] space-y-3 overflow-y-auto">
                  {workspace.recentMeasurements
                    .filter(
                      (measurement) =>
                        measurement.status === PerformanceMeasurementStatus.DRAFT,
                    )
                    .map((measurement) => (
                      <article
                        key={measurement.id}
                        className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                      >
                        <div className="flex flex-wrap justify-between gap-3">
                          <div>
                            <p className="font-medium">
                              {measurement.indicator.code} — {measurement.indicator.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {scopeLabel(measurement)} · {measurement.periodStart.toLocaleDateString()}–
                              {measurement.periodEnd.toLocaleDateString()} · entered by {measurement.enteredBy.name}
                            </p>
                          </div>
                          <p className="font-semibold text-cyan-200">
                            {measurement.value} {measurement.indicator.unit}
                          </p>
                        </div>
                        {measurement.evidenceSummary && (
                          <p className="mt-3 text-xs text-slate-400">
                            {measurement.evidenceSummary}
                          </p>
                        )}
                        <PerformanceMeasurementReviewForm
                          measurementId={measurement.id}
                        />
                      </article>
                    ))}
                  {!workspace.recentMeasurements.some(
                    (measurement) =>
                      measurement.status === PerformanceMeasurementStatus.DRAFT,
                  ) && <Empty message="No draft measurements require review." />}
                </div>
              </section>
            </div>
          </section>

          <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
            <SectionHeader
              title="Indicator catalog"
              description="Retirement preserves historical targets, measurements, decisions, and activity records."
            />
            <div className="grid gap-3 p-6 md:grid-cols-2 xl:grid-cols-3">
              {workspace.indicators.map((indicator) => (
                <article
                  key={indicator.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{indicator.code} — {indicator.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {pretty(indicator.type)} · {pretty(indicator.source)} · {indicator.unit}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] ${
                        indicator.isActive
                          ? "bg-emerald-400/10 text-emerald-300"
                          : "bg-slate-400/10 text-slate-400"
                      }`}
                    >
                      {indicator.isActive ? "ACTIVE" : "RETIRED"}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    {indicator.owner?.name ?? "No owner"} · {indicator._count.targets} targets · {indicator._count.measurements} manual records
                  </p>
                  <PerformanceIndicatorStatusForm
                    indicatorId={indicator.id}
                    isActive={indicator.isActive}
                  />
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-sm text-slate-300">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3"
      >
        {children}
      </select>
    </label>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="px-6 py-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </div>
  );
}

function Header({ children }: { children: React.ReactNode }) {
  return <th className="px-6 py-4 font-medium">{children}</th>;
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-6 py-5 text-slate-300">{children}</td>;
}

function Rating({ value }: { value: PerformanceRating }) {
  const tones: Record<PerformanceRating, string> = {
    ON_TARGET: "bg-emerald-400/10 text-emerald-300",
    WATCH: "bg-yellow-400/10 text-yellow-300",
    OFF_TARGET: "bg-orange-400/10 text-orange-300",
    CRITICAL: "bg-red-400/10 text-red-300",
    NO_TARGET: "bg-slate-400/10 text-slate-300",
    NO_DATA: "bg-slate-700/40 text-slate-400",
  };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs ${tones[value]}`}>
      {pretty(value)}
    </span>
  );
}

function Empty({ message }: { message: string }) {
  return <p className="p-8 text-center text-sm text-slate-500">{message}</p>;
}

function EmptyCard({ message }: { message: string }) {
  return (
    <section className="grid min-h-[340px] place-items-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-sm text-slate-500">
      {message}
    </section>
  );
}

function formatValue(value: number | null, unit: string) {
  return value === null
    ? "—"
    : `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${unit}`;
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function pretty(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function scopeLabel(measurement: {
  site: { name: string } | null;
  department: { name: string } | null;
}) {
  if (measurement.department) {
    return `${measurement.site?.name ?? "Site"} — ${measurement.department.name}`;
  }
  return measurement.site?.name ?? "Organization";
}
