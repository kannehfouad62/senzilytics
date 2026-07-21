import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getRegulatoryIntelligenceDashboardService } from "@/modules/compliance/regulatory-intelligence.service";
import { PermissionKey, PermitStatus, Status } from "@prisma/client";
import Link from "next/link";

export default async function Dashboard() {
  await requirePermission(PermissionKey.VIEW_COMPLIANCE);
  const { organizationId } = await getCurrentUserTenant();
  const now = new Date(); const soon = new Date(now); soon.setDate(soon.getDate() + 60);
  const [items, permits, regulatory] = await Promise.all([
    prisma.complianceItem.findMany({ where: { site: { organizationId } } }),
    prisma.permit.findMany({ where: { organizationId } }),
    getRegulatoryIntelligenceDashboardService(organizationId, now),
  ]);
  const cards: Array<[string, number, boolean]> = [
    ["Open obligations", items.filter(item => item.status !== Status.COMPLETED && item.status !== Status.CLOSED).length, false],
    ["Overdue obligations", items.filter(item => item.status === Status.OVERDUE || (item.dueDate < now && item.status !== Status.COMPLETED)).length, true],
    ["Active permits", permits.filter(permit => permit.status === PermitStatus.ACTIVE).length, false],
    ["Permits expiring in 60 days", permits.filter(permit => permit.expirationDate && permit.expirationDate >= now && permit.expirationDate <= soon).length, true],
    ["Active regulatory sources", regulatory.metrics.activeSources, false],
    ["Open regulatory changes", regulatory.metrics.openChanges, false],
    ["Impact assessments overdue", regulatory.metrics.assessmentsOverdue, true],
    ["Critical regulatory exposure", regulatory.metrics.criticalExposure, true],
  ];
  return <div><div className="flex flex-wrap justify-between gap-4"><div><p className="text-sm text-cyan-300">Regulatory Intelligence</p><h1 className="mt-2 text-4xl font-bold">Compliance Analytics</h1></div><div className="flex gap-3"><Link href="/compliance/regulatory" className="h-fit rounded-xl border border-white/10 px-4 py-2">Regulatory Intelligence</Link><Link href="/compliance" className="h-fit rounded-xl border border-white/10 px-4 py-2">Obligations</Link></div></div><div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, warn]) => <div key={label} className="rounded-3xl border border-white/10 bg-white/5 p-6"><p className="text-sm text-slate-400">{label}</p><p className={`mt-2 text-3xl font-bold ${warn && value > 0 ? "text-red-300" : ""}`}>{value}</p></div>)}</div></div>;
}
