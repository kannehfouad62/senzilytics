import {
    getMocExecutiveDashboard,
  } from "@/core/analytics/moc-dashboard.service";
  import { MocDashboardCharts } from "@/features/moc/moc-dashboard-charts";
  import { requirePermission } from "@/lib/permissions";
  import { MocExecutiveAiSummary } from "@/features/moc/moc-executive-ai-summary";
  import { getCurrentUserTenant } from "@/lib/tenant";
  import {
    MocPriority,
    PermissionKey,
    RiskLevel,
  } from "@prisma/client";
  import {
    AlertTriangle,
    ArrowLeft,
    CalendarClock,
    CheckCircle2,
    Clock3,
    Gauge,
    ListChecks,
    ShieldAlert,
    TimerReset,
    TrendingUp,
    UserRoundCheck,
    Workflow,
  } from "lucide-react";
  import Link from "next/link";
  
  export const dynamic =
    "force-dynamic";
  
  export default async function MocDashboardPage() {
    await requirePermission(
      PermissionKey.VIEW_MOC
    );
  
    const {
      organizationId,
    } = await getCurrentUserTenant();
  
    const data =
      await getMocExecutiveDashboard(
        organizationId
      );
  
    const summary =
      data.summary;
  
    return (
      <div>
        <Link
          href="/moc"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to MOC register
        </Link>
  
        <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-sm text-cyan-300">
              <Gauge size={16} />
              Executive Change Intelligence
            </p>
  
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              MOC Executive Dashboard
            </h1>
  
            <p className="mt-2 max-w-3xl text-slate-400">
              Monitor workflow volume,
              approval bottlenecks,
              implementation workload,
              overdue exposure,
              temporary-change
              expirations, site risk, and
              closure performance.
            </p>
          </div>
  
          <Link
            href="/moc/new"
            className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Create Change
          </Link>
        </div>
  
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Active Changes"
            value={
              summary.activeChanges
            }
            note={`${summary.totalChanges} total registered`}
            icon={<Workflow size={21} />}
          />
  
          <MetricCard
            title="Pending Approvals"
            value={
              summary.pendingApprovals
            }
            note="Awaiting decisions"
            icon={
              <UserRoundCheck
                size={21}
              />
            }
            warning={
              summary.pendingApprovals >
              0
            }
          />
  
          <MetricCard
            title="Overdue Tasks"
            value={
              summary.overdueTasks
            }
            note="Implementation exposure"
            icon={
              <ListChecks size={21} />
            }
            critical={
              summary.overdueTasks >
              0
            }
          />
  
          <MetricCard
            title="Overdue Changes"
            value={
              summary.overdueChanges
            }
            note="Past planned completion"
            icon={
              <CalendarClock
                size={21}
              />
            }
            critical={
              summary.overdueChanges >
              0
            }
          />
  
          <MetricCard
            title="High-Risk Changes"
            value={
              summary.highRiskChanges
            }
            note="High and critical residual risk"
            icon={
              <ShieldAlert size={21} />
            }
            critical={
              summary.highRiskChanges >
              0
            }
          />
  
          <MetricCard
            title="Temporary Expiring"
            value={
              summary
                .temporaryExpiringWithin30Days
            }
            note={`${summary.temporaryExpiringWithin7Days} within seven days`}
            icon={
              <TimerReset size={21} />
            }
            warning={
              summary
                .temporaryExpiringWithin30Days >
              0
            }
          />
  
          <MetricCard
            title="In Verification"
            value={
              summary.inVerification
            }
            note="Awaiting final validation"
            icon={
              <CheckCircle2
                size={21}
              />
            }
          />
  
          <MetricCard
            title="Closed This Month"
            value={
              summary.closedThisMonth
            }
            note="Verified and completed"
            icon={
              <TrendingUp size={21} />
            }
          />
        </div>
  
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
  <PerformanceMetric
    title="Average Approval Time"
    value={`${summary.averageApprovalDays} days`}
    icon={<Clock3 size={20} />}
  />

  <PerformanceMetric
    title="Average Completion Time"
    value={`${summary.averageCompletionDays} days`}
    icon={
      <CalendarClock
        size={20}
      />
    }
  />

  <PerformanceMetric
    title="Expired Temporary Changes"
    value={String(
      summary.expiredTemporaryChanges
    )}
    icon={
      <AlertTriangle
        size={20}
      />
    }
    critical={
      summary.expiredTemporaryChanges >
      0
    }
  />

  <PerformanceMetric
    title="Total Temporary Changes"
    value={String(
      summary.temporaryChanges
    )}
    icon={
      <TimerReset size={20} />
    }
  />
</div>

<div className="mt-8">
  <MocExecutiveAiSummary />
</div>

<div className="mt-8">
  <MocDashboardCharts
    data={data}
  />
</div>
  
        <div className="mt-8 grid gap-7 xl:grid-cols-2">
          <DashboardTable
            title="Longest Pending Approvals"
            description="Approval requests with the longest elapsed waiting time."
            emptyMessage="No approvals are currently pending."
          >
            {data.pendingApprovals.map(
              (approval) => (
                <Link
                  key={
                    approval.id
                  }
                  href={`/moc/${approval.mocId}`}
                  className="block rounded-2xl border border-white/10 bg-slate-950/50 p-5 transition hover:border-cyan-400/30"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-cyan-300">
                        {
                          approval.mocReference
                        }
                      </p>
  
                      <h3 className="mt-1 font-semibold text-white">
                        {
                          approval.mocTitle
                        }
                      </h3>
                    </div>
  
                    <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs text-orange-300">
                      {
                        approval.waitingDays
                      }{" "}
                      day(s)
                    </span>
                  </div>
  
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Detail
                      label="Approval Role"
                      value={formatEnum(
                        approval.role
                      )}
                    />
  
                    <Detail
                      label="Approver"
                      value={
                        approval.approver
                      }
                    />
  
                    <Detail
                      label="Site"
                      value={
                        approval.site
                      }
                    />
  
                    <Detail
                      label="Sequence"
                      value={String(
                        approval.sequence
                      )}
                    />
                  </div>
                </Link>
              )
            )}
          </DashboardTable>
  
          <DashboardTable
            title="Overdue MOC Tasks"
            description="Tasks that have passed their assigned completion dates."
            emptyMessage="No MOC tasks are currently overdue."
          >
            {data.overdueTasks.map(
              (task) => (
                <Link
                  key={task.id}
                  href={`/moc/${task.mocId}`}
                  className="block rounded-2xl border border-red-400/15 bg-red-400/5 p-5 transition hover:border-red-400/30"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-cyan-300">
                        {
                          task.mocReference
                        }
                      </p>
  
                      <h3 className="mt-1 font-semibold text-white">
                        {
                          task.taskTitle
                        }
                      </h3>
  
                      <p className="mt-1 text-sm text-slate-500">
                        {
                          task.mocTitle
                        }
                      </p>
                    </div>
  
                    <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs text-red-300">
                      {
                        task.daysOverdue
                      }{" "}
                      day(s) overdue
                    </span>
                  </div>
  
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Detail
                      label="Assigned To"
                      value={
                        task.assignedTo
                      }
                    />
  
                    <Detail
                      label="Due Date"
                      value={formatDate(
                        task.dueDate
                      )}
                    />
  
                    <Detail
                      label="Task Type"
                      value={formatEnum(
                        task.taskType
                      )}
                    />
  
                    <Detail
                      label="Site"
                      value={
                        task.site
                      }
                    />
                  </div>
                </Link>
              )
            )}
          </DashboardTable>
        </div>
  
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-orange-400/10 p-3 text-orange-300">
              <TimerReset size={21} />
            </div>
  
            <div>
              <h2 className="text-xl font-semibold text-white">
                Temporary Change Monitor
              </h2>
  
              <p className="mt-1 text-sm text-slate-400">
                Temporary changes that
                have expired or are due
                to expire within 30 days.
              </p>
            </div>
          </div>
  
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {data.temporaryChanges.map(
              (moc) => (
                <Link
                  key={moc.id}
                  href={`/moc/${moc.id}`}
                  className={`rounded-2xl border p-5 transition ${
                    moc.expirationCategory ===
                    "EXPIRED"
                      ? "border-red-400/20 bg-red-400/10 hover:border-red-400/40"
                      : moc.expirationCategory ===
                          "WITHIN_7_DAYS"
                        ? "border-orange-400/20 bg-orange-400/10 hover:border-orange-400/40"
                        : "border-yellow-400/20 bg-yellow-400/5 hover:border-yellow-400/40"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-cyan-300">
                        {moc.reference}
                      </p>
  
                      <h3 className="mt-1 font-semibold text-white">
                        {moc.title}
                      </h3>
                    </div>
  
                    <ExpirationBadge
                      daysUntilExpiration={
                        moc.daysUntilExpiration
                      }
                    />
                  </div>
  
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Detail
                      label="Expiration"
                      value={formatDate(
                        moc.expirationDate
                      )}
                    />
  
                    <Detail
                      label="Owner"
                      value={moc.owner}
                    />
  
                    <Detail
                      label="Site"
                      value={moc.site}
                    />
  
                    <Detail
                      label="Status"
                      value={formatEnum(
                        moc.status
                      )}
                    />
                  </div>
                </Link>
              )
            )}
  
            {data.temporaryChanges.length ===
              0 && (
              <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-slate-500 xl:col-span-2">
                No temporary changes expire
                within the next 30 days.
              </div>
            )}
          </div>
        </section>
  
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <h2 className="text-xl font-semibold text-white">
            Site Exposure Summary
          </h2>
  
          <p className="mt-1 text-sm text-slate-400">
            Active, overdue, and
            high-risk change exposure by
            site.
          </p>
  
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-500">
                  <th className="px-4 py-3 font-medium">
                    Site
                  </th>
  
                  <th className="px-4 py-3 font-medium">
                    Total
                  </th>
  
                  <th className="px-4 py-3 font-medium">
                    Active
                  </th>
  
                  <th className="px-4 py-3 font-medium">
                    Overdue
                  </th>
  
                  <th className="px-4 py-3 font-medium">
                    High Risk
                  </th>
                </tr>
              </thead>
  
              <tbody>
                {data.siteExposure.map(
                  (site) => (
                    <tr
                      key={site.siteId}
                      className="border-b border-white/5 text-slate-300"
                    >
                      <td className="px-4 py-4 font-medium text-white">
                        {
                          site.siteName
                        }
                      </td>
  
                      <td className="px-4 py-4">
                        {site.total}
                      </td>
  
                      <td className="px-4 py-4">
                        {site.active}
                      </td>
  
                      <td className="px-4 py-4">
                        <CountBadge
                          value={
                            site.overdue
                          }
                          critical={
                            site.overdue >
                            0
                          }
                        />
                      </td>
  
                      <td className="px-4 py-4">
                        <CountBadge
                          value={
                            site.highRisk
                          }
                          critical={
                            site.highRisk >
                            0
                          }
                        />
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
  
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <h2 className="text-xl font-semibold text-white">
            Recent Changes
          </h2>
  
          <p className="mt-1 text-sm text-slate-400">
            Most recently registered
            Management of Change records.
          </p>
  
          <div className="mt-6 grid gap-4">
            {data.recentChanges.map(
              (moc) => (
                <Link
                  key={moc.id}
                  href={`/moc/${moc.id}`}
                  className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 transition hover:border-cyan-400/30"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs font-semibold text-cyan-300">
                          {moc.reference}
                        </span>
  
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                          {formatEnum(
                            moc.status
                          )}
                        </span>
  
                        <PriorityBadge
                          priority={
                            moc.priority
                          }
                        />
                      </div>
  
                      <h3 className="mt-3 font-semibold text-white">
                        {moc.title}
                      </h3>
                    </div>
  
                    <RiskBadge
                      score={
                        moc.residualScore
                      }
                      riskLevel={
                        moc.residualRiskLevel
                      }
                    />
                  </div>
  
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Detail
                      label="Site"
                      value={moc.site}
                    />
  
                    <Detail
                      label="Owner"
                      value={moc.owner}
                    />
  
                    <Detail
                      label="Created"
                      value={formatDate(
                        moc.createdAt
                      )}
                    />
  
                    <Detail
                      label="Planned Completion"
                      value={
                        moc.plannedCompletionDate
                          ? formatDate(
                              moc.plannedCompletionDate
                            )
                          : "Not scheduled"
                      }
                    />
                  </div>
                </Link>
              )
            )}
          </div>
        </section>
  
        <p className="mt-6 text-right text-xs text-slate-600">
          Dashboard generated{" "}
          {new Date(
            data.generatedAt
          ).toLocaleString()}
        </p>
      </div>
    );
  }
  
  function MetricCard({
    title,
    value,
    note,
    icon,
    warning = false,
    critical = false,
  }: {
    title: string;
    value: number;
    note: string;
    icon: React.ReactNode;
    warning?: boolean;
    critical?: boolean;
  }) {
    const className =
      critical
        ? "border-red-400/20 bg-red-400/10"
        : warning
          ? "border-orange-400/20 bg-orange-400/10"
          : "border-white/10 bg-white/5";
  
    return (
      <div
        className={`rounded-3xl border p-5 ${className}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-400">
              {title}
            </p>
  
            <p className="mt-3 text-3xl font-bold text-white">
              {value}
            </p>
          </div>
  
          <div
            className={`rounded-xl p-2 ${
              critical
                ? "bg-red-400/10 text-red-300"
                : warning
                  ? "bg-orange-400/10 text-orange-300"
                  : "bg-cyan-400/10 text-cyan-300"
            }`}
          >
            {icon}
          </div>
        </div>
  
        <p className="mt-3 text-xs text-slate-500">
          {note}
        </p>
      </div>
    );
  }
  
  function PerformanceMetric({
    title,
    value,
    icon,
    critical = false,
  }: {
    title: string;
    value: string;
    icon: React.ReactNode;
    critical?: boolean;
  }) {
    return (
      <div
        className={`rounded-2xl border p-5 ${
          critical
            ? "border-red-400/20 bg-red-400/10"
            : "border-white/10 bg-slate-950/40"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={
              critical
                ? "text-red-300"
                : "text-purple-300"
            }
          >
            {icon}
          </span>
  
          <p className="text-sm text-slate-400">
            {title}
          </p>
        </div>
  
        <p className="mt-3 text-2xl font-semibold text-white">
          {value}
        </p>
      </div>
    );
  }
  
  function DashboardTable({
    title,
    description,
    emptyMessage,
    children,
  }: {
    title: string;
    description: string;
    emptyMessage: string;
    children: React.ReactNode;
  }) {
    const hasChildren =
      Array.isArray(children)
        ? children.length > 0
        : Boolean(children);
  
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
        <h2 className="text-xl font-semibold text-white">
          {title}
        </h2>
  
        <p className="mt-1 text-sm text-slate-400">
          {description}
        </p>
  
        <div className="mt-5 space-y-4">
          {hasChildren ? (
            children
          ) : (
            <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-slate-500">
              {emptyMessage}
            </div>
          )}
        </div>
      </section>
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
  
  function ExpirationBadge({
    daysUntilExpiration,
  }: {
    daysUntilExpiration: number;
  }) {
    if (
      daysUntilExpiration < 0
    ) {
      return (
        <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs text-red-300">
          Expired{" "}
          {Math.abs(
            daysUntilExpiration
          )}{" "}
          day(s) ago
        </span>
      );
    }
  
    return (
      <span
        className={`rounded-full border px-3 py-1 text-xs ${
          daysUntilExpiration <= 7
            ? "border-orange-400/20 bg-orange-400/10 text-orange-300"
            : "border-yellow-400/20 bg-yellow-400/10 text-yellow-300"
        }`}
      >
        {daysUntilExpiration} day(s)
        remaining
      </span>
    );
  }
  
  function CountBadge({
    value,
    critical = false,
  }: {
    value: number;
    critical?: boolean;
  }) {
    return (
      <span
        className={`inline-flex min-w-8 justify-center rounded-full border px-2 py-1 text-xs ${
          critical
            ? "border-red-400/20 bg-red-400/10 text-red-300"
            : "border-white/10 bg-white/5 text-slate-300"
        }`}
      >
        {value}
      </span>
    );
  }
  
  function PriorityBadge({
    priority,
  }: {
    priority: MocPriority;
  }) {
    const className =
      priority ===
      MocPriority.CRITICAL
        ? "border-purple-400/20 bg-purple-400/10 text-purple-300"
        : priority ===
            MocPriority.HIGH
          ? "border-red-400/20 bg-red-400/10 text-red-300"
          : priority ===
              MocPriority.MEDIUM
            ? "border-orange-400/20 bg-orange-400/10 text-orange-300"
            : "border-green-400/20 bg-green-400/10 text-green-300";
  
    return (
      <span
        className={`rounded-full border px-3 py-1 text-xs ${className}`}
      >
        {formatEnum(priority)}
      </span>
    );
  }
  
  function RiskBadge({
    score,
    riskLevel,
  }: {
    score: number;
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
      <div
        className={`rounded-2xl border px-4 py-3 text-center ${className}`}
      >
        <p className="text-xl font-bold">
          {score}
        </p>
  
        <p className="text-xs">
          {formatEnum(riskLevel)}
        </p>
      </div>
    );
  }
  
  function formatDate(
    value: Date
  ) {
    return value.toLocaleDateString(
      "en-US",
      {
        dateStyle: "medium",
      }
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