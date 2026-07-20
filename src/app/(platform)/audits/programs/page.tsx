import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { findTenantAuditPrograms } from "@/modules/audit/audit-governance.repository";
import { PermissionKey } from "@prisma/client";
import { ArrowLeft, CalendarClock, Plus, Target } from "lucide-react";
import Link from "next/link";
import { hasPermission } from "@/lib/permissions";

export default async function AuditProgramsPage() {
  await requirePermission(PermissionKey.VIEW_AUDITS);
  const [{ organizationId }, canManage] = await Promise.all([getCurrentUserTenant(), hasPermission(PermissionKey.MANAGE_AUDITS)]);
  const programs = await findTenantAuditPrograms(organizationId);
  return <div>
    <Link href="/audits" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Back to audits</Link>
    <div className="mt-6 flex flex-wrap items-start justify-between gap-5"><div><p className="flex items-center gap-2 text-sm text-cyan-300"><Target size={16} /> Audit Governance</p><h1 className="mt-2 text-4xl font-bold">Audit Programs</h1><p className="mt-2 max-w-3xl text-slate-400">Manage risk-based audit portfolios, organizational scope, standards, ownership, and recurring coverage.</p></div>{canManage && <Link href="/audits/programs/new" className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950"><Plus size={17} /> Create Program</Link>}</div>
    <div className="mt-8 grid gap-5">{programs.length === 0 ? <Empty /> : programs.map((program) => <Link key={program.id} href={`/audits/programs/${program.id}`} className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-cyan-400/30"><div className="flex flex-wrap justify-between gap-4"><div><p className="text-xs text-cyan-300">{program.code || "NO CODE"} · {pretty(program.frequency)}</p><h2 className="mt-2 text-xl font-semibold">{program.name}</h2><p className="mt-2 text-sm text-slate-400">{program.description || program.scope || "No program description provided."}</p></div><Badge value={program.status} /></div><div className="mt-6 grid gap-4 md:grid-cols-4"><Info label="Risk priority" value={pretty(program.riskPriority)} /><Info label="Owner" value={program.owner?.name || "Not assigned"} /><Info label="Scoped sites" value={String(program.sites.length)} /><Info label="Audit coverage" value={`${program._count.enterpriseAudits} audits`} /></div></Link>)}</div>
  </div>;
}
function pretty(value: string) { return value.replaceAll("_", " "); }
function Badge({ value }: { value: string }) { return <span className="h-fit rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">{pretty(value)}</span>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-slate-950/40 p-4"><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-2 text-sm">{value}</p></div>; }
function Empty() { return <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center"><CalendarClock className="mx-auto text-slate-500" /><h2 className="mt-4 text-xl font-semibold">No audit programs yet</h2></div>; }
