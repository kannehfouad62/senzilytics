import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { listExecutiveReviewsService } from "@/modules/executive-review/executive-review.service";
import { ExecutiveReviewStatus, PermissionKey } from "@prisma/client";
import { ArrowRight, CalendarDays, ClipboardCheck, Plus } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ManagementReviewsPage() {
  await requirePermission(PermissionKey.VIEW_EXECUTIVE_REVIEWS);
  const [{ organizationId }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const workspace = await listExecutiveReviewsService(organizationId);
  const canManage = permissions.includes(
    PermissionKey.MANAGE_EXECUTIVE_REVIEWS,
  );
  const metrics = [
    ["Controlled reviews", workspace.summary.total],
    ["Upcoming", workspace.summary.upcoming],
    ["Overdue", workspace.summary.overdue],
    ["Awaiting approval", workspace.summary.awaitingApproval],
    ["Published", workspace.summary.published],
    ["Open decisions", workspace.summary.openDecisions],
  ] as const;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <ClipboardCheck size={17} />
            Enterprise Governance
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Management Reviews & Board Packs
          </h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Conduct evidence-backed leadership reviews across EHS, assurance,
            risk, compliance, people, resilience, and sustainability—with
            controlled decisions and approval-ready records.
          </p>
        </div>
        {canManage ? (
          <Link
            href="/management-reviews/new"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950"
          >
            <Plus size={17} />
            New management review
          </Link>
        ) : null}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {metrics.map(([label, value]) => (
          <Metric
            key={label}
            label={label}
            value={value}
            danger={label === "Overdue" && Number(value) > 0}
          />
        ))}
      </div>

      <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[.04]">
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <div>
            <h2 className="text-xl font-semibold">Controlled review register</h2>
            <p className="mt-1 text-sm text-slate-400">
              Snapshot, attendance, decisions, approvals, and publication stay
              linked to one auditable record.
            </p>
          </div>
          <CalendarDays size={20} className="text-cyan-300" />
        </div>
        <div className="divide-y divide-white/10">
          {workspace.reviews.map((review) => (
            <Link
              href={`/management-reviews/${review.id}`}
              key={review.id}
              className="flex flex-wrap items-center justify-between gap-5 p-5 transition hover:bg-white/[.03]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Status value={review.status} />
                  <span className="text-xs text-slate-500">
                    {review.reference} · {pretty(review.frequency)}
                  </span>
                </div>
                <h3 className="mt-2 font-semibold text-white">
                  {review.title}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  {review.site?.name ?? "Enterprise-wide"} · Chair{" "}
                  {review.chair.name} ·{" "}
                  {review.scheduledAt.toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-5">
                <div className="text-right text-xs text-slate-500">
                  <p>
                    {review._count.agendaItems} agenda ·{" "}
                    {review._count.attendees} participants
                  </p>
                  <p className="mt-1">
                    {review._count.decisions} decisions ·{" "}
                    {review.decisions.length} open
                  </p>
                </div>
                <ArrowRight size={18} className="text-slate-500" />
              </div>
            </Link>
          ))}
          {!workspace.reviews.length ? (
            <div className="p-12 text-center text-sm text-slate-400">
              No enterprise management reviews have been created.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-2 text-3xl font-bold ${
          danger ? "text-red-300" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Status({ value }: { value: ExecutiveReviewStatus }) {
  const tone =
    value === ExecutiveReviewStatus.PUBLISHED ||
    value === ExecutiveReviewStatus.APPROVED
      ? "bg-emerald-400/10 text-emerald-200"
      : value === ExecutiveReviewStatus.CANCELLED
        ? "bg-red-400/10 text-red-200"
        : value === ExecutiveReviewStatus.IN_PROGRESS
          ? "bg-cyan-400/10 text-cyan-200"
          : "bg-white/5 text-slate-300";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs ${tone}`}>
      {pretty(value)}
    </span>
  );
}

function pretty(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
