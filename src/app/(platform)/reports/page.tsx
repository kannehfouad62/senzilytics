import type {
  ExecutiveReportAttentionItem,
} from "@/core/analytics/executive-report.service";
import { getExecutiveReportData } from "@/core/analytics/executive-report.service";
import { ExecutiveReportCharts } from "@/features/reports/executive-report-charts";
import { PrintReportButton } from "@/features/reports/print-report-button";
import { ExecutiveReportAiInsights } from "@/features/reports/executive-report-ai-insights";
import { getRiskAnalyticsData } from "@/core/analytics/risk-analytics.service";
import { ExecutiveRiskSummary } from "@/features/reports/executive-risk-summary";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  PermissionKey,
  RiskLevel,
} from "@prisma/client";
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  SearchCheck,
  ShieldCheck,
  TimerReset,
  Workflow,
} from "lucide-react";
import Link from "next/link";

export const dynamic =
  "force-dynamic";

type ReportsPageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
    siteId?: string;
  }>;
};

function getDefaultFromDate() {
  const value = new Date();

  value.setMonth(
    value.getMonth() - 11
  );

  value.setDate(1);

  value.setHours(
    0,
    0,
    0,
    0
  );

  return value;
}

function getDefaultToDate() {
  const value = new Date();

  value.setHours(
    23,
    59,
    59,
    999
  );

  return value;
}

function parseReportDate(
  rawValue: string | undefined,
  fallback: Date,
  endOfDay = false
) {
  if (!rawValue) {
    return fallback;
  }

  const value = new Date(
    `${rawValue}T${
      endOfDay
        ? "23:59:59.999"
        : "00:00:00.000"
    }`
  );

  if (
    Number.isNaN(
      value.getTime()
    )
  ) {
    return fallback;
  }

  return value;
}

function formatInputDate(
  value: Date
) {
  return value
    .toISOString()
    .slice(0, 10);
}

export default async function ReportsPage({
  searchParams,
}: ReportsPageProps) {
  await requirePermission(
    PermissionKey.VIEW_REPORTS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const params =
    await searchParams;

  const from = parseReportDate(
    params.from,
    getDefaultFromDate()
  );

  const to = parseReportDate(
    params.to,
    getDefaultToDate(),
    true
  );

  const siteId =
    params.siteId?.trim() ||
    null;

    const [
      sites,
      report,
      riskAnalytics,
    ] = await Promise.all([
      prisma.site.findMany({
        where: {
          organizationId,
        },
    
        select: {
          id: true,
          name: true,
        },
    
        orderBy: {
          name: "asc",
        },
      }),
    
      getExecutiveReportData({
        organizationId,
        userId: user.id,
        from,
        to,
        siteId,
      }),
    
      getRiskAnalyticsData(
        organizationId
      ),
    ]);

  return (
    <div className="print:bg-white print:text-black">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-5 print:mb-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300 print:text-slate-600">
            <BarChart3 size={16} />
            Executive Intelligence
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight print:text-3xl print:text-black">
            Executive EHS Report
          </h1>

          <p className="mt-2 max-w-3xl text-slate-400 print:text-slate-600">
            Review enterprise EHS performance,
            risk exposure, CAPA effectiveness,
            audit and inspection completion,
            compliance obligations, training,
            and workflow performance.
          </p>

          <p className="mt-3 text-xs text-slate-500 print:text-slate-500">
            Reporting period:{" "}
            {report.filters.from.toLocaleDateString(
              "en-US"
            )}{" "}
            through{" "}
            {report.filters.to.toLocaleDateString(
              "en-US"
            )}
            {report.filters.siteName
              ? ` · ${report.filters.siteName}`
              : " · All sites"}
          </p>
        </div>

        <PrintReportButton />
      </div>

      <form
        method="get"
        className="mb-8 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 md:grid-cols-4 print:hidden"
      >
        <label className="text-sm text-slate-300">
          From

          <input
            type="date"
            name="from"
            defaultValue={
              formatInputDate(from)
            }
            className={inputClass}
          />
        </label>

        <label className="text-sm text-slate-300">
          To

          <input
            type="date"
            name="to"
            defaultValue={
              formatInputDate(to)
            }
            className={inputClass}
          />
        </label>

        <label className="text-sm text-slate-300">
          Site

          <select
            name="siteId"
            defaultValue={
              siteId ?? ""
            }
            className={inputClass}
          >
            <option value="">
              All sites
            </option>

            {sites.map(
              (site) => (
                <option
                  key={site.id}
                  value={site.id}
                >
                  {site.name}
                </option>
              )
            )}
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Generate Report
          </button>
        </div>
        </form>

<ExecutiveReportAiInsights
  from={formatInputDate(from)}
  to={formatInputDate(to)}
  siteId={report.filters.siteId}
  siteName={report.filters.siteName}
/>

<div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5 print:grid-cols-5">
        <SummaryCard
          label="Incidents"
          value={
            report.summary
              .totalIncidents
          }
          detail={`${report.summary.highRiskIncidents} high risk`}
          icon={
            <AlertTriangle
              size={20}
            />
          }
        />

        <SummaryCard
          label="Open CAPAs"
          value={
            report.summary
              .openCorrectiveActions
          }
          detail={`${report.summary.overdueCorrectiveActions} overdue`}
          critical={
            report.summary
              .overdueCorrectiveActions >
            0
          }
          icon={
            <ClipboardCheck
              size={20}
            />
          }
        />

        <SummaryCard
          label="Audits"
          value={
            report.summary
              .totalAudits
          }
          detail={`${report.summary.auditCompletionRate}% completed`}
          icon={
            <SearchCheck
              size={20}
            />
          }
        />

        <SummaryCard
          label="Inspections"
          value={
            report.summary
              .totalInspections
          }
          detail={`${report.summary.inspectionCompletionRate}% completed`}
          icon={
            <ShieldCheck
              size={20}
            />
          }
        />

        <SummaryCard
          label="Overdue Exposure"
          value={
            report.summary
              .totalOverdueExposure
          }
          detail="All overdue obligations"
          critical={
            report.summary
              .totalOverdueExposure >
            0
          }
          icon={
            <FileWarning
              size={20}
            />
          }
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-4 print:grid-cols-4">
        <PerformanceCard
          label="CAPA closure"
          value={`${report.summary.correctiveActionClosureRate}%`}
          icon={
            <CheckCircle2
              size={18}
            />
          }
        />

        <PerformanceCard
          label="Audit completion"
          value={`${report.summary.auditCompletionRate}%`}
          icon={
            <CalendarCheck
              size={18}
            />
          }
        />

        <PerformanceCard
          label="Inspection completion"
          value={`${report.summary.inspectionCompletionRate}%`}
          icon={
            <ShieldCheck
              size={18}
            />
          }
        />

        <PerformanceCard
          label="Training completion"
          value={`${report.summary.trainingCompletionRate}%`}
          icon={
            <CheckCircle2
              size={18}
            />
          }
        />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4 print:grid-cols-4">
        <OperationalMetric
          label="Open investigations"
          value={
            report.summary
              .openInvestigations
          }
        />

        <OperationalMetric
          label="Open audit findings"
          value={
            report.summary
              .openAuditFindings
          }
        />

        <OperationalMetric
          label="Open inspection findings"
          value={
            report.summary
              .openInspectionFindings
          }
        />

        <OperationalMetric
          label="Overdue workflow steps"
          value={
            report.summary
              .overdueWorkflowSteps
          }
        />
      </div>

      <div className="mt-8">
        <ExecutiveReportCharts
          monthlyTrend={
            report.monthlyTrend
          }
          incidentRiskDistribution={
            report.incidentRiskDistribution
          }
          incidentStatusDistribution={
            report.incidentStatusDistribution
          }
          correctiveActionStatusDistribution={
            report.correctiveActionStatusDistribution
          }
          correctiveActionRiskDistribution={
            report.correctiveActionRiskDistribution
          }
          correctiveActionSourceDistribution={
            report.correctiveActionSourceDistribution
          }
          auditStatusDistribution={
            report.auditStatusDistribution
          }
          inspectionStatusDistribution={
            report.inspectionStatusDistribution
          }
          sitePerformance={
            report.sitePerformance
          }
        />
      </div>

      <ExecutiveRiskSummary
  analytics={riskAnalytics}
/>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 print:break-before-page print:border-slate-300 print:bg-white">
        <div className="flex items-center gap-3">
          <TimerReset
            size={21}
            className="text-red-300 print:text-slate-700"
          />

          <div>
            <h2 className="text-xl font-semibold text-white print:text-black">
              Management Attention Register
            </h2>

            <p className="mt-1 text-sm text-slate-400 print:text-slate-600">
              High-risk incidents, overdue
              investigations, overdue CAPAs,
              incomplete audits and inspections,
              overdue findings, workflow steps,
              and compliance obligations.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {report.managementAttention.map(
            (item) => (
              <AttentionCard
                key={`${item.type}-${item.id}`}
                item={item}
              />
            )
          )}

          {report.managementAttention
            .length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center print:border-slate-300">
              <CheckCircle2
                size={32}
                className="mx-auto text-green-300"
              />

              <p className="mt-3 text-sm text-slate-400 print:text-slate-600">
                No material management
                attention items were identified
                for this reporting period.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 print:border-slate-300 print:bg-white">
        <div className="flex items-center gap-3">
          <Workflow
            size={21}
            className="text-cyan-300 print:text-slate-700"
          />

          <div>
            <h2 className="text-xl font-semibold text-white print:text-black">
              Governance Summary
            </h2>

            <p className="mt-1 text-sm text-slate-400 print:text-slate-600">
              Workflow, compliance, training,
              investigation, audit, and
              inspection oversight for the
              selected period.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4 print:grid-cols-4">
          <OperationalMetric
            label="Active workflows"
            value={
              report.summary
                .activeWorkflows
            }
          />

          <OperationalMetric
            label="Compliance items"
            value={
              report.summary
                .totalComplianceItems
            }
          />

          <OperationalMetric
            label="Overdue compliance"
            value={
              report.summary
                .overdueComplianceItems
            }
          />

          <OperationalMetric
            label="Training records"
            value={
              report.summary
                .totalTrainingRecords
            }
          />
        </div>
      </section>

      <p className="mt-6 text-right text-xs text-slate-600 print:text-slate-500">
        Generated{" "}
        {report.generatedAt.toLocaleString(
          "en-US"
        )}
      </p>
    </div>
  );
}

const inputClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-cyan-400/50";

function SummaryCard({
  label,
  value,
  detail,
  icon,
  critical = false,
}: {
  label: string;
  value: number;
  detail: string;
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

        <div
          className={
            critical
              ? "text-red-300 print:text-red-700"
              : "text-cyan-300 print:text-slate-700"
          }
        >
          {icon}
        </div>
      </div>

      <p className="mt-3 text-3xl font-semibold text-white print:text-black">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function PerformanceCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 print:border-slate-300 print:bg-white">
      <div className="flex items-center gap-2 text-cyan-300 print:text-slate-700">
        {icon}

        <p className="text-xs font-medium">
          {label}
        </p>
      </div>

      <p className="mt-2 text-xl font-semibold text-white print:text-black">
        {value}
      </p>
    </div>
  );
}

function OperationalMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 print:border-slate-300 print:bg-white">
      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-xl font-semibold text-white print:text-black">
        {value}
      </p>
    </div>
  );
}

function AttentionCard({
  item,
}: {
  item:
    ExecutiveReportAttentionItem;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 print:break-inside-avoid print:border-slate-300 print:bg-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300 print:border-slate-400 print:bg-white print:text-black">
              {item.type.replaceAll(
                "_",
                " "
              )}
            </span>

            {item.riskLevel && (
              <RiskBadge
                riskLevel={
                  item.riskLevel
                }
              />
            )}
          </div>

          <h3 className="mt-3 font-semibold text-white print:text-black">
            {item.title}
          </h3>

          <p className="mt-2 text-sm text-slate-400 print:text-slate-600">
            {item.description}
          </p>
        </div>

        <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs text-red-300 print:border-red-400 print:bg-white print:text-red-700">
          {item.status.replaceAll(
            "_",
            " "
          )}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4 print:grid-cols-4">
        <Detail
          label="Site"
          value={
            item.siteName ||
            "Not applicable"
          }
        />

        <Detail
          label="Owner"
          value={
            item.ownerName ||
            "Not assigned"
          }
        />

        <Detail
          label="Due"
          value={
            item.dueDate
              ? item.dueDate.toLocaleString(
                  "en-US",
                  {
                    dateStyle:
                      "medium",
                    timeStyle:
                      "short",
                  }
                )
              : "Not set"
          }
        />

        <div className="flex items-end print:hidden">
          <Link
            href={item.link}
            className="w-full rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-center text-xs font-medium text-cyan-300 transition hover:bg-cyan-400/20"
          >
            View Record
          </Link>
        </div>
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
      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-sm text-slate-200 print:text-black">
        {value}
      </p>
    </div>
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