import { approveCompleteEsgPeriod, publishEsgPeriod, rollupEnvironmentalEsgData } from "@/features/esg/operational.actions";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { EsgDisclosureStatus, PermissionKey } from "@prisma/client";
import Link from "next/link";

export default async function Operations() {
  await requirePermission(PermissionKey.MANAGE_ESG);
  const { organizationId } = await getCurrentUserTenant();
  const [periods, totalMetrics] = await Promise.all([prisma.esgDisclosurePeriod.findMany({ where: { organizationId }, include: { dataPoints: true }, orderBy: { periodEnd: "desc" } }), prisma.esgMetricDefinition.count({ where: { organizationId, isActive: true } })]);
  return <div><h1 className="text-4xl font-bold">ESG Disclosure Operations</h1><p className="mt-2 text-slate-400">Roll up governed environmental data, verify completeness, approve, publish, and export disclosures.</p><div className="mt-8 space-y-4">{periods.map((period) => { const exportable = period.status === EsgDisclosureStatus.APPROVED || period.status === EsgDisclosureStatus.PUBLISHED; return <section key={period.id} className="rounded-3xl border border-white/10 bg-white/5 p-6"><div className="flex justify-between"><div><h2 className="text-xl font-semibold">{period.name}</h2><p className="text-sm text-slate-400">{period.dataPoints.length}/{totalMetrics} active metrics · {period.status}</p></div><div className="flex flex-wrap gap-2"><form action={rollupEnvironmentalEsgData}><input type="hidden" name="periodId" value={period.id}/><button className="rounded-xl border border-white/10 px-3 py-2">Roll up Environmental</button></form>{!exportable && <form action={approveCompleteEsgPeriod}><input type="hidden" name="id" value={period.id}/><button className="rounded-xl bg-emerald-300 px-3 py-2 text-slate-950">Approve Complete Period</button></form>}{period.status === EsgDisclosureStatus.APPROVED && <form action={publishEsgPeriod}><input type="hidden" name="id" value={period.id}/><button className="rounded-xl bg-cyan-300 px-3 py-2 text-slate-950">Publish</button></form>}{exportable && <Link href={`/api/esg/report/${period.id}`} className="rounded-xl border border-white/10 px-3 py-2">Export CSV</Link>}</div></div></section>; })}</div></div>;
}
