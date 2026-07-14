import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { findTenantAudits } from "@/modules/audit/audit.repository";
import {
  AuditResponseResult,
  PermissionKey,
  RiskLevel,
  Status,
} from "@prisma/client";
import {
  CircleAlert,
  ClipboardCheck,
  Plus,
  SearchCheck,
  Users,
} from "lucide-react";
import Link from "next/link";

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
            Plan, execute, score, and
            close enterprise audits
            across every operating site.
          </p>
        </div>

        <Link
          href="/audits/new"
          className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950"
        >
          <Plus size={17} />
          Create Audit
        </Link>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Open audits"
          value={openAudits}
          icon={<ClipboardCheck />}
        />

        <SummaryCard
          label="Total findings"
          value={totalFindings}
          icon={<SearchCheck />}
        />

        <SummaryCard
          label="High-risk findings"
          value={highRiskFindings}
          icon={<CircleAlert />}
        />
      </div>

      <div className="grid gap-5">
        {audits.map((audit) => {
          const answeredItems =
            audit.checklistItems.filter(
              (item) =>
                item.response &&
                item.response.result !==
                  AuditResponseResult.NOT_ASSESSED
            ).length;

          const checklistProgress =
            audit.checklistItems.length >
            0
              ? Math.round(
                  (answeredItems /
                    audit
                      .checklistItems
                      .length) *
                    100
                )
              : 0;

          return (
            <Link
              key={audit.id}
              href={`/audits/${audit.id}`}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-cyan-400/30"
            >
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <p className="text-xs text-cyan-300">
                    {audit.reference ||
                      "No reference"}{" "}
                    ·{" "}
                    {audit.type.replaceAll(
                      "_",
                      " "
                    )}
                  </p>

                  <h2 className="mt-2 text-xl font-semibold text-white">
                    {audit.title}
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    {audit.scope ||
                      "No scope provided."}
                  </p>
                </div>

                <StatusBadge
                  status={audit.status}
                />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <InfoCard
                  label="Site"
                  value={audit.site.name}
                />

                <InfoCard
                  label="Lead auditor"
                  value={
                    audit.leadAuditor
                      ?.name ||
                    "Not assigned"
                  }
                />

                <InfoCard
                  label="Audit team"
                  value={`${audit.teamMembers.length} members`}
                  icon={<Users size={15} />}
                />

                <InfoCard
                  label="Checklist"
                  value={
                    audit
                      .checklistTemplate
                      ? `${checklistProgress}% complete`
                      : "No checklist"
                  }
                />
              </div>

              {audit.checklistItems
                .length > 0 && (
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-900">
                  <div
                    className="h-full rounded-full bg-cyan-300"
                    style={{
                      width: `${checklistProgress}%`,
                    }}
                  />
                </div>
              )}
            </Link>
          );
        })}

        {audits.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center text-slate-400">
            No audits found.
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
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex justify-between text-cyan-300">
        <p className="text-sm text-slate-400">
          {label}
        </p>

        {icon}
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

      <p className="mt-1 text-sm font-medium text-white">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: Status;
}) {
  return (
    <span className="h-fit rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
      {status.replaceAll("_", " ")}
    </span>
  );
}