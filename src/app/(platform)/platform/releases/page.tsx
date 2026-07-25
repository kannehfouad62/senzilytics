import {
  CreateReleaseCandidateForm,
  ReleaseCandidateWorkspace,
} from "@/features/platform/release-candidate-workspace";
import { requirePlatformAdministrator } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { platformReleaseProgress } from "@/modules/platform/release-candidate";
import {
  getPilotTenantOptions,
  getPlatformReleasePortfolio,
} from "@/modules/platform/release-candidate.service";
import { Rocket } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PlatformReleasesPage({
  searchParams,
}: {
  searchParams: Promise<{ release?: string }>;
}) {
  await requirePlatformAdministrator();
  const query = await searchParams;
  const [portfolio, tenantOptions] = await Promise.all([
    getPlatformReleasePortfolio(),
    getPilotTenantOptions(),
  ]);
  const selectedId =
    portfolio.find((release) => release.id === query.release)?.id ??
    portfolio[0]?.id ??
    null;
  const selected = selectedId
    ? await prisma.platformRelease.findUnique({
        where: { id: selectedId },
        include: {
          createdBy: { select: { name: true } },
          submittedBy: { select: { name: true } },
          reviewedBy: { select: { name: true } },
          checks: {
            orderBy: { key: "asc" },
            include: {
              testedBy: { select: { name: true } },
            },
          },
          pilots: {
            orderBy: { createdAt: "asc" },
            include: {
              organization: { select: { id: true, name: true } },
            },
          },
        },
      })
    : null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <Rocket size={17} /> Senzilytics Platform Administration
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Release certification
          </h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Certify the exact deployment candidate, approve eligible pilot
            tenants, record outcomes, and preserve the release or rollback
            decision as governed evidence.
          </p>
        </div>
        <Link
          href="/platform/operations"
          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-cyan-200"
        >
          Platform operations
        </Link>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Release portfolio
          </h2>
          {portfolio.map((release) => (
            <Link
              key={release.id}
              href={`/platform/releases?release=${release.id}`}
              className={`block rounded-2xl border p-4 transition ${
                release.id === selectedId
                  ? "border-cyan-400/35 bg-cyan-400/[.07]"
                  : "border-white/10 bg-white/[.035] hover:border-white/20"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{release.version}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {release.commitSha.slice(0, 12)}
                  </p>
                </div>
                <PortfolioBadge status={release.status} />
              </div>
              <p className="mt-3 text-xs text-slate-400">
                {release.progress}% checks · {release.pilots.length} pilots
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {formatDateTime(release.createdAt)}
              </p>
            </Link>
          ))}
          {!portfolio.length ? (
            <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-500">
              No release candidates have been created.
            </p>
          ) : null}
        </aside>

        <main className="min-w-0 space-y-7">
          <CreateReleaseCandidateForm />
          {selected ? (
            <ReleaseCandidateWorkspace
              progress={platformReleaseProgress(selected.checks)}
              release={{
                id: selected.id,
                version: selected.version,
                commitSha: selected.commitSha,
                deploymentUrl: selected.deploymentUrl,
                status: selected.status,
                releaseNotes: selected.releaseNotes,
                riskSummary: selected.riskSummary,
                rollbackPlan: selected.rollbackPlan,
                targetCertificationAt: dateValue(selected.targetCertificationAt),
                submissionNotes: selected.submissionNotes,
                reviewNotes: selected.reviewNotes,
                submittedAt: dateTimeValue(selected.submittedAt),
                reviewedAt: dateTimeValue(selected.reviewedAt),
                approvedAt: dateTimeValue(selected.approvedAt),
                pilotStartedAt: dateTimeValue(selected.pilotStartedAt),
                releasedAt: dateTimeValue(selected.releasedAt),
                rolledBackAt: dateTimeValue(selected.rolledBackAt),
                createdAt: formatDateTime(selected.createdAt),
                createdBy: selected.createdBy,
                submittedBy: selected.submittedBy,
                reviewedBy: selected.reviewedBy,
                checks: selected.checks.map((check) => ({
                  id: check.id,
                  key: check.key,
                  status: check.status,
                  testMethod: check.testMethod,
                  evidenceSummary: check.evidenceSummary,
                  resultNotes: check.resultNotes,
                  evidenceUrl: check.evidenceUrl,
                  testedAt: dateValue(check.testedAt),
                  testedBy: check.testedBy,
                })),
                pilots: selected.pilots.map((pilot) => ({
                  id: pilot.id,
                  status: pilot.status,
                  plannedStartAt: dateValue(pilot.plannedStartAt),
                  startedAt: dateTimeValue(pilot.startedAt),
                  completedAt: dateTimeValue(pilot.completedAt),
                  exitCriteria: pilot.exitCriteria,
                  resultSummary: pilot.resultSummary,
                  organization: pilot.organization,
                })),
              }}
              tenantOptions={tenantOptions.map((tenant) => ({
                id: tenant.id,
                name: tenant.name,
                onboardingStatus: tenant.onboardingPlan?.status ?? null,
                readinessStatus:
                  tenant.productionReadinessReviews[0]?.status ?? null,
                readinessVersion:
                  tenant.productionReadinessReviews[0]?.version ?? null,
                eligibilityIssues: tenant.eligibilityIssues,
              }))}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}

function PortfolioBadge({ status }: { status: string }) {
  const color =
    status === "RELEASED"
      ? "bg-emerald-400/10 text-emerald-300"
      : status === "ROLLED_BACK" || status === "REJECTED"
        ? "bg-red-400/10 text-red-300"
        : status === "PILOT_ACTIVE"
          ? "bg-violet-400/10 text-violet-200"
          : "bg-cyan-400/10 text-cyan-200";
  return (
    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${color}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function dateValue(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function dateTimeValue(value: Date | null) {
  return value ? formatDateTime(value) : null;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}
