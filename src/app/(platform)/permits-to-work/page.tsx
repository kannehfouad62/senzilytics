import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey, PermitToWorkStatus, Prisma } from "@prisma/client";
import { Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";

const openStatuses: PermitToWorkStatus[] = [PermitToWorkStatus.DRAFT, PermitToWorkStatus.PENDING_APPROVAL, PermitToWorkStatus.APPROVED, PermitToWorkStatus.ACTIVE, PermitToWorkStatus.SUSPENDED];
export default async function PermitsToWorkPage({ searchParams }: { searchParams: Promise<{ search?: string; page?: string }> }) {
  await requirePermission(PermissionKey.VIEW_PERMITS_TO_WORK); const [{ organizationId }, permissions, params] = await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions(), searchParams]);
  const query = normalizeRegisterQuery(params); const now = new Date();
  const where: Prisma.PermitToWorkWhereInput = { organizationId, ...(query.search ? { OR: [{ reference: { contains: query.search, mode: "insensitive" } }, { title: { contains: query.search, mode: "insensitive" } }, { exactLocation: { contains: query.search, mode: "insensitive" } }, { responsiblePerson: { contains: query.search, mode: "insensitive" } }, { workOrderReference: { contains: query.search, mode: "insensitive" } }, { site: { name: { contains: query.search, mode: "insensitive" } } }, { contractor: { name: { contains: query.search, mode: "insensitive" } } }, { requestedBy: { name: { contains: query.search, mode: "insensitive" } } }] } : {}) };
  const [permits, total, registered, active, awaiting, overdue] = await Promise.all([
    prisma.permitToWork.findMany({ where, include: { site: true, contractor: true, requestedBy: true, controls: { select: { isRequired: true, isVerified: true } } }, orderBy: { plannedStartAt: "desc" }, skip: query.skip, take: query.take }),
    prisma.permitToWork.count({ where }), prisma.permitToWork.count({ where: { organizationId } }),
    prisma.permitToWork.count({ where: { organizationId, status: PermitToWorkStatus.ACTIVE } }),
    prisma.permitToWork.count({ where: { organizationId, status: PermitToWorkStatus.PENDING_APPROVAL } }),
    prisma.permitToWork.count({ where: { organizationId, status: { in: openStatuses }, plannedEndAt: { lt: now } } }),
  ]);
  const canManage = permissions.includes(PermissionKey.MANAGE_PERMITS_TO_WORK);
  return <div><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm text-cyan-300"><ShieldCheck size={17}/>High-risk work control</p><h1 className="mt-2 text-4xl font-bold">Permit to Work</h1><p className="mt-2 max-w-3xl text-slate-400">Plan, authorize, activate, monitor, suspend, and close hazardous work with verified controls and a complete decision trail.</p></div>{canManage && <Link href="/permits-to-work/new" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950"><Plus size={17}/>New Permit</Link>}</div>
    <div className="mt-7 grid gap-4 sm:grid-cols-4"><Metric label="All permits" value={registered}/><Metric label="Active" value={active}/><Metric label="Awaiting approval" value={awaiting}/><Metric label="Past planned end" value={overdue} warning={overdue > 0}/></div>
    <div className="mt-8"><RegisterSearch action="/permits-to-work" value={query.search} placeholder="Search reference, work order, location, site, contractor, or owner"/><p className="mt-3 text-sm text-slate-500">{total} matching permit{total === 1 ? "" : "s"}</p></div>
    <div className="mt-8 grid gap-4">{permits.map(permit => { const required = permit.controls.filter(item => item.isRequired); const verified = required.filter(item => item.isVerified).length; return <Link key={permit.id} href={`/permits-to-work/${permit.id}`} className="rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">{permit.reference} · {permit.type.replaceAll("_", " ")}</p><p className="mt-2 font-semibold">{permit.title}</p><p className="mt-2 text-sm text-slate-400">{permit.site.name} · {permit.contractor?.name || "Internal work"} · Requested by {permit.requestedBy.name}</p></div><span className="h-fit rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">{permit.status.replaceAll("_", " ")}</span></div><div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500"><span>{permit.plannedStartAt.toLocaleString()} → {permit.plannedEndAt.toLocaleString()}</span><span>{verified}/{required.length} required controls verified</span>{openStatuses.includes(permit.status) && permit.plannedEndAt < now && <span className="text-red-300">PAST PLANNED END</span>}</div></Link>; })}</div>
    {!permits.length && <p className="mt-8 rounded-3xl border border-dashed border-white/10 p-10 text-center text-slate-500">{query.search ? "No permits match this search." : "No permits to work have been created."}</p>}
    <RegisterPagination action="/permits-to-work" search={query.search} page={query.page} pages={registerPageCount(total)}/>
  </div>;
}
function Metric({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) { return <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 text-3xl font-bold ${warning ? "text-red-300" : "text-white"}`}>{value}</p></div>; }
import { RegisterPagination } from "@/components/register/register-pagination";
import { RegisterSearch } from "@/components/register/register-search";
import { normalizeRegisterQuery, registerPageCount } from "@/core/register/register-query";
