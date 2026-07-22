import { hasPermission, requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { findTenantInspections } from "@/modules/inspection/inspection.repository";
import {
  InspectionResponseResult,
  PermissionKey,
  RiskLevel,
  Status,
} from "@prisma/client";
import {
  CircleAlert,
  ClipboardCheck,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";

export default async function InspectionsPage() {
  await requirePermission(
    PermissionKey.VIEW_INSPECTIONS
  );

  const [{ organizationId }, canManage] =
    await Promise.all([
      getCurrentUserTenant(),
      hasPermission(PermissionKey.MANAGE_INSPECTIONS),
    ]);

  const inspections =
    await findTenantInspections(
      organizationId
    );

  const openInspections =
    inspections.filter(
      (inspection) =>
        inspection.status !==
          Status.COMPLETED &&
        inspection.status !==
          Status.CLOSED
    ).length;

  const totalFindings =
    inspections.reduce(
      (total, inspection) =>
        total +
        inspection.findings.length,
      0
    );

  const highRiskFindings =
    inspections.reduce(
      (total, inspection) =>
        total +
        inspection.findings.filter(
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
            <ShieldCheck size={16} />
            Inspection Management
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Inspections
          </h1>

          <p className="mt-2 max-w-2xl text-slate-400">
            Plan, execute, score, and
            close operational inspections
            across all sites and work
            areas.
          </p>
        </div>

        {canManage && <Link
          href="/inspections/new"
          className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          <Plus size={17} />
          Create Inspection
        </Link>}
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Open inspections"
          value={openInspections}
          icon={
            <ClipboardCheck
              size={20}
            />
          }
        />

        <SummaryCard
          label="Total findings"
          value={totalFindings}
          icon={
            <ShieldCheck
              size={20}
            />
          }
        />

        <SummaryCard
          label="High-risk findings"
          value={highRiskFindings}
          icon={
            <CircleAlert
              size={20}
            />
          }
        />
      </div>

      <div className="grid gap-5">
        {inspections.map(
          (inspection) => {
            const answeredItems =
              inspection.checklistItems.filter(
                (item) =>
                  item.response &&
                  item.response.result !==
                    InspectionResponseResult.NOT_ASSESSED
              ).length;

            const progress =
              inspection
                .checklistItems
                .length > 0
                ? Math.round(
                    (answeredItems /
                      inspection
                        .checklistItems
                        .length) *
                      100
                  )
                : 0;

            return (
              <Link
                key={
                  inspection.id
                }
                href={`/inspections/${inspection.id}`}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-cyan-400/30"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-cyan-300">
                      {inspection.reference ||
                        "No reference"}{" "}
                      ·{" "}
                      {inspection.type.replaceAll(
                        "_",
                        " "
                      )}
                    </p>

                    <h2 className="mt-2 text-xl font-semibold text-white">
                      {
                        inspection.title
                      }
                    </h2>

                    <p className="mt-2 text-sm text-slate-400">
                      {inspection.description ||
                        inspection.area ||
                        "No description or area provided."}
                    </p>
                  </div>

                  <StatusBadge
                    status={
                      inspection.status
                    }
                  />
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-4">
                  <InfoCard
                    label="Site"
                    value={
                      inspection.site
                        .name
                    }
                  />

                  <InfoCard
                    label="Lead inspector"
                    value={
                      inspection
                        .leadInspector
                        ?.name ||
                      "Not assigned"
                    }
                  />

                  <InfoCard
                    label="Inspection team"
                    value={`${inspection.teamMembers.length} members`}
                    icon={
                      <Users
                        size={15}
                      />
                    }
                  />

                  <InfoCard
                    label="Checklist"
                    value={
                      inspection
                        .checklistTemplate
                        ? `${progress}% complete`
                        : "No checklist"
                    }
                  />
                </div>

                {inspection
                  .checklistItems
                  .length > 0 && (
                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-900">
                    <div
                      className="h-full rounded-full bg-cyan-300"
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>
                )}
              </Link>
            );
          }
        )}

        {inspections.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
            <ShieldCheck
              size={36}
              className="mx-auto text-slate-500"
            />

            <h2 className="mt-4 text-lg font-semibold text-white">
              No inspections found
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              {canManage
                ? "Create your first inspection to begin structured field assurance activities."
                : "No inspections are currently available to review."}
            </p>

            {canManage && <Link
              href="/inspections/new"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950"
            >
              <Plus size={17} />
              Create Inspection
            </Link>}
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
  const className =
    status === Status.COMPLETED
      ? "border-green-400/20 bg-green-400/10 text-green-300"
      : status === Status.CLOSED
        ? "border-slate-400/20 bg-slate-400/10 text-slate-300"
        : status === Status.OVERDUE
          ? "border-red-400/20 bg-red-400/10 text-red-300"
          : status ===
              Status.IN_PROGRESS
            ? "border-blue-400/20 bg-blue-400/10 text-blue-300"
            : "border-cyan-400/20 bg-cyan-400/10 text-cyan-300";

  return (
    <span
      className={`h-fit rounded-full border px-3 py-1 text-xs ${className}`}
    >
      {status.replaceAll(
        "_",
        " "
      )}
    </span>
  );
}
