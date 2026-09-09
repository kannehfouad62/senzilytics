import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { AssetStatus, PermissionKey, Prisma } from "@prisma/client";
import { BarChart3, Plus, Search, Wrench } from "lucide-react";
import Link from "next/link";

const PAGE_SIZE = 50;

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ search?: string; page?: string }> }) {
  await requirePermission(PermissionKey.VIEW_ASSETS);
  const [{ organizationId }, permissions] = await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions()]);
  const canManage = permissions.includes(PermissionKey.MANAGE_ASSETS);
  const now = new Date();
  const params = await searchParams;
  const search = params.search?.trim() ?? "";
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const where: Prisma.AssetWhereInput = { organizationId, ...(search ? { OR: ["reference", "name", "description", "manufacturer", "modelNumber", "serialNumber", "location"].map(field => ({ [field]: { contains: search, mode: Prisma.QueryMode.insensitive } })) } : {}) };
  const activeWhere: Prisma.AssetWhereInput = { organizationId, status: { not: AssetStatus.RETIRED } };
  const [assets, filteredCount, registeredCount, safetyCriticalCount, outOfServiceCount, inspectionsOverdueCount] = await Promise.all([
    prisma.asset.findMany({ where, include: { site: true, department: true, owner: true, defects: { where: { status: { notIn: ["CLOSED"] } }, select: { id: true } } }, orderBy: [{ status: "asc" }, { name: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.asset.count({ where }),
    prisma.asset.count({ where: { organizationId } }),
    prisma.asset.count({ where: { ...activeWhere, isSafetyCritical: true } }),
    prisma.asset.count({ where: { ...activeWhere, status: { in: [AssetStatus.OUT_OF_SERVICE, AssetStatus.QUARANTINED] } } }),
    prisma.asset.count({ where: { ...activeWhere, nextInspectionDueAt: { lt: now } } }),
  ]);
  const metrics = [
    ["Registered", registeredCount], ["Safety critical", safetyCriticalCount],
    ["Out of service", outOfServiceCount], ["Inspections overdue", inspectionsOverdueCount],
  ] as const;
  const pageCount = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const href = (target: number) => `/assets?${new URLSearchParams({ ...(search ? { search } : {}), page: String(target) })}`;
  return <div><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="flex items-center gap-2 text-sm text-cyan-300"><Wrench size={17} />Asset & Equipment Safety</p><h1 className="mt-2 text-4xl font-bold">Asset Register</h1><p className="mt-2 max-w-3xl text-slate-400">Control safety-critical equipment, inspections, maintenance, defects, evidence, and corrective actions in one traceable workspace.</p></div><div className="flex gap-3"><Link href="/assets/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3"><BarChart3 size={17} />Analytics</Link>{canManage && <Link href="/assets/new" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950"><Plus size={17} />Register Asset</Link>}</div></div><div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}</div><form className="mt-8 flex flex-wrap gap-3" action="/assets"><label className="relative min-w-64 flex-1"><Search size={18} className="pointer-events-none absolute left-4 top-3.5 text-slate-500"/><span className="sr-only">Search assets</span><input name="search" defaultValue={search} placeholder="Search reference, name, serial number, model, manufacturer, or location" className="w-full rounded-xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 outline-none focus:border-cyan-400"/></label><button className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950">Search</button>{search && <Link href="/assets" className="rounded-xl border border-white/10 px-5 py-3 text-slate-300">Clear</Link>}</form><p className="mt-3 text-sm text-slate-500">{filteredCount} matching asset{filteredCount === 1 ? "" : "s"}</p><div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/5"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-white/10 text-slate-400"><tr><th className="p-4">Asset</th><th className="p-4">Scope</th><th className="p-4">Status</th><th className="p-4">Inspection due</th><th className="p-4">Maintenance due</th><th className="p-4">Open defects</th></tr></thead><tbody>{assets.map(asset => <tr key={asset.id} className="border-b border-white/5 hover:bg-white/5"><td className="p-4"><Link href={`/assets/${asset.id}`} className="font-semibold text-cyan-200 hover:underline">{asset.reference}</Link><p className="mt-1 text-slate-300">{asset.name}</p><p className="text-xs text-slate-500">{asset.type.replaceAll("_", " ")}{asset.isSafetyCritical ? " · Safety critical" : ""}</p></td><td className="p-4 text-slate-300">{asset.site.name}<p className="text-xs text-slate-500">{asset.department?.name || asset.owner?.name || "No department"}</p></td><td className="p-4"><span className="rounded-full border border-white/10 px-3 py-1 text-xs">{asset.status.replaceAll("_", " ")}</span></td><td className={`p-4 ${asset.nextInspectionDueAt < now ? "text-red-300" : "text-slate-300"}`}>{asset.nextInspectionDueAt.toLocaleDateString()}</td><td className={`p-4 ${asset.nextMaintenanceDueAt < now ? "text-red-300" : "text-slate-300"}`}>{asset.nextMaintenanceDueAt.toLocaleDateString()}</td><td className="p-4">{asset.defects.length}</td></tr>)}{!assets.length && <tr><td colSpan={6} className="p-10 text-center text-slate-400">{search ? "No assets match this search." : "No assets are registered yet."}</td></tr>}</tbody></table></div>{pageCount > 1 && <div className="flex items-center justify-between border-t border-white/10 p-4 text-sm"><span className="text-slate-400">Page {page} of {pageCount}</span><div className="flex gap-2">{page > 1 && <Link href={href(page - 1)} className="rounded-lg border border-white/10 px-4 py-2">Previous</Link>}{page < pageCount && <Link href={href(page + 1)} className="rounded-lg border border-white/10 px-4 py-2">Next</Link>}</div></div>}</div></div>;
}
