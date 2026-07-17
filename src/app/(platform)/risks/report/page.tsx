import type {
    RiskAnalyticsAttentionItem,
    RiskAnalyticsSiteItem,
  } from "@/core/analytics/risk-analytics.service";
  import { getRiskAnalyticsData } from "@/core/analytics/risk-analytics.service";
  import { PrintRiskReportButton } from "@/features/risks/print-risk-report-button";
  import { RiskHeatMap } from "@/features/risks/risk-heat-map";
  import { requirePermission } from "@/lib/permissions";
  import { getCurrentUserTenant } from "@/lib/tenant";
  import {
    PermissionKey,
    RiskLevel,
  } from "@prisma/client";
  import {
    AlertTriangle,
    ArrowLeft,
    CalendarClock,
    Gauge,
    ShieldAlert,
    ShieldCheck,
    Target,
    UserRoundX,
  } from "lucide-react";
  import Link from "next/link";
  
  export const dynamic = "force-dynamic";
  
  export default async function EnterpriseRiskReportPage() {
    await requirePermission(
      PermissionKey.VIEW_RISKS
    );
  
    const { organizationId } =
      await getCurrentUserTenant();
  
    const analytics =
      await getRiskAnalyticsData(
        organizationId
      );
  
    return (
      <div className="print:bg-white print:text-black">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-5 print:mb-5">
          <div>
            <Link
              href="/risks/dashboard"
              className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white print:hidden"
            >
              <ArrowLeft size={16} />
              Risk dashboard
            </Link>
  
            <p className="mt-6 flex items-center gap-2 text-sm text-cyan-300 print:mt-0 print:text-slate-600">
              <ShieldAlert size={16} />
              Enterprise Risk Management
            </p>
  
            <h1 className="mt-2 text-4xl font-bold tracking-tight print:text-3xl print:text-black">
              Enterprise Risk Report
            </h1>
  
            <p className="mt-2 max-w-3xl text-slate-400 print:text-slate-600">
              Current and residual risk
              exposure, control performance,
              overdue reviews, ownership gaps,
              site concentration, and
              management priorities.
            </p>
  
            <p className="mt-3 text-xs text-slate-500">
              Generated{" "}
              {analytics.generatedAt.toLocaleString(
                "en-US"
              )}
            </p>
          </div>
  
          <PrintRiskReportButton />
        </div>
  
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6 print:grid-cols-3">
          <SummaryCard
            label="Active risks"
            value={
              analytics.summary
                .activeRisks
            }
            icon={
              <ShieldAlert size={20} />
            }
          />
  
          <SummaryCard
            label="Critical residual"
            value={
              analytics.summary
                .criticalResidualRisks
            }
            critical={
              analytics.summary
                .criticalResidualRisks > 0
            }
            icon={
              <AlertTriangle size={20} />
            }
          />
  
          <SummaryCard
            label="High residual"
            value={
              analytics.summary
                .highResidualRisks
            }
            critical={
              analytics.summary
                .highResidualRisks > 0
            }
            icon={<Target size={20} />}
          />
  
          <SummaryCard
            label="Overdue reviews"
            value={
              analytics.summary
                .overdueReviews
            }
            critical={
              analytics.summary
                .overdueReviews > 0
            }
            icon={
              <CalendarClock size={20} />
            }
          />
  
          <SummaryCard
            label="Overdue controls"
            value={
              analytics.summary
                .overdueControls
            }
            critical={
              analytics.summary
                .overdueControls > 0
            }
            icon={
              <ShieldCheck size={20} />
            }
          />
  
          <SummaryCard
            label="Unassigned risks"
            value={
              analytics.summary
                .unassignedRisks
            }
            critical={
              analytics.summary
                .unassignedRisks > 0
            }
            icon={
              <UserRoundX size={20} />
            }
          />
        </section>
  
        <section className="mt-4 grid gap-4 md:grid-cols-4 print:grid-cols-4">
          <PerformanceCard
            label="Average current score"
            value={
              analytics.summary
                .averageCurrentScore
            }
          />
  
          <PerformanceCard
            label="Average residual score"
            value={
              analytics.summary
                .averageResidualScore
            }
          />
  
          <PerformanceCard
            label="Expected risk reduction"
            value={`${analytics.summary.riskReductionPercentage}%`}
          />
  
          <PerformanceCard
            label="Weak or ineffective controls"
            value={
              analytics.summary
                .ineffectiveControls
            }
            critical={
              analytics.summary
                .ineffectiveControls > 0
            }
          />
        </section>
  
        <section className="mt-8 grid gap-6 xl:grid-cols-2 print:block">
          <div className="print:mb-8 print:break-inside-avoid">
            <RiskHeatMap
              title="Current Risk Heat Map"
              description="Active risk concentration based on the current likelihood and impact assessments."
              cells={
                analytics.currentHeatMap
              }
            />
          </div>
  
          <div className="print:break-before-page print:break-inside-avoid">
            <RiskHeatMap
              title="Residual Risk Heat Map"
              description="Expected risk concentration after existing and planned controls are implemented."
              cells={
                analytics.residualHeatMap
              }
            />
          </div>
        </section>
  
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 print:break-before-page print:border-slate-300 print:bg-white">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300 print:bg-white print:text-slate-700">
              <Gauge size={21} />
            </div>
  
            <div>
              <h2 className="text-xl font-semibold text-white print:text-black">
                Site Risk Exposure
              </h2>
  
              <p className="mt-1 text-sm text-slate-400 print:text-slate-600">
                Risk concentration, overdue
                reviews, and control exposure
                by site.
              </p>
            </div>
          </div>
  
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[900px] border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">
                    Site
                  </th>
                  <th className="px-4 py-2">
                    Active
                  </th>
                  <th className="px-4 py-2">
                    Critical
                  </th>
                  <th className="px-4 py-2">
                    High residual
                  </th>
                  <th className="px-4 py-2">
                    Overdue reviews
                  </th>
                  <th className="px-4 py-2">
                    Open controls
                  </th>
                  <th className="px-4 py-2">
                    Overdue controls
                  </th>
                  <th className="px-4 py-2">
                    Exposure score
                  </th>
                </tr>
              </thead>
  
              <tbody>
                {analytics.sitePerformance.map(
                  (site) => (
                    <SitePerformanceRow
                      key={
                        site.siteId ??
                        "ENTERPRISE"
                      }
                      site={site}
                    />
                  )
                )}
              </tbody>
            </table>
  
            {analytics.sitePerformance
              .length === 0 && (
              <EmptyState message="No site risk information is available." />
            )}
          </div>
        </section>
  
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 print:break-before-page print:border-slate-300 print:bg-white">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-orange-400/10 p-3 text-orange-300 print:bg-white print:text-slate-700">
              <Target size={21} />
            </div>
  
            <div>
              <h2 className="text-xl font-semibold text-white print:text-black">
                Top Residual Risks
              </h2>
  
              <p className="mt-1 text-sm text-slate-400 print:text-slate-600">
                Active risks ranked by
                expected residual exposure.
              </p>
            </div>
          </div>
  
          <div className="mt-6 space-y-4">
            {analytics.topResidualRisks.map(
              (risk) => (
                <RiskReportCard
                  key={risk.id}
                  risk={risk}
                />
              )
            )}
  
            {analytics.topResidualRisks
              .length === 0 && (
              <EmptyState message="No active residual risks are available." />
            )}
          </div>
        </section>
  
        <section className="mt-8 rounded-3xl border border-red-400/20 bg-red-400/5 p-6 print:break-before-page print:border-slate-300 print:bg-white">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-red-400/10 p-3 text-red-300 print:bg-white print:text-red-700">
              <AlertTriangle size={21} />
            </div>
  
            <div>
              <h2 className="text-xl font-semibold text-white print:text-black">
                Management Attention
              </h2>
  
              <p className="mt-1 text-sm text-slate-400 print:text-slate-600">
                High residual exposure,
                overdue reviews, overdue
                controls, and missing risk
                ownership.
              </p>
            </div>
          </div>
  
          <div className="mt-6 space-y-4">
            {analytics.managementAttention.map(
              (risk) => (
                <RiskReportCard
                  key={risk.id}
                  risk={risk}
                />
              )
            )}
  
            {analytics.managementAttention
              .length === 0 && (
              <EmptyState message="No material risk-management attention items were identified." />
            )}
          </div>
        </section>
  
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 print:border-slate-300 print:bg-white">
          <h2 className="text-xl font-semibold text-white print:text-black">
            Control Governance Summary
          </h2>
  
          <div className="mt-5 grid gap-4 md:grid-cols-4 print:grid-cols-4">
            <PerformanceCard
              label="Total controls"
              value={
                analytics.summary
                  .totalControls
              }
            />
  
            <PerformanceCard
              label="Open controls"
              value={
                analytics.summary
                  .openControls
              }
            />
  
            <PerformanceCard
              label="Overdue controls"
              value={
                analytics.summary
                  .overdueControls
              }
              critical={
                analytics.summary
                  .overdueControls > 0
              }
            />
  
            <PerformanceCard
              label="Weak or ineffective"
              value={
                analytics.summary
                  .ineffectiveControls
              }
              critical={
                analytics.summary
                  .ineffectiveControls > 0
              }
            />
          </div>
        </section>
  
        <p className="mt-6 text-right text-xs text-slate-600 print:text-slate-500">
          Senzilytics Enterprise Risk Report ·{" "}
          {analytics.generatedAt.toLocaleString(
            "en-US"
          )}
        </p>
      </div>
    );
  }
  
  function SummaryCard({
    label,
    value,
    icon,
    critical = false,
  }: {
    label: string;
    value: number;
    icon: React.ReactNode;
    critical?: boolean;
  }) {
    return (
      <div
        className={`rounded-3xl border p-5 print:border-slate-300 print:bg-white ${
          critical
            ? "border-red-400/20 bg-red-400/10"
            : "border-white/10 bg-white/5"
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400 print:text-slate-600">
            {label}
          </p>
  
          <span
            className={
              critical
                ? "text-red-300 print:text-red-700"
                : "text-cyan-300 print:text-slate-700"
            }
          >
            {icon}
          </span>
        </div>
  
        <p className="mt-3 text-3xl font-semibold text-white print:text-black">
          {value}
        </p>
      </div>
    );
  }
  
  function PerformanceCard({
    label,
    value,
    critical = false,
  }: {
    label: string;
    value: number | string;
    critical?: boolean;
  }) {
    return (
      <div
        className={`rounded-2xl border p-4 print:border-slate-300 print:bg-white ${
          critical
            ? "border-red-400/20 bg-red-400/10"
            : "border-white/10 bg-slate-950/50"
        }`}
      >
        <p className="text-xs text-slate-500">
          {label}
        </p>
  
        <p className="mt-2 text-xl font-semibold text-white print:text-black">
          {value}
        </p>
      </div>
    );
  }
  
  function SitePerformanceRow({
    site,
  }: {
    site: RiskAnalyticsSiteItem;
  }) {
    return (
      <tr className="rounded-2xl bg-slate-950/50 text-sm text-slate-300 print:bg-white print:text-black">
        <td className="rounded-l-2xl border-y border-l border-white/10 px-4 py-4 font-medium text-white print:border-slate-300 print:text-black">
          {site.siteName}
        </td>
  
        <TableCell value={site.activeRisks} />
        <TableCell value={site.criticalRisks} />
        <TableCell
          value={site.highResidualRisks}
        />
        <TableCell
          value={site.overdueReviews}
          critical={
            site.overdueReviews > 0
          }
        />
        <TableCell
          value={site.openControls}
        />
        <TableCell
          value={site.overdueControls}
          critical={
            site.overdueControls > 0
          }
        />
  
        <td className="rounded-r-2xl border-y border-r border-white/10 px-4 py-4 font-semibold text-cyan-300 print:border-slate-300 print:text-black">
          {site.exposureScore}
        </td>
      </tr>
    );
  }
  
  function TableCell({
    value,
    critical = false,
  }: {
    value: number;
    critical?: boolean;
  }) {
    return (
      <td
        className={`border-y border-white/10 px-4 py-4 print:border-slate-300 ${
          critical
            ? "font-semibold text-red-300 print:text-red-700"
            : ""
        }`}
      >
        {value}
      </td>
    );
  }
  
  function RiskReportCard({
    risk,
  }: {
    risk: RiskAnalyticsAttentionItem;
  }) {
    return (
      <article className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 print:break-inside-avoid print:border-slate-300 print:bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300 print:border-slate-400 print:bg-white print:text-black">
                {risk.reference}
              </span>
  
              <RiskBadge
                riskLevel={
                  risk.residualRiskLevel
                }
              />
  
              {risk.overdueReview && (
                <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs text-red-300 print:border-red-400 print:bg-white print:text-red-700">
                  REVIEW OVERDUE
                </span>
              )}
            </div>
  
            <h3 className="mt-3 font-semibold text-white print:text-black">
              {risk.title}
            </h3>
  
            <p className="mt-2 text-sm text-slate-400 print:text-slate-600">
              {risk.reason}
            </p>
          </div>
  
          <div className="text-right">
            <p className="text-xs text-slate-500">
              Residual score
            </p>
  
            <p className="mt-1 text-3xl font-bold text-white print:text-black">
              {risk.residualScore}
            </p>
          </div>
        </div>
  
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6 print:grid-cols-3">
          <Detail
            label="Site"
            value={risk.siteName}
          />
  
          <Detail
            label="Owner"
            value={risk.ownerName}
          />
  
          <Detail
            label="Category"
            value={formatEnum(
              risk.category
            )}
          />
  
          <Detail
            label="Current risk"
            value={`${risk.currentScore} · ${risk.currentRiskLevel}`}
          />
  
          <Detail
            label="Residual risk"
            value={`${risk.residualScore} · ${risk.residualRiskLevel}`}
          />
  
          <Detail
            label="Controls"
            value={`${risk.openControls} open · ${risk.overdueControls} overdue`}
          />
        </div>
  
        <div className="mt-4 flex justify-end print:hidden">
          <Link
            href={risk.link}
            className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-300 transition hover:bg-cyan-400/20"
          >
            View Risk
          </Link>
        </div>
      </article>
    );
  }
  
  function RiskBadge({
    riskLevel,
  }: {
    riskLevel: RiskLevel;
  }) {
    const className =
      riskLevel ===
      RiskLevel.CRITICAL
        ? "border-purple-400/20 bg-purple-400/10 text-purple-300"
        : riskLevel ===
            RiskLevel.HIGH
          ? "border-red-400/20 bg-red-400/10 text-red-300"
          : riskLevel ===
              RiskLevel.MEDIUM
            ? "border-orange-400/20 bg-orange-400/10 text-orange-300"
            : "border-green-400/20 bg-green-400/10 text-green-300";
  
    return (
      <span
        className={`rounded-full border px-3 py-1 text-xs print:bg-white ${className}`}
      >
        {riskLevel}
      </span>
    );
  }
  
  function Detail({
    label,
    value,
  }: {
    label: string;
    value: string;
  }) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 print:border-slate-300 print:bg-white">
        <p className="text-xs text-slate-500">
          {label}
        </p>
  
        <p className="mt-1 text-sm text-slate-200 print:text-black">
          {value}
        </p>
      </div>
    );
  }
  
  function EmptyState({
    message,
  }: {
    message: string;
  }) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-slate-500 print:border-slate-300">
        {message}
      </div>
    );
  }
  
  function formatEnum(
    value: string
  ) {
    return value
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(
        /\b\w/g,
        (character) =>
          character.toUpperCase()
      );
  }