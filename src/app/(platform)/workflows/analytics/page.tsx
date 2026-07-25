import { WorkflowProcessIntelligenceCharts } from "@/core/workflow/workflow-process-intelligence-charts";
import {
  getWorkflowProcessIntelligence,
  parseWorkflowProcessFilters,
} from "@/core/workflow/workflow-process-intelligence.service";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  Gauge,
  GitBranch,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function WorkflowAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    days?: string;
    templateId?: string;
  }>;
}) {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);
  const { organizationId } = await getCurrentUserTenant();
  const params = await searchParams;
  const filters = parseWorkflowProcessFilters(params);
  const intelligence = await getWorkflowProcessIntelligence({
    organizationId,
    filters,
  });
  const selectedTemplate = intelligence.templates.find(
    (template) => template.id === filters.templateId,
  );
  const exportQuery = new URLSearchParams({
    days: String(filters.days),
    ...(selectedTemplate ? { templateId: selectedTemplate.id } : {}),
  }).toString();
  const summary = intelligence.summary;

  const metrics = [
    {
      label: "Started",
      value: summary.started.toLocaleString(),
      note: `Past ${filters.days} days`,
      icon: GitBranch,
      tone: "text-cyan-300",
    },
    {
      label: "Completion rate",
      value: formatPercent(summary.completionRate),
      note: "Started-period cohort",
      icon: CheckCircle2,
      tone: "text-emerald-300",
    },
    {
      label: "Active workflows",
      value: summary.active.toLocaleString(),
      note: "Current workload",
      icon: Workflow,
      tone: "text-sky-300",
    },
    {
      label: "Median cycle time",
      value: formatHours(summary.medianCycleHours),
      note: `P90 ${formatHours(summary.p90CycleHours)}`,
      icon: Clock3,
      tone: "text-violet-300",
    },
    {
      label: "SLA adherence",
      value: formatPercent(summary.slaAdherenceRate),
      note: `${summary.slaBreaches} measured breaches`,
      icon: ShieldCheck,
      tone:
        summary.slaAdherenceRate !== null &&
        summary.slaAdherenceRate < 80
          ? "text-amber-300"
          : "text-emerald-300",
    },
    {
      label: "Overdue steps",
      value: summary.overdueActiveSteps.toLocaleString(),
      note: "Active and past due",
      icon: AlertTriangle,
      tone:
        summary.overdueActiveSteps > 0
          ? "text-red-300"
          : "text-emerald-300",
    },
    {
      label: "Outcome reliability",
      value: formatPercent(summary.outcomeSuccessRate),
      note: `${summary.outcomesFailed} failed · ${summary.outcomesAwaitingApproval} awaiting review`,
      icon: Gauge,
      tone:
        summary.outcomesFailed > 0
          ? "text-amber-300"
          : "text-emerald-300",
    },
    {
      label: "Rejection rate",
      value: formatPercent(summary.rejectionRate),
      note: "Recorded workflow decisions",
      icon: AlertTriangle,
      tone:
        summary.rejectionRate !== null && summary.rejectionRate > 10
          ? "text-amber-300"
          : "text-emerald-300",
    },
    {
      label: "Trigger reliability",
      value: formatPercent(summary.automationSuccessRate),
      note: selectedTemplate
        ? "Available for all templates"
        : "Terminal trigger events",
      icon: Gauge,
      tone:
        summary.automationSuccessRate !== null &&
        summary.automationSuccessRate < 95
          ? "text-amber-300"
          : "text-emerald-300",
    },
    {
      label: "Automation coverage",
      value: formatPercent(summary.automationCoverageRate),
      note: `${summary.automatedTemplates}/${summary.activeTemplates} active templates`,
      icon: BarChart3,
      tone: "text-cyan-300",
    },
  ];

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div>
          <Link
            href="/workflows"
            className="mb-5 inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"
          >
            <ArrowLeft size={16} />
            Back to workflows
          </Link>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <BarChart3 size={16} />
            Workflow Process Intelligence
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Automation Performance
          </h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Measure workflow throughput, cycle time, SLA adherence,
            rejection and rework signals, bottleneck steps, workload, and
            governed outcome reliability.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            {filters.from.toLocaleDateString()} through{" "}
            {filters.to.toLocaleDateString()}
            {selectedTemplate
              ? ` · ${selectedTemplate.name}`
              : " · All workflow templates"}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/workflows/sla"
            className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/20"
          >
            Open SLA Operations
          </Link>
          <a
            href={`/api/workflows/analytics/export?${exportQuery}`}
            className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
          >
            <Download size={17} />
            Export CSV
          </a>
        </div>
      </div>

      <form
        method="get"
        className="mb-8 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
      >
        <label className="text-sm text-slate-300">
          Reporting range
          <select
            name="days"
            defaultValue={String(filters.days)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-cyan-400"
          >
            <option value="30">Past 30 days</option>
            <option value="90">Past 90 days</option>
            <option value="180">Past 180 days</option>
            <option value="365">Past 365 days</option>
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Workflow template
          <select
            name="templateId"
            defaultValue={selectedTemplate?.id ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-cyan-400"
          >
            <option value="">All templates</option>
            {intelligence.templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} · {pretty(template.entityType)}
                {template.isActive ? "" : " · Inactive"}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="self-end rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
        >
          Apply Filters
        </button>
      </form>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article
              key={metric.label}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl"
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
              <p className="mt-1 text-3xl font-bold text-white">
                {metric.value}
              </p>
            </article>
          );
        })}
      </div>

      {selectedTemplate && (
        <p className="mt-5 rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-4 text-sm text-amber-100">
          Automation-event delivery is shown only in the all-template view
          because durable trigger events can evaluate more than one template.
          Workflow, step, and outcome metrics remain scoped to{" "}
          {selectedTemplate.name}.
        </p>
      )}

      <div className="mt-8">
        <WorkflowProcessIntelligenceCharts
          trend={intelligence.trend}
          bottlenecks={intelligence.bottlenecks}
          outcomes={intelligence.outcomeReliability}
          ownerWorkload={intelligence.ownerWorkload}
        />
      </div>

      <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
        <SectionHeader
          title="Template Performance"
          description="Compare throughput, current workload, cycle time, SLA delivery, and rejection signals."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-slate-300">
              <tr>
                <Header>Template</Header>
                <Header>Started</Header>
                <Header>Completed</Header>
                <Header>Active</Header>
                <Header>Completion</Header>
                <Header>Avg cycle</Header>
                <Header>SLA adherence</Header>
                <Header>Rejection</Header>
              </tr>
            </thead>
            <tbody>
              {intelligence.templatePerformance.map((template) => (
                <tr
                  key={template.templateId}
                  className="border-b border-white/5 hover:bg-white/[0.03]"
                >
                  <td className="px-6 py-5">
                    <Link
                      href={`/workflows/${template.templateId}`}
                      className="font-medium text-white hover:text-cyan-300"
                    >
                      {template.templateName}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">
                      {pretty(template.entityType)}
                    </p>
                  </td>
                  <Cell>{template.started}</Cell>
                  <Cell>{template.completed}</Cell>
                  <Cell>{template.active}</Cell>
                  <Cell>{formatPercent(template.completionRate)}</Cell>
                  <Cell>{formatHours(template.averageCycleHours)}</Cell>
                  <Cell>{formatPercent(template.slaAdherenceRate)}</Cell>
                  <Cell>{formatPercent(template.rejectionRate)}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {intelligence.templatePerformance.length === 0 && (
          <Empty message="No template activity exists for this selection." />
        )}
      </section>

      <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
        <SectionHeader
          title="Bottleneck Register"
          description="Ranks steps using overdue workload, rejection volume, and observed completion duration. P90 is the time within which 90% of measured step completions occurred."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-slate-300">
              <tr>
                <Header>Step</Header>
                <Header>Completed</Header>
                <Header>Average</Header>
                <Header>P90</Header>
                <Header>Active</Header>
                <Header>Overdue</Header>
                <Header>Rejections</Header>
              </tr>
            </thead>
            <tbody>
              {intelligence.bottlenecks.map((item) => (
                <tr
                  key={item.templateStepId}
                  className="border-b border-white/5 hover:bg-white/[0.03]"
                >
                  <td className="px-6 py-5">
                    <Link
                      href={`/workflows/${item.templateId}`}
                      className="font-medium text-white hover:text-cyan-300"
                    >
                      {item.stepName}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.templateName}
                    </p>
                  </td>
                  <Cell>{item.completedCount}</Cell>
                  <Cell>{formatHours(item.averageCycleHours)}</Cell>
                  <Cell>{formatHours(item.p90CycleHours)}</Cell>
                  <Cell>{item.activeCount}</Cell>
                  <td
                    className={`px-6 py-5 ${
                      item.overdueActiveCount > 0
                        ? "text-red-300"
                        : "text-slate-300"
                    }`}
                  >
                    {item.overdueActiveCount}
                  </td>
                  <Cell>{item.rejectionCount}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {intelligence.bottlenecks.length === 0 && (
          <Empty message="No measured workflow-step durations are available." />
        )}
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <article className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
          <SectionHeader
            title="Outcome Reliability"
            description="Execution reliability excludes human-rejected outcomes from the success-rate denominator."
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5 text-slate-300">
                <tr>
                  <Header>Outcome</Header>
                  <Header>Queued</Header>
                  <Header>Completed</Header>
                  <Header>Failed</Header>
                  <Header>Awaiting</Header>
                  <Header>Success</Header>
                </tr>
              </thead>
              <tbody>
                {intelligence.outcomeReliability.map((item) => (
                  <tr
                    key={item.outcomeType}
                    className="border-b border-white/5"
                  >
                    <td className="px-6 py-4 text-white">
                      {pretty(item.outcomeType)}
                    </td>
                    <Cell>{item.queued}</Cell>
                    <Cell>{item.completed}</Cell>
                    <td
                      className={`px-6 py-4 ${
                        item.failed ? "text-red-300" : "text-slate-300"
                      }`}
                    >
                      {item.failed}
                    </td>
                    <Cell>{item.awaitingApproval}</Cell>
                    <Cell>{formatPercent(item.successRate)}</Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {intelligence.outcomeReliability.length === 0 && (
            <Empty message="No workflow outcomes were queued in this period." />
          )}
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
          <SectionHeader
            title="Trigger Delivery Health"
            description={
              intelligence.automation.isTemplateScoped
                ? "Return to all templates to view organization-wide trigger delivery."
                : "Durable workflow automation events received and processed in the reporting period."
            }
          />
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <MiniMetric
              label="Events received"
              value={intelligence.automation.received}
            />
            <MiniMetric
              label="Workflows started"
              value={intelligence.automation.workflowsStarted}
            />
            <MiniMetric
              label="Processed"
              value={intelligence.automation.processed}
            />
            <MiniMetric
              label="Failed"
              value={intelligence.automation.failed}
              danger={intelligence.automation.failed > 0}
            />
            <MiniMetric
              label="Pending"
              value={intelligence.automation.pending}
            />
            <MiniMetric
              label="Average attempts"
              value={intelligence.automation.averageAttempts}
            />
          </div>
        </article>
      </section>
    </div>
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
    <div className="border-b border-white/10 p-6">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-4xl text-sm text-slate-400">
        {description}
      </p>
    </div>
  );
}

function Header({ children }: { children: React.ReactNode }) {
  return <th className="px-6 py-4 font-medium">{children}</th>;
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-6 py-5 text-slate-300">{children}</td>;
}

function Empty({ message }: { message: string }) {
  return <p className="p-8 text-center text-sm text-slate-400">{message}</p>;
}

function MiniMetric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold ${
          danger ? "text-red-300" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function formatPercent(value: number | null) {
  return value === null ? "Not measured" : `${value}%`;
}

function formatHours(value: number | null) {
  if (value === null) return "Not measured";
  if (value < 24) return `${value}h`;
  return `${Math.round((value / 24) * 10) / 10}d`;
}

function pretty(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
