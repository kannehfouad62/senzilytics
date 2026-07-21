import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { AssetStatus, PermissionKey } from "@prisma/client";
import { BarChart3, Plus, Wrench } from "lucide-react";
import Link from "next/link";

export default async function AssetsPage() {
  await requirePermission(PermissionKey.VIEW_ASSETS);
  const [{ organizationId }, permissions] = await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions()]);
  const canManage = permissions.includes(PermissionKey.MANAGE_ASSETS);
  const now = new Date();
  const assets = await prisma.asset.findMany({ where: { organizationId }, include: { site: true, department: true, owner: true, defects: { where: { status: { notIn: ["CLOSED"] } }, select: { id: true } } }, orderBy: [{ status: "asc" }, { name: "asc" }] });
  const active = assets.filter(asset => asset.status !== AssetStatus.RETIRED);
  const metrics = [
    ["Registered", assets.length], ["Safety critical", active.filter(asset => asset.isSafetyCritical).length],
    ["Out of service", active.filter(asset => asset.status === AssetStatus.OUT_OF_SERVICE || asset.status === AssetStatus.QUARANTINED).length],
    ["Inspections overdue", active.filter(asset => asset.nextInspectionDueAt < now).length],
  ] as const;
  return <div><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="flex items-center gap-2 text-sm text-cyan-300"><Wrench size={17} />Asset & Equipment Safety</p><h1 className="mt-2 text-4xl font-bold">Asset Register</h1><p className="mt-2 max-w-3xl text-slate-400">Control safety-critical equipment, inspections, maintenance, defects, evidence, and corrective actions in one traceable workspace.</p></div><div className="flex gap-3"><Link href="/assets/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3"><BarChart3 size={17} />Analytics</Link>{canManage && <Link href="/assets/new" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950"><Plus size={17} />Register Asset</Link>}</div></div><div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}</div><div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-white/10 text-slate-400"><tr><th className="p-4">Asset</th><th className="p-4">Scope</th><th className="p-4">Status</th><th className="p-4">Inspection due</th><th className="p-4">Maintenance due</th><th className="p-4">Open defects</th></tr></thead><tbody>{assets.map(asset => <tr key={asset.id} className="border-b border-white/5 hover:bg-white/5"><td className="p-4"><Link href={`/assets/${asset.id}`} className="font-semibold text-cyan-200 hover:underline">{asset.reference}</Link><p className="mt-1 text-slate-300">{asset.name}</p><p className="text-xs text-slate-500">{asset.type.replaceAll("_", " ")}{asset.isSafetyCritical ? " · Safety critical" : ""}</p></td><td className="p-4 text-slate-300">{asset.site.name}<p className="text-xs text-slate-500">{asset.department?.name || asset.owner?.name || "No department"}</p></td><td className="p-4"><span className="rounded-full border border-white/10 px-3 py-1 text-xs">{asset.status.replaceAll("_", " ")}</span></td><td className={`p-4 ${asset.nextInspectionDueAt < now ? "text-red-300" : "text-slate-300"}`}>{asset.nextInspectionDueAt.toLocaleDateString()}</td><td className={`p-4 ${asset.nextMaintenanceDueAt < now ? "text-red-300" : "text-slate-300"}`}>{asset.nextMaintenanceDueAt.toLocaleDateString()}</td><td className="p-4">{asset.defects.length}</td></tr>)}{!assets.length && <tr><td colSpan={6} className="p-10 text-center text-slate-400">No assets are registered yet.</td></tr>}</tbody></table></div></div></div>;
}
