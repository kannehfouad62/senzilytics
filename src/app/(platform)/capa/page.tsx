import {
    CapaDashboardAction,
    getCapaDashboardData,
  } from "@/core/analytics/capa-analytics.service";
  import { CapaDashboardCharts } from "@/features/capa/capa-dashboard";
  import { requirePermission } from "@/lib/permissions";
  import { getCurrentUserTenant } from "@/lib/tenant";
  import {
    PermissionKey,
    RiskLevel,
    Status,
  } from "@prisma/client";
  import {
    CalendarClock,
    CheckCircle2,
    CircleAlert,
    ClipboardCheck,
    Gauge,
    ShieldAlert,
    Timer,
    TrendingUp,
  } from "lucide-react";
  import Link from "next/link";
  
  export default async function CapaDashboardPage() {
    await requirePermission(
      PermissionKey.VIEW_REPORTS
    );
  
    const { organizationId } =
      await getCurrentUserTenant();
  
    const dashboard =
      await getCapaDashboardData(
        organizationId
      );
  
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-sm text-cyan-300">
              <ClipboardCheck size={16} />
              Corrective and Preventive
              Action
            </p>
  
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              CAPA Dashboard
            </h1>
  
            <p className="mt-2 max-w-3xl text-slate-400">
              Monitor corrective-action
              ownership, risk, timeliness,
              aging, and closure performance
              across incidents, audits, and
              inspections.
            </p>
          </div>
  
          <Link
            href="/actions"
            className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5"
          >
            View All Actions
          </Link>
        </div>
  
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            label="Total CAPAs"
            value={
              dashboard.summary.total
            }
            icon={
              <ClipboardCheck
                size={20}
              />
            }
          />
  
          <SummaryCard
            label="Open"
            value={
              dashboard.summary.open +
              dashboard.summary
                .inProgress
            }
            icon={
              <Gauge size={20} />
            }
          />
  
          <SummaryCard
            label="Overdue"
            value={
              dashboard.summary.overdue
            }
            icon={
              <CircleAlert size={20} />
            }
            critical={
              dashboard.summary.overdue >
              0
            }
          />
  
          <SummaryCard
            label="High-risk open"
            value={
              dashboard.summary
                .highRiskOpen
            }
            icon={
              <ShieldAlert size={20} />
            }
            critical={
              dashboard.summary
                .highRiskOpen > 0
            }
          />
  
          <SummaryCard
            label="Due in 7 days"
            value={
              dashboard.summary
                .dueWithinSevenDays
            }
            icon={
              <CalendarClock
                size={20}
              />
            }
          />
        </div>
  
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <PerformanceCard
            label="Closure rate"
            value={`${dashboard.summary.closureRate}%`}
            description="Completed or closed corrective actions"
            icon={
              <CheckCircle2
                size={20}
              />
            }
          />
  
          <PerformanceCard
            label="Average age"
            value={`${dashboard.summary.averageAgeDays} days`}
            description="Average age of all corrective actions"
            icon={<Timer size={20} />}
          />
  
          <PerformanceCard
            label="Completed"
            value={String(
              dashboard.summary
                .completed +
                dashboard.summary.closed
            )}
            description="Corrective actions completed or formally closed"
            icon={
              <TrendingUp size={20} />
            }
          />
        </div>
  
        <div className="mt-8">
          <CapaDashboardCharts
            statusDistribution={
              dashboard.statusDistribution
            }
            riskDistribution={
              dashboard.riskDistribution
            }
            sourceDistribution={
              dashboard.sourceDistribution
            }
            agingDistribution={
              dashboard.agingDistribution
            }
            assigneeWorkload={
              dashboard.assigneeWorkload
            }
          />
        </div>
  
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Priority CAPAs
            </h2>
  
            <p className="mt-1 text-sm text-slate-400">
              Overdue, critical, and
              high-risk corrective actions
              requiring immediate management
              attention.
            </p>
          </div>
  
          <div className="mt-6 space-y-4">
            {dashboard.priorityActions.map(
              (action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                />
              )
            )}
  
            {dashboard.priorityActions
              .length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center">
                <CheckCircle2
                  size={32}
                  className="mx-auto text-green-300"
                />
  
                <p className="mt-3 text-sm text-slate-400">
                  No overdue or high-risk
                  corrective actions require
                  attention.
                </p>
              </div>
            )}
          </div>
        </section>
  
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white">
            Recently Created CAPAs
          </h2>
  
          <div className="mt-6 space-y-4">
            {dashboard.recentActions.map(
              (action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                />
              )
            )}
  
            {dashboard.recentActions
              .length === 0 && (
              <p className="text-sm text-slate-500">
                No corrective actions have
                been created.
              </p>
            )}
          </div>
        </section>
  
        <p className="mt-6 text-right text-xs text-slate-600">
          Generated{" "}
          {dashboard.generatedAt.toLocaleString(
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
  
          <div
            className={
              critical
                ? "text-red-300"
                : "text-cyan-300"
            }
          >
            {icon}
          </div>
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
    description,
    icon,
  }: {
    label: string;
    value: string;
    description: string;
    icon: React.ReactNode;
  }) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-2 text-cyan-300">
          {icon}
  
          <p className="text-sm font-medium">
            {label}
          </p>
        </div>
  
        <p className="mt-3 text-2xl font-semibold text-white">
          {value}
        </p>
  
        <p className="mt-1 text-xs text-slate-500">
          {description}
        </p>
      </div>
    );
  }
  
  function ActionCard({
    action,
  }: {
    action: CapaDashboardAction;
  }) {
    const isOverdue =
      action.status ===
        Status.OVERDUE ||
      (action.dueDate <
        new Date() &&
        action.status !==
          Status.COMPLETED &&
        action.status !==
          Status.CLOSED);
  
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <SourceBadge
                sourceType={
                  action.sourceType
                }
              />
  
              <RiskBadge
                riskLevel={
                  action.riskLevel
                }
              />
  
              <StatusBadge
                status={action.status}
              />
            </div>
  
            <h3 className="mt-3 font-semibold text-white">
              {action.title}
            </h3>
  
            <p className="mt-2 text-sm text-slate-400">
              {action.description ||
                "No description provided."}
            </p>
          </div>
  
          {isOverdue && (
            <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs font-medium text-red-300">
              OVERDUE
            </span>
          )}
        </div>
  
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <Detail
            label="Assigned to"
            value={
              action.assignedTo.name
            }
          />
  
          <Detail
            label="Source"
            value={action.sourceTitle}
          />
  
          <Detail
            label="Due date"
            value={action.dueDate.toLocaleString(
              "en-US",
              {
                dateStyle: "medium",
                timeStyle: "short",
              }
            )}
          />
  
          <Detail
            label="Created"
            value={action.createdAt.toLocaleDateString(
              "en-US"
            )}
          />
        </div>
  
        <div className="mt-4 flex justify-end">
          <Link
            href={action.sourceLink}
            className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-medium text-cyan-300 transition hover:bg-cyan-400/20"
          >
            View Source Record
          </Link>
        </div>
      </div>
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
  
  function SourceBadge({
    sourceType,
  }: {
    sourceType: string;
  }) {
    return (
      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
        {sourceType.replaceAll(
          "_",
          " "
        )}
      </span>
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
  
  function StatusBadge({
    status,
  }: {
    status: Status;
  }) {
    return (
      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
        {status.replaceAll(
          "_",
          " "
        )}
      </span>
    );
  }