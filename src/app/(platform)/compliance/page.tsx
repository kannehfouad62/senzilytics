import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";
import { CalendarCheck } from "lucide-react";
import Link from "next/link";

export default async function CompliancePage() {
  await requirePermission(PermissionKey.VIEW_COMPLIANCE);
  const { organizationId } = await getCurrentUserTenant();
  const items = await prisma.complianceItem.findMany({ where: { site: { organizationId } }, orderBy: { dueDate: "asc" }, include: { site: true, owner: true } });
  return <div><div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm text-cyan-300"><CalendarCheck size={16}/>Compliance Governance</p><h1 className="mt-2 text-4xl font-bold">Compliance Obligations</h1><p className="mt-2 max-w-2xl text-slate-400">Manage legal requirements, regulatory deadlines, evaluations, evidence, and recurring obligations.</p></div><div className="flex gap-3"><Link href="/compliance/permits" className="rounded-xl border border-white/10 px-4 py-2">Permit Register</Link><Link href="/compliance/new" className="rounded-xl bg-cyan-300 px-4 py-2 font-semibold text-slate-950">New Obligation</Link></div></div><div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5"><table className="w-full text-left text-sm"><thead className="border-b border-white/10 bg-white/5 text-slate-300"><tr><th className="px-6 py-4">Obligation</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Due</th><th className="px-6 py-4">Site</th><th className="px-6 py-4">Owner</th></tr></thead><tbody>{items.map((item)=><tr key={item.id} className="border-b border-white/5"><td className="px-6 py-5"><p className="font-medium">{item.reference ? `${item.reference} — ` : ""}{item.title}</p><p className="mt-1 text-xs text-slate-400">{item.obligationType.replaceAll("_"," ")} · {item.authority||"Authority not recorded"}</p></td><td className="px-6 py-5 text-cyan-300">{item.status.replaceAll("_"," ")}</td><td className="px-6 py-5">{item.dueDate.toLocaleDateString()}</td><td className="px-6 py-5">{item.site.name}</td><td className="px-6 py-5">{item.owner?.name||"Unassigned"}</td></tr>)}</tbody></table>{!items.length&&<p className="p-10 text-center text-slate-400">No compliance obligations found.</p>}</div></div>;
}
