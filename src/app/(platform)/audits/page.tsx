import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { findTenantAudits } from "@/modules/audit/audit.repository";
import { EnterpriseAuditStatus, PermissionKey } from "@prisma/client";
import { CalendarClock, CircleAlert, ClipboardCheck, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";

const closedStatuses = new Set<EnterpriseAuditStatus>([
  EnterpriseAuditStatus.COMPLETED,
  EnterpriseAuditStatus.CLOSED,
  EnterpriseAuditStatus.CANCELLED,
]);

export default async function AuditsPage() {
  await requirePermission(PermissionKey.VIEW_AUDITS);
  const { organizationId } = await getCurrentUserTenant();
  const audits = await findTenantAudits(organizationId);
  const today = new Date();
  const open = audits.filter((audit) => !closedStatuses.has(audit.status)).length;
  const overdue = audits.filter(
    (audit) => audit.dueDate && audit.dueDate < today && !closedStatuses.has(audit.status)
  ).length;
  const findings = audits.reduce((total, audit) => total + audit.openFindingCount, 0);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <ShieldCheck size={16} /> Audit Management
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">Enterprise Audits</h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Plan, execute, review, and close risk-based audits with controlled protocols and full traceability.
          </p>
        </div>
        <Link href="/audits/new" className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
          <Plus size={17} /> Create Audit
        </Link>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Summary label="Open audits" value={open} icon={<ClipboardCheck size={20} />} />
        <Summary label="Overdue audits" value={overdue} icon={<CalendarClock size={20} />} />
        <Summary label="Open findings" value={findings} icon={<CircleAlert size={20} />} />
      </div>

      <div className="grid gap-5">
        {audits.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-12 text-center">
            <ShieldCheck className="mx-auto text-slate-500" size={34} />
            <h2 className="mt-4 text-xl font-semibold">No enterprise audits yet</h2>
            <p className="mt-2 text-sm text-slate-400">Create the first audit and optionally snapshot an active protocol for execution.</p>
          </div>
        ) : audits.map((audit) => (
          <Link key={audit.id} href={`/audits/${audit.id}`} className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-cyan-400/30">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-cyan-300">{audit.reference} · {label(audit.auditType)}</p>
                <h2 className="mt-2 text-xl font-semibold text-white">{audit.title}</h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-400">{audit.description || audit.scope || "No description or scope provided."}</p>
              </div>
              <StatusBadge status={audit.status} />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <Info label="Site" value={audit.site.name} />
              <Info label="Lead auditor" value={audit.leadAuditor?.name || "Not assigned"} />
              <Info label="Protocol" value={audit.protocol ? `${audit.protocol.name} v${audit.protocol.version}` : "Not selected"} />
              <Info label="Progress" value={`${audit.answeredQuestionCount}/${audit.totalQuestionCount} answered`} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function label(value: string) { return value.replaceAll("_", " "); }

function Summary({ label: text, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="rounded-3xl border border-white/10 bg-white/5 p-5"><div className="flex items-center justify-between text-slate-400"><p className="text-sm">{text}</p><span className="text-cyan-300">{icon}</span></div><p className="mt-3 text-3xl font-bold">{value}</p></div>;
}

function Info({ label: text, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-950/40 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">{text}</p><p className="mt-2 text-sm text-slate-200">{value}</p></div>;
}

function StatusBadge({ status }: { status: EnterpriseAuditStatus }) {
  const tone = status === EnterpriseAuditStatus.OVERDUE ? "border-red-400/30 bg-red-400/10 text-red-200" : status === EnterpriseAuditStatus.CLOSED || status === EnterpriseAuditStatus.COMPLETED ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{label(status)}</span>;
}
