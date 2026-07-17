import type {
    RiskAnalyticsAttentionItem,
  } from "@/core/analytics/risk-analytics.service";
  import { getRiskAnalyticsData } from "@/core/analytics/risk-analytics.service";
  import { RiskAnalyticsCharts } from "@/features/risks/risk-analytics-charts";
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
  
  export const dynamic =
    "force-dynamic";
  
  export default async function RiskDashboardPage() {
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
      <div>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <Link
              href="/risks"
              className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
            >
              <ArrowLeft size={16} />
              Risk register
            </Link>
  
            <p className="mt-6 flex items-center gap-2 text-sm text-cyan-300">
              <Gauge size={16} />
              Enterprise Risk Intelligence
            </p>
  
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              Risk Dashboard
            </h1>
  
            <p className="mt-2 max-w-3xl text-slate-400">
              Monitor current and residual
              exposure, control performance,
              overdue reviews, risk
              concentration, and management
              attention across the enterprise.
            </p>
          </div>
  
          <Link
            href="/risks/new"
            className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Register Risk
          </Link>
        </div>
  
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <SummaryCard
            label="Active risks"
            value={
              analytics.summary
                .activeRisks
            }
            icon={
              <ShieldAlert
                size={20}
              />
            }
          />
  
          <SummaryCard
            label="Critical residual"
            value={
              analytics.summary
                .criticalResidualRisks
            }
            icon={
              <AlertTriangle
                size={20}
              />
            }
            critical={
              analytics.summary
                .criticalResidualRisks >
              0
            }
          />
  
          <SummaryCard
            label="High residual"
            value={
              analytics.summary
                .highResidualRisks
            }
            icon={
              <Target size={20} />
            }
            critical={
              analytics.summary
                .highResidualRisks >
              0
            }
          />
  
          <SummaryCard
            label="Overdue reviews"
            value={
              analytics.summary
                .overdueReviews
            }
            icon={
              <CalendarClock
                size={20}
              />
            }
            critical={
              analytics.summary
                .overdueReviews >
              0
            }
          />
  
          <SummaryCard
            label="Overdue controls"
            value={
              analytics.summary
                .overdueControls
            }
            icon={
              <ShieldCheck
                size={20}
              />
            }
            critical={
              analytics.summary
                .overdueControls >
              0
            }
          />
  
          <SummaryCard
            label="Unassigned risks"
            value={
              analytics.summary
                .unassignedRisks
            }
            icon={
              <UserRoundX
                size={20}
              />
            }
            critical={
              analytics.summary
                .unassignedRisks >
              0
            }
          />
        </div>
  
        <div className="mt-4 grid gap-4 md:grid-cols-4">
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
                .ineffectiveControls >
              0
            }
          />
        </div>
  
        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <RiskHeatMap
            title="Current Risk Heat Map"
            description="Active risk concentration based on current likelihood and impact."
            cells={
              analytics.currentHeatMap
            }
          />
  
          <RiskHeatMap
            title="Residual Risk Heat Map"
            description="Expected exposure after planned and existing controls."
            cells={
              analytics.residualHeatMap
            }
          />
        </div>
  
        <div className="mt-8">
          <RiskAnalyticsCharts
            categoryDistribution={
              analytics.categoryDistribution
            }
            statusDistribution={
              analytics.statusDistribution
            }
            currentRiskDistribution={
              analytics.currentRiskDistribution
            }
            residualRiskDistribution={
              analytics.residualRiskDistribution
            }
            controlEffectivenessDistribution={
              analytics.controlEffectivenessDistribution
            }
            controlHierarchyDistribution={
              analytics.controlHierarchyDistribution
            }
            sitePerformance={
              analytics.sitePerformance
            }
          />
        </div>
  
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white">
            Top Residual Risks
          </h2>
  
          <p className="mt-1 text-sm text-slate-400">
            Active risks ranked by residual
            score after expected treatments.
          </p>
  
          <div className="mt-6 space-y-4">
            {analytics.topResidualRisks.map(
              (risk) => (
                <RiskAttentionCard
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
  
        <section className="mt-8 rounded-3xl border border-red-400/20 bg-red-400/5 p-6">
          <h2 className="text-xl font-semibold text-white">
            Management Attention
          </h2>
  
          <p className="mt-1 text-sm text-slate-400">
            High residual risks, overdue
            reviews, overdue controls, and
            unassigned ownership.
          </p>
  
          <div className="mt-6 space-y-4">
            {analytics.managementAttention.map(
              (risk) => (
                <RiskAttentionCard
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
  
        <p className="mt-6 text-right text-xs text-slate-600">
          Analytics generated{" "}
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
        className={`rounded-3xl border p-5 ${
          critical
            ? "border-red-400/20 bg-red-400/10"
            : "border-white/10 bg-white/5"
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            {label}
          </p>
  
          <span
            className={
              critical
                ? "text-red-300"
                : "text-cyan-300"
            }
          >
            {icon}
          </span>
        </div>
  
        <p className="mt-3 text-3xl font-semibold text-white">
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
        className={`rounded-2xl border p-4 ${
          critical
            ? "border-red-400/20 bg-red-400/10"
            : "border-white/10 bg-slate-950/50"
        }`}
      >
        <p className="text-xs text-slate-500">
          {label}
        </p>
  
        <p className="mt-2 text-xl font-semibold text-white">
          {value}
        </p>
      </div>
    );
  }
  
  function RiskAttentionCard({
    risk,
  }: {
    risk:
      RiskAnalyticsAttentionItem;
  }) {
    return (
      <article className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                {risk.reference}
              </span>
  
              <RiskBadge
                riskLevel={
                  risk.residualRiskLevel
                }
              />
  
              {risk.overdueReview && (
                <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs text-red-300">
                  REVIEW OVERDUE
                </span>
              )}
            </div>
  
            <h3 className="mt-3 font-semibold text-white">
              {risk.title}
            </h3>
  
            <p className="mt-2 text-sm text-slate-400">
              {risk.reason}
            </p>
  
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Detail
                label="Site"
                value={risk.siteName}
              />
  
              <Detail
                label="Owner"
                value={risk.ownerName}
              />
  
              <Detail
                label="Current"
                value={`${risk.currentScore} · ${risk.currentRiskLevel}`}
              />
  
              <Detail
                label="Residual"
                value={`${risk.residualScore} · ${risk.residualRiskLevel}`}
              />
  
              <Detail
                label="Controls"
                value={`${risk.openControls} open · ${risk.overdueControls} overdue`}
              />
            </div>
          </div>
  
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
        className={`rounded-full border px-3 py-1 text-xs ${className}`}
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
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <p className="text-xs text-slate-500">
          {label}
        </p>
  
        <p className="mt-1 text-sm text-slate-200">
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
      <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-slate-500">
        {message}
      </div>
    );
  }