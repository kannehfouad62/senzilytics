import type {
    RiskAnalyticsAttentionItem,
    RiskAnalyticsData,
  } from "@/core/analytics/risk-analytics.service";
  import {
    AlertTriangle,
    CalendarClock,
    ShieldAlert,
    ShieldCheck,
    Target,
    UserRoundX,
  } from "lucide-react";
  import Link from "next/link";
  
  type ExecutiveRiskSummaryProps = {
    analytics: RiskAnalyticsData;
  };
  
  export function ExecutiveRiskSummary({
    analytics,
  }: ExecutiveRiskSummaryProps) {
    return (
      <section className="mt-8 rounded-3xl border border-purple-400/20 bg-purple-400/5 p-6 print:break-before-page print:border-slate-300 print:bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-purple-400/10 p-3 text-purple-300 print:bg-white print:text-slate-700">
              <ShieldAlert size={22} />
            </div>
  
            <div>
              <p className="text-sm text-purple-300 print:text-slate-600">
                Enterprise Risk Management
              </p>
  
              <h2 className="mt-1 text-xl font-semibold text-white print:text-black">
                Enterprise Risk Exposure
              </h2>
  
              <p className="mt-1 max-w-3xl text-sm text-slate-400 print:text-slate-600">
                Current and residual exposure, overdue reviews,
                control performance, ownership gaps, and priority
                risks requiring management attention.
              </p>
            </div>
          </div>
  
          <Link
            href="/risks/report"
            className="rounded-xl border border-purple-400/20 bg-purple-400/10 px-4 py-3 text-sm text-purple-300 transition hover:bg-purple-400/20 print:hidden"
          >
            Open Risk Report
          </Link>
        </div>
  
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6 print:grid-cols-3">
          <RiskMetric
            label="Active risks"
            value={analytics.summary.activeRisks}
            icon={<ShieldAlert size={18} />}
          />
  
          <RiskMetric
            label="Critical residual"
            value={analytics.summary.criticalResidualRisks}
            icon={<AlertTriangle size={18} />}
            critical={
              analytics.summary.criticalResidualRisks > 0
            }
          />
  
          <RiskMetric
            label="High residual"
            value={analytics.summary.highResidualRisks}
            icon={<Target size={18} />}
            critical={
              analytics.summary.highResidualRisks > 0
            }
          />
  
          <RiskMetric
            label="Overdue reviews"
            value={analytics.summary.overdueReviews}
            icon={<CalendarClock size={18} />}
            critical={
              analytics.summary.overdueReviews > 0
            }
          />
  
          <RiskMetric
            label="Overdue controls"
            value={analytics.summary.overdueControls}
            icon={<ShieldCheck size={18} />}
            critical={
              analytics.summary.overdueControls > 0
            }
          />
  
          <RiskMetric
            label="Unassigned risks"
            value={analytics.summary.unassignedRisks}
            icon={<UserRoundX size={18} />}
            critical={
              analytics.summary.unassignedRisks > 0
            }
          />
        </div>
  
        <div className="mt-4 grid gap-4 md:grid-cols-4 print:grid-cols-4">
          <PerformanceMetric
            label="Average current score"
            value={analytics.summary.averageCurrentScore}
          />
  
          <PerformanceMetric
            label="Average residual score"
            value={analytics.summary.averageResidualScore}
          />
  
          <PerformanceMetric
            label="Expected risk reduction"
            value={`${analytics.summary.riskReductionPercentage}%`}
          />
  
          <PerformanceMetric
            label="Weak or ineffective controls"
            value={analytics.summary.ineffectiveControls}
            critical={
              analytics.summary.ineffectiveControls > 0
            }
          />
        </div>
  
        <div className="mt-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-white print:text-black">
                Highest Residual Risks
              </h3>
  
              <p className="mt-1 text-sm text-slate-400 print:text-slate-600">
                Active risks ranked by expected residual exposure.
              </p>
            </div>
  
            <Link
              href="/risks/dashboard"
              className="text-sm text-purple-300 transition hover:text-purple-200 print:hidden"
            >
              View dashboard
            </Link>
          </div>
  
          <div className="mt-4 space-y-3">
            {analytics.topResidualRisks
              .slice(0, 5)
              .map((risk) => (
                <ExecutiveRiskCard
                  key={risk.id}
                  risk={risk}
                />
              ))}
  
            {analytics.topResidualRisks.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-500 print:border-slate-300">
                No active residual risks are available.
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }
  
  function RiskMetric({
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
        className={`rounded-2xl border p-4 print:border-slate-300 print:bg-white ${
          critical
            ? "border-red-400/20 bg-red-400/10"
            : "border-white/10 bg-slate-950/50"
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">{label}</p>
  
          <span
            className={
              critical
                ? "text-red-300 print:text-red-700"
                : "text-purple-300 print:text-slate-700"
            }
          >
            {icon}
          </span>
        </div>
  
        <p className="mt-3 text-2xl font-semibold text-white print:text-black">
          {value}
        </p>
      </div>
    );
  }
  
  function PerformanceMetric({
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
            : "border-white/10 bg-white/5"
        }`}
      >
        <p className="text-xs text-slate-500">{label}</p>
  
        <p className="mt-2 text-xl font-semibold text-white print:text-black">
          {value}
        </p>
      </div>
    );
  }
  
  function ExecutiveRiskCard({
    risk,
  }: {
    risk: RiskAnalyticsAttentionItem;
  }) {
    return (
      <article className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 print:break-inside-avoid print:border-slate-300 print:bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-xs text-purple-300 print:border-slate-400 print:bg-white print:text-black">
                {risk.reference}
              </span>
  
              <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs text-red-300 print:border-red-400 print:bg-white print:text-red-700">
                {risk.residualRiskLevel}
              </span>
  
              {risk.overdueReview && (
                <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs text-orange-300 print:border-orange-400 print:bg-white print:text-orange-700">
                  REVIEW OVERDUE
                </span>
              )}
            </div>
  
            <h4 className="mt-3 font-medium text-white print:text-black">
              {risk.title}
            </h4>
  
            <p className="mt-2 text-sm text-slate-400 print:text-slate-600">
              {risk.reason}
            </p>
  
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5 print:grid-cols-3">
              <Detail label="Site" value={risk.siteName} />
              <Detail label="Owner" value={risk.ownerName} />
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
            className="rounded-xl border border-purple-400/20 bg-purple-400/10 px-4 py-3 text-sm text-purple-300 transition hover:bg-purple-400/20 print:hidden"
          >
            View Risk
          </Link>
        </div>
      </article>
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
        <p className="text-xs text-slate-500">{label}</p>
  
        <p className="mt-1 text-sm text-slate-200 print:text-black">
          {value}
        </p>
      </div>
    );
  }