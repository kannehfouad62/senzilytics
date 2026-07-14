import { findTenantAudits } from "@/modules/audit/audit.repository";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  PermissionKey,
  RiskLevel,
  Status,
} from "@prisma/client";
import {
  CalendarDays,
  CircleAlert,
  ClipboardCheck,
  Plus,
  SearchCheck,
} from "lucide-react";
import Link from "next/link";

function riskClass(
  value: RiskLevel
) {
  switch (value) {
    case RiskLevel.LOW:
      return "border-green-400/20 bg-green-400/10 text-green-300";

    case RiskLevel.MEDIUM:
      return "border-orange-400/20 bg-orange-400/10 text-orange-300";

    case RiskLevel.HIGH:
      return "border-red-400/20 bg-red-400/10 text-red-300";

    case RiskLevel.CRITICAL:
      return "border-purple-400/20 bg-purple-400/10 text-purple-300";

    default:
      return "border-slate-400/20 bg-slate-400/10 text-slate-300";
  }
}

function statusClass(
  value: Status
) {
  switch (value) {
    case Status.OPEN:
      return "border-cyan-400/20 bg-cyan-400/10 text-cyan-300";

    case Status.IN_PROGRESS:
      return "border-blue-400/20 bg-blue-400/10 text-blue-300";

    case Status.COMPLETED:
      return "border-green-400/20 bg-green-400/10 text-green-300";

    case Status.CLOSED:
      return "border-slate-400/20 bg-slate-400/10 text-slate-300";

    case Status.OVERDUE:
      return "border-red-400/20 bg-red-400/10 text-red-300";

    default:
      return "border-white/10 bg-white/5 text-slate-300";
  }
}

function formatDate(
  value: Date | null
) {
  if (!value) {
    return "Not scheduled";
  }

  return value.toLocaleDateString(
    "en-US",
    {
      dateStyle: "medium",
    }
  );
}

export default async function AuditsPage() {
  await requirePermission(
    PermissionKey.VIEW_AUDITS
  );

  const { organizationId } =
    await getCurrentUserTenant();

  const audits =
    await findTenantAudits(
      organizationId
    );

  const openAudits =
    audits.filter(
      (audit) =>
        audit.status !==
          Status.COMPLETED &&
        audit.status !==
          Status.CLOSED
    ).length;

  const totalFindings =
    audits.reduce(
      (total, audit) =>
        total +
        audit.findings.length,
      0
    );

  const highRiskFindings =
    audits.reduce(
      (total, audit) =>
        total +
        audit.findings.filter(
          (finding) =>
            finding.riskLevel ===
              RiskLevel.HIGH ||
            finding.riskLevel ===
              RiskLevel.CRITICAL
        ).length,
      0
    );

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <SearchCheck size={16} />
            Audit Management
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Audits
          </h1>

          <p className="mt-2 max-w-2xl text-slate-400">
            Plan audits, manage execution,
            document findings, and monitor
            follow-up across every site.
          </p>
        </div>

        <Link
          href="/audits/new"
          className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          <Plus size={17} />
          Create Audit
        </Link>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Open audits"
          value={String(openAudits)}
          icon={
            <ClipboardCheck
              size={20}
            />
          }
        />

        <SummaryCard
          label="Total findings"
          value={String(
            totalFindings
          )}
          icon={
            <SearchCheck size={20} />
          }
        />

        <SummaryCard
          label="High-risk findings"
          value={String(
            highRiskFindings
          )}
          icon={
            <CircleAlert size={20} />
          }
        />
      </div>

      <div className="grid gap-5">
        {audits.map((audit) => {
          const highestRisk =
            audit.findings.some(
              (finding) =>
                finding.riskLevel ===
                RiskLevel.CRITICAL
            )
              ? RiskLevel.CRITICAL
              : audit.findings.some(
                    (finding) =>
                      finding.riskLevel ===
                      RiskLevel.HIGH
                  )
                ? RiskLevel.HIGH
                : audit.findings.some(
                      (finding) =>
                        finding.riskLevel ===
                        RiskLevel.MEDIUM
                    )
                  ? RiskLevel.MEDIUM
                  : RiskLevel.LOW;

          return (
            <Link
              key={audit.id}
              href={`/audits/${audit.id}`}
              className="block rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl transition hover:border-cyan-400/30 hover:bg-white/[0.07]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {audit.title}
                  </h2>

                  <p className="mt-2 max-w-3xl text-sm text-slate-400">
                    {audit.scope ||
                      "No audit scope provided."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${statusClass(
                      audit.status
                    )}`}
                  >
                    {audit.status.replaceAll(
                      "_",
                      " "
                    )}
                  </span>

                  {audit.findings.length >
                    0 && (
                    <span
                      className={`rounded-full border px-3 py-1 text-xs ${riskClass(
                        highestRisk
                      )}`}
                    >
                      Highest risk:{" "}
                      {highestRisk}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <InfoCard
                  label="Site"
                  value={audit.site.name}
                />

                <InfoCard
                  label="Scheduled"
                  value={formatDate(
                    audit.scheduledAt
                  )}
                  icon={
                    <CalendarDays
                      size={16}
                    />
                  }
                />

                <InfoCard
                  label="Findings"
                  value={String(
                    audit.findings
                      .length
                  )}
                />
              </div>
            </Link>
          );
        })}

        {audits.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-12 text-center">
            <SearchCheck
              size={36}
              className="mx-auto text-slate-500"
            />

            <h2 className="mt-4 text-lg font-semibold text-white">
              No audits found
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Create your first audit to
              begin planning and tracking
              assurance activities.
            </p>

            <Link
              href="/audits/new"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950"
            >
              <Plus size={17} />
              Create Audit
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {label}
        </p>

        <div className="text-cyan-300">
          {icon}
        </div>
      </div>

      <p className="mt-3 text-3xl font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

function InfoCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <p className="flex items-center gap-2 text-xs text-slate-500">
        {icon}
        {label}
      </p>

      <p className="mt-1 font-medium text-slate-100">
        {value}
      </p>
    </div>
  );
}