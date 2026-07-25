import { inspectProductionEnvironment } from "@/lib/production-env";
import { requirePlatformAdministrator } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { getScheduledJobHealth } from "@/modules/platform/scheduled-job-monitor.service";
import { getProductionReadinessPortfolio } from "@/modules/platform/production-readiness.service";
import { getPlatformReleaseMetrics } from "@/modules/platform/release-candidate.service";
import {
  TenantInvitationStatus,
  TenantOnboardingStatus,
} from "@prisma/client";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Rocket,
  ServerCog,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PlatformOperationsPage() {
  await requirePlatformAdministrator();
  const now = new Date();
  const [
    jobs,
    tenants,
    pendingInvitations,
    expiredInvitations,
    readinessPortfolio,
    releaseMetrics,
  ] =
    await Promise.all([
      getScheduledJobHealth(now),
      prisma.organization.findMany({
        where: { isDemo: false },
        select: {
          id: true,
          contractedUserMinimum: true,
          onboardingPlan: { select: { status: true } },
          _count: { select: { users: { where: { isActive: true } } } },
        },
      }),
      prisma.tenantInvitation.count({
        where: {
          status: TenantInvitationStatus.PENDING,
          expiresAt: { gt: now },
        },
      }),
      prisma.tenantInvitation.count({
        where: {
          status: TenantInvitationStatus.PENDING,
          expiresAt: { lte: now },
        },
      }),
      getProductionReadinessPortfolio(),
      getPlatformReleaseMetrics(),
    ]);
  const environment = inspectProductionEnvironment();
  const activeUsers = tenants.reduce(
    (total, tenant) => total + tenant._count.users,
    0,
  );
  const contractedSeats = tenants.reduce(
    (total, tenant) => total + (tenant.contractedUserMinimum ?? 0),
    0,
  );
  const liveTenants = tenants.filter(
    (tenant) => tenant.onboardingPlan?.status === TenantOnboardingStatus.LIVE,
  ).length;
  const blockedTenants = tenants.filter(
    (tenant) => tenant.onboardingPlan?.status === TenantOnboardingStatus.BLOCKED,
  ).length;
  const unhealthyJobs = jobs.filter((job) =>
    ["FAILED", "STALE", "NEVER_RUN"].includes(job.status),
  ).length;
  const approvedReadiness = readinessPortfolio.filter(
    (review) => review.status === "APPROVED",
  ).length;
  const readinessAlerts = readinessPortfolio.filter(
    (review) =>
      review.status === "REJECTED" ||
      review.failedControls > 0 ||
      review.conditionalControls > 0 ||
      review.overdueControls > 0,
  ).length;
  const unassessedTenants = Math.max(
    tenants.length - readinessPortfolio.length,
    0,
  );
  return (
    <div>
      <p className="flex items-center gap-2 text-sm text-cyan-300">
        <ServerCog size={17} /> Senzilytics Platform Administration
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">
        Production operations
      </h1>
      <p className="mt-2 max-w-3xl text-slate-400">
        Monitor tenant launch readiness, scheduled processing, production
        configuration, and customer-access signals without exposing secrets.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric
          icon={Users}
          label="Production tenants"
          value={tenants.length.toString()}
          note={`${liveTenants} formally live · ${blockedTenants} blocked`}
        />
        <Metric
          icon={Activity}
          label="Active users"
          value={activeUsers.toString()}
          note={
            contractedSeats
              ? `${contractedSeats} contracted minimum seats`
              : "Contracted seats not recorded"
          }
        />
        <Metric
          icon={Clock3}
          label="Pending invitations"
          value={pendingInvitations.toString()}
          note={`${expiredInvitations} expired pending invitation${expiredInvitations === 1 ? "" : "s"}`}
        />
        <Metric
          icon={unhealthyJobs ? AlertTriangle : CheckCircle2}
          label="Scheduler alerts"
          value={unhealthyJobs.toString()}
          note={`${jobs.length - unhealthyJobs} of ${jobs.length} healthy or running`}
          alert={unhealthyJobs > 0}
        />
        <Metric
          icon={readinessAlerts || unassessedTenants ? AlertTriangle : ShieldCheck}
          label="Production Assurance"
          value={`${approvedReadiness}/${tenants.length}`}
          note={`${readinessAlerts} attention · ${unassessedTenants} not assessed`}
          alert={readinessAlerts > 0 || unassessedTenants > 0}
        />
        <Metric
          icon={Rocket}
          label="Release candidates"
          value={releaseMetrics.total.toString()}
          note={`${releaseMetrics.active} active · ${releaseMetrics.rolledBack} rolled back`}
          alert={releaseMetrics.rolledBack > 0}
        />
      </div>

      <div className="mt-4 flex justify-end">
        <Link
          href="/platform/releases"
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 px-4 py-2 text-sm font-semibold text-cyan-200"
        >
          <Rocket size={16} /> Open release certification
        </Link>
      </div>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[.04] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm text-cyan-300">
              <Activity size={16} /> Scheduled processing
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Job heartbeat</h2>
            <p className="mt-2 text-sm text-slate-400">
              Failed and stale states require review of protected deployment logs.
            </p>
          </div>
          <p className="text-xs text-slate-500">Checked {formatDateTime(now)}</p>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-3">Job</th>
                <th className="pb-3">Cadence</th>
                <th className="pb-3">State</th>
                <th className="pb-3">Last start</th>
                <th className="pb-3">Duration</th>
                <th className="pb-3">Last success</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {jobs.map((job) => (
                <tr key={job.key}>
                  <td className="py-4 font-medium text-white">{job.label}</td>
                  <td className="py-4 text-slate-400">{job.cadence}</td>
                  <td className="py-4">
                    <HealthBadge status={job.status} />
                  </td>
                  <td className="py-4 text-slate-400">
                    {job.latest ? formatDateTime(job.latest.startedAt) : "Never"}
                  </td>
                  <td className="py-4 text-slate-400">
                    {job.latest?.durationMs != null
                      ? `${job.latest.durationMs.toLocaleString()} ms`
                      : "—"}
                  </td>
                  <td className="py-4 text-slate-400">
                    {job.lastSuccess
                      ? formatDateTime(job.lastSuccess.startedAt)
                      : "None recorded"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-emerald-400/15 bg-emerald-400/[.025] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm text-emerald-300">
              <ShieldCheck size={16} /> Production Assurance 2.0
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Tenant readiness portfolio</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Latest structured control review for each assessed production
              tenant. Go-live requires the latest version to be approved.
            </p>
          </div>
          <Link
            href="/platform/tenants"
            className="rounded-xl border border-emerald-400/20 px-4 py-2 text-sm font-semibold text-emerald-200"
          >
            Open tenant provisioning
          </Link>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-3">Tenant</th>
                <th className="pb-3">Version</th>
                <th className="pb-3">State</th>
                <th className="pb-3">Readiness</th>
                <th className="pb-3">Exceptions</th>
                <th className="pb-3">Target review</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {readinessPortfolio.map((review) => (
                <tr key={review.id}>
                  <td className="py-4 font-medium text-white">
                    {review.organization.name}
                  </td>
                  <td className="py-4 text-slate-400">v{review.version}</td>
                  <td className="py-4">
                    <HealthBadge
                      status={
                        review.status === "APPROVED"
                          ? "HEALTHY"
                          : review.status === "IN_REVIEW"
                            ? "RUNNING"
                            : review.status
                      }
                    />
                  </td>
                  <td className="py-4 text-slate-300">{review.progress}%</td>
                  <td className="py-4 text-slate-400">
                    {review.failedControls} failed ·{" "}
                    {review.conditionalControls} conditional ·{" "}
                    {review.overdueControls} overdue
                  </td>
                  <td className="py-4 text-slate-400">
                    {review.targetReviewAt
                      ? formatDateTime(review.targetReviewAt)
                      : "Not set"}
                  </td>
                  <td className="py-4">
                    <Link
                      href={`/platform/tenants/${review.organization.id}`}
                      className="font-semibold text-cyan-300"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
              {readinessPortfolio.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No production readiness reviews have been initialized.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <ServerCog size={16} /> Runtime configuration
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            {environment.valid ? "Production checks passed" : "Configuration attention"}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Only variable names and policy warnings are shown. Secret values are
            never rendered or persisted.
          </p>
          {environment.valid ? (
            <p className="mt-5 flex gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
              <CheckCircle2 size={17} /> Required runtime controls are configured.
            </p>
          ) : (
            <div className="mt-5 space-y-2">
              {environment.missing.map((name) => (
                <p key={name} className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">
                  Missing environment variable: {name}
                </p>
              ))}
              {environment.warnings.map((warning) => (
                <p key={warning} className="rounded-xl bg-amber-400/10 p-3 text-sm text-amber-200">
                  {warning}
                </p>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <Database size={16} /> Recovery control
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Database connectivity verified</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            This command center verifies live database access through its
            operational queries. Backup retention and restore testing remain
            provider controls and must be evidenced in the production runbook;
            the application does not claim a successful restore automatically.
          </p>
          <p className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[.06] p-4 text-sm text-amber-200">
            Before customer go-live, record a successful restore drill and the
            recovery owner in the controlled deployment evidence.
          </p>
        </section>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  note,
  alert = false,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  note: string;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-3xl border p-5 ${alert ? "border-amber-400/25 bg-amber-400/[.05]" : "border-white/10 bg-white/[.04]"}`}>
      <p className={`flex items-center gap-2 text-sm ${alert ? "text-amber-300" : "text-cyan-300"}`}>
        <Icon size={16} /> {label}
      </p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function HealthBadge({ status }: { status: string }) {
  const color =
    status === "HEALTHY"
      ? "bg-emerald-400/10 text-emerald-300"
      : status === "RUNNING"
        ? "bg-cyan-400/10 text-cyan-200"
        : status === "NEVER_RUN"
          ? "bg-slate-800 text-slate-400"
          : "bg-red-400/10 text-red-300";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}
