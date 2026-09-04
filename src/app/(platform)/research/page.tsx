import { ResearchPortfolioCharts } from "@/features/research/research-portfolio-charts";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { listResearchPortfolio } from "@/modules/research/research.service";
import { PermissionKey } from "@prisma/client";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarClock,
  FlaskConical,
  Plus,
  Repeat2,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ResearchPortfolioPage() {
  await requirePermission(PermissionKey.VIEW_RESEARCH);
  const [{ organizationId }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const portfolio = await listResearchPortfolio(organizationId);
  const canCreate = permissions.includes(PermissionKey.CREATE_RESEARCH_PROJECT);
  const statusData = groupCounts(
    portfolio.projects.map((project) => pretty(project.status)),
  );
  const methodologyData = groupCounts(
    portfolio.projects.map((project) => pretty(project.methodology)),
  );
  const metrics = [
    ["Controlled projects", portfolio.summary.total, FlaskConical],
    ["Active research", portfolio.summary.active, BarChart3],
    ["Awaiting approval", portfolio.summary.awaitingApproval, ShieldCheck],
    ["Commissioned", portfolio.summary.commissioned, Building2],
    ["Overdue", portfolio.summary.overdue, CalendarClock],
    ["Research clients", portfolio.summary.clients, Users],
  ] as const;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <FlaskConical size={17} />
            Governed Research Intelligence
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Research Portfolio
          </h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Manage commissioned and internal research from purpose and ownership
            through team execution, governed data, analysis and client-ready
            evidence.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/research/longitudinal"
            className="inline-flex items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-400/10 px-5 py-3 font-semibold text-violet-200"
          >
            <Repeat2 size={17} />
            Longitudinal studies
          </Link>
          <Link
            href="/research/panels"
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-5 py-3 font-semibold text-cyan-200"
          >
            <Users size={17} />
            Panels & quotas
          </Link>
          {canCreate ? (
            <Link
              href="/research/projects/new"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950"
            >
              <Plus size={17} />
              New research project
            </Link>
          ) : null}
        </div>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {metrics.map(([label, value, Icon]) => (
          <div
            key={label}
            className="rounded-2xl border border-white/10 bg-white/[.04] p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {label}
              </p>
              <Icon size={17} className="text-cyan-300" />
            </div>
            <p
              className={`mt-3 text-3xl font-bold ${label === "Overdue" && value > 0 ? "text-red-300" : "text-white"}`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-8">
        <ResearchPortfolioCharts
          statusData={
            statusData.length ? statusData : [{ name: "No projects", value: 0 }]
          }
          methodologyData={
            methodologyData.length
              ? methodologyData
              : [{ name: "No projects", value: 0 }]
          }
        />
      </div>
      <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[.035]">
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <div>
            <h2 className="text-xl font-semibold">
              Priority research register
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Project ownership, client, methodology and governance state remain
              visible together.
            </p>
          </div>
          <Link
            href="/research/projects"
            className="text-sm font-semibold text-cyan-300"
          >
            View all projects
          </Link>
        </div>
        <div className="divide-y divide-white/10">
          {portfolio.projects.slice(0, 8).map((project) => (
            <Link
              key={project.id}
              href={`/research/projects/${project.id}`}
              className="flex flex-wrap items-center justify-between gap-5 p-5 transition hover:bg-white/[.03]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Status value={project.status} />
                  <span className="text-xs text-slate-500">
                    {project.reference} · {pretty(project.methodology)}
                  </span>
                </div>
                <h3 className="mt-2 font-semibold">{project.title}</h3>
                <p className="mt-1 text-sm text-slate-400">
                  {project.client?.name ?? "Internal research"} · Manager{" "}
                  {project.projectManager.name}
                </p>
              </div>
              <div className="flex items-center gap-5 text-right text-xs text-slate-500">
                <div>
                  <p>{project._count.teamMembers} team members</p>
                  <p className="mt-1">{project._count.milestones} milestones</p>
                </div>
                <ArrowRight size={18} />
              </div>
            </Link>
          ))}
          {!portfolio.projects.length ? (
            <div className="p-12 text-center text-sm text-slate-400">
              No research projects have been created.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-200">
      {pretty(value)}
    </span>
  );
}
function groupCounts(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].map(([name, value]) => ({ name, value }));
}
function pretty(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
