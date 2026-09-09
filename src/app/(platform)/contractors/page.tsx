import { RegisterPagination } from "@/components/register/register-pagination";
import { RegisterSearch } from "@/components/register/register-search";
import { normalizeRegisterQuery, registerPageCount } from "@/core/register/register-query";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { ContractorStatus, PermissionKey, Prisma } from "@prisma/client";
import { Building2, Plus, Users } from "lucide-react";
import Link from "next/link";

export default async function ContractorsPage({ searchParams }: { searchParams: Promise<{ search?: string; page?: string }> }) {
  await requirePermission(PermissionKey.VIEW_CONTRACTORS);
  const [{ organizationId }, permissions, query] = await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions(), searchParams]);
  const { search, page, skip, take } = normalizeRegisterQuery(query);
  const searchFilter: Prisma.ContractorWhereInput = search ? { OR: [
    { name: { contains: search, mode: "insensitive" } },
    { legalName: { contains: search, mode: "insensitive" } },
    { registrationNumber: { contains: search, mode: "insensitive" } },
    { primaryContactName: { contains: search, mode: "insensitive" } },
    { primaryContactEmail: { contains: search, mode: "insensitive" } },
    { services: { contains: search, mode: "insensitive" } },
  ] } : {};
  const where: Prisma.ContractorWhereInput = { organizationId, ...searchFilter };
  const canManage = permissions.includes(PermissionKey.MANAGE_CONTRACTORS);
  const now = new Date(); const inThirtyDays = new Date(now); inThirtyDays.setDate(now.getDate() + 30);
  const [contractors, total, registered, approved, expiring] = await Promise.all([
    prisma.contractor.findMany({ where, include: { sites: { include: { site: true } }, workers: true, permitsToWork: { where: { status: { in: ["APPROVED", "ACTIVE", "SUSPENDED"] } }, select: { id: true } } }, orderBy: { updatedAt: "desc" }, skip, take }),
    prisma.contractor.count({ where }),
    prisma.contractor.count({ where: { organizationId } }),
    prisma.contractor.count({ where: { organizationId, status: ContractorStatus.APPROVED } }),
    prisma.contractor.count({ where: { organizationId, insuranceExpiresAt: { gte: now, lte: inThirtyDays } } }),
  ]);
  const totalPages = registerPageCount(total);
  return <div>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm text-cyan-300"><Building2 size={17}/>Third-party safety assurance</p><h1 className="mt-2 text-4xl font-bold">Contractor Management</h1><p className="mt-2 max-w-3xl text-slate-400">Prequalify contractors, govern insurance and site authorization, track worker competency, and preserve permit traceability.</p></div>{canManage && <Link href="/contractors/new" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950"><Plus size={17}/>Register Contractor</Link>}</div>
    <div className="mt-7 grid gap-4 sm:grid-cols-3"><Metric label="Registered" value={registered}/><Metric label="Approved" value={approved}/><Metric label="Insurance expiring in 30 days" value={expiring} warning={expiring > 0}/></div>
    <div className="mt-8"><RegisterSearch action="/contractors" value={search} placeholder="Search name, registration, contact, or service"/><p className="mt-3 text-sm text-slate-500">{total} matching contractor{total === 1 ? "" : "s"}</p></div>
    <div className="mt-8 grid gap-4">{contractors.map(item => <Link key={item.id} href={`/contractors/${item.id}`} className="rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{item.name}</p><p className="mt-2 text-sm text-slate-400">{item.services || "Services not recorded"}</p></div><span className="h-fit rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">{item.status.replaceAll("_", " ")}</span></div><p className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500"><span>{item.sites.length} authorized site(s)</span><span className="flex items-center gap-1"><Users size={13}/>{item.workers.length} worker(s)</span><span>{item.permitsToWork.length} open permit(s)</span><span>Insurance: {item.insuranceExpiresAt?.toLocaleDateString() || "not recorded"}</span></p></Link>)}</div>
    {!contractors.length && <p className="mt-8 rounded-3xl border border-dashed border-white/10 p-10 text-center text-slate-500">{search ? "No contractors match this search." : "No contractors have been registered."}</p>}
    <RegisterPagination action="/contractors" page={page} pages={totalPages} search={search}/>
  </div>;
}
function Metric({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) { return <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 text-3xl font-bold ${warning ? "text-amber-300" : "text-white"}`}>{value}</p></div>; }
