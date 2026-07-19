import { ExecutiveDashboardCharts } from "@/core/analytics/executive-dashboard-charts";
import { getExecutiveDashboardData } from "@/core/analytics/dashboard.service";
import { getGlobalExecutivePortfolio } from "@/core/analytics/global-executive-dashboard.service";
import { GlobalExecutivePortfolio } from "@/core/analytics/global-executive-portfolio";
import { getCurrentUserTenant } from "@/lib/tenant";
import { OperationalDashboardCharts } from "@/core/analytics/operational-dashboard-charts";
import { PerformanceDashboardCharts } from "@/core/analytics/performance-dashboard-charts";
import {
  AlertTriangle,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CheckSquare,
  FileText,
  GitBranch,
  SearchCheck,
  ShieldAlert,
  Siren,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { organizationId, user } =
    await getCurrentUserTenant();

  const [dashboard, portfolio] = await Promise.all([
    getExecutiveDashboardData({ organizationId }),
    getGlobalExecutivePortfolio(organizationId),
  ]);

  const stats = [
    {
      title: "Open Incidents",
      value: dashboard.kpis.openIncidents,
      note: `${dashboard.kpis.incidentsThisMonth} this month`,
      icon: Siren,
      href: "/incidents",
    },
    {
      title: "High-Risk Incidents",
      value: dashboard.kpis.highRiskIncidents,
      note: "High and critical",
      icon: ShieldAlert,
      href: "/incidents",
    },
    {
      title: "Open Investigations",
      value: dashboard.kpis.openInvestigations,
      note: "Incomplete investigations",
      icon: SearchCheck,
      href: "/incidents",
    },
    {
      title: "Open Actions",
      value: dashboard.kpis.openCorrectiveActions,
      note: `${dashboard.kpis.overdueCorrectiveActions} overdue`,
      icon: CheckSquare,
      href: "/actions",
    },
    {
      title: "Active Workflows",
      value: dashboard.kpis.activeWorkflows,
      note: `${dashboard.kpis.overdueWorkflowSteps} overdue steps`,
      icon: GitBranch,
      href: "/workflows",
    },
    {
      title: "Active Documents",
      value: dashboard.kpis.activeDocuments,
      note: `${dashboard.kpis.documentsThisMonth} uploaded this month`,
      icon: FileText,
      href: "/documents",
    },

    {
      title: "Action Completion",
      value: `${dashboard.kpis.correctiveActionCompletionRate}%`,
      note: `${dashboard.kpis.completedCorrectiveActions} of ${dashboard.kpis.totalCorrectiveActions} completed`,
      icon: ChartNoAxesCombined,
      href: "/actions",
    },
  ];

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-cyan-300">
            Executive Overview
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
            Welcome back, {user.name}
          </h1>

          <p className="mt-2 max-w-3xl text-slate-400">
            Review operational risk, incident activity,
            corrective actions, workflows, and document
            performance across your organization.
          </p>
        </div>

        <p className="text-sm text-slate-500">
          Updated{" "}
          {dashboard.generatedAt.toLocaleString()}
        </p>
      </div>

      <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Link
              key={stat.title}
              href={stat.href}
              className="group rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl transition hover:border-cyan-400/30 hover:bg-white/[0.07]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-400">
                    {stat.title}
                  </p>

                  <p className="mt-3 text-4xl font-bold text-white">
                    {stat.value}
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    {stat.note}
                  </p>
                </div>

                <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300 transition group-hover:bg-cyan-400/20">
                  <Icon size={22} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <GlobalExecutivePortfolio modules={portfolio.modules} attentionCount={portfolio.attentionCount} />

      <ExecutiveDashboardCharts
        monthlyTrend={dashboard.charts.monthlyTrend}
        riskDistribution={
          dashboard.charts.riskDistribution
        }
      />

<div className="mt-8">
  <OperationalDashboardCharts
    sitePerformance={
      dashboard.charts.sitePerformance
    }
    actionAging={
      dashboard.charts.actionAging
    }
  />
</div>

<div className="mt-8">
  <PerformanceDashboardCharts
    incidentTypeDistribution={
      dashboard.charts.incidentTypeDistribution
    }
    actionStatusDistribution={
      dashboard.charts.actionStatusDistribution
    }
  />
</div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
              <BriefcaseBusiness size={21} />
            </div>

            <div>
              <h2 className="text-xl font-semibold text-white">
                Recent Incidents
              </h2>

              <p className="text-sm text-slate-400">
                Most recently reported events
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {dashboard.recentIncidents.map(
              (incident) => (
                <Link
                  key={incident.id}
                  href={`/incidents/${incident.id}`}
                  className="block rounded-2xl border border-white/10 bg-slate-950/40 p-4 transition hover:border-cyan-400/20 hover:bg-slate-950/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">
                        {incident.title}
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        {incident.site.name} · Reported by{" "}
                        {incident.reportedBy.name}
                      </p>
                    </div>

                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                      {incident.riskLevel}
                    </span>
                  </div>
                </Link>
              )
            )}

            {dashboard.recentIncidents.length ===
              0 && (
              <p className="rounded-2xl border border-white/10 bg-slate-950/40 p-6 text-center text-slate-400">
                No incidents have been reported.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-red-400/10 p-3 text-red-300">
              <AlertTriangle size={21} />
            </div>

            <div>
              <h2 className="text-xl font-semibold text-white">
                Overdue Corrective Actions
              </h2>

              <p className="text-sm text-slate-400">
                Immediate management attention required
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {dashboard.recentOverdueActions.map(
              (action) => (
                <Link
                  key={action.id}
                  href={
                    action.incident
                      ? `/incidents/${action.incident.id}`
                      : "/actions"
                  }
                  className="block rounded-2xl border border-red-400/20 bg-red-400/5 p-4 transition hover:bg-red-400/10"
                >
                  <p className="font-medium text-white">
                    {action.title}
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
  {action.incident?.title || "No linked incident"}
</p>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>
                      Owner: {action.assignedTo.name}
                    </span>

                    <span className="text-red-300">
                      Due:{" "}
                      {action.dueDate.toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              )
            )}

            {dashboard.recentOverdueActions.length ===
              0 && (
              <p className="rounded-2xl border border-white/10 bg-slate-950/40 p-6 text-center text-slate-400">
                There are no overdue corrective actions.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
