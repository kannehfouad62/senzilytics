import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey, Status } from "@prisma/client";
import Link from "next/link";

export default async function TrainingDashboard() {
  await requirePermission(PermissionKey.VIEW_TRAINING);
  const { organizationId } = await getCurrentUserTenant();
  const now = new Date();
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 30);
  const records = await prisma.trainingRecord.findMany({ where: { user: { organizationId } }, include: { user: { include: { department: { include: { site: true } } } } } });
  const total = records.length;
  const completed = records.filter((record) => record.status === Status.COMPLETED).length;
  const overdue = records.filter((record) => record.status !== Status.COMPLETED && record.dueDate && record.dueDate < now).length;
  const expiring = records.filter((record) => record.expiresAt && record.expiresAt >= now && record.expiresAt <= soon).length;
  const groups = new Map<string, { name: string; total: number; complete: number; overdue: number }>();
  for (const record of records) {
    const name = record.user.department?.site.name || "Unassigned";
    const group = groups.get(name) || { name, total: 0, complete: 0, overdue: 0 };
    group.total += 1;
    if (record.status === Status.COMPLETED) group.complete += 1;
    if (record.status !== Status.COMPLETED && record.dueDate && record.dueDate < now) group.overdue += 1;
    groups.set(name, group);
  }
  return <div><div className="flex justify-between"><div><p className="text-sm text-cyan-300">Competency Intelligence</p><h1 className="mt-2 text-4xl font-bold">Training Analytics</h1></div><Link href="/training/requirements" className="h-fit rounded-xl border border-white/10 px-4 py-2">Requirements</Link></div><div className="mt-8 grid gap-4 md:grid-cols-4">{[["Assignments", total], ["Completion rate", `${total ? Math.round(completed / total * 100) : 0}%`], ["Overdue", overdue], ["Expiring in 30 days", expiring]].map(([label, value]) => <div key={label} className="rounded-3xl border border-white/10 bg-white/5 p-6"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}</div><section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">Site Compliance Matrix</h2><div className="mt-5 space-y-3">{[...groups.values()].map((group) => <div key={group.name} className="grid grid-cols-4 rounded-xl bg-slate-950/50 p-4"><span>{group.name}</span><span>{group.complete}/{group.total} complete</span><span>{group.total ? Math.round(group.complete / group.total * 100) : 0}%</span><span className={group.overdue ? "text-red-300" : "text-emerald-300"}>{group.overdue} overdue</span></div>)}</div></section></div>;
}
