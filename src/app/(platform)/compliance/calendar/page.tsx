import { hasPermission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { ComplianceCalendarOccurrenceStatus, PermissionKey } from "@prisma/client";
import { BarChart3, CalendarDays, Plus } from "lucide-react";
import Link from "next/link";

const statusColor: Record<ComplianceCalendarOccurrenceStatus, string> = { UPCOMING: "text-slate-300", DUE: "text-amber-300", IN_PROGRESS: "text-cyan-300", SUBMITTED: "text-violet-300", COMPLETED: "text-emerald-300", REJECTED: "text-red-300", OVERDUE: "text-red-300", CANCELLED: "text-slate-500" };

export default async function ComplianceCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; scope?: string }> }) {
  await requirePermission(PermissionKey.VIEW_COMPLIANCE);
  const [{ organizationId, user }, canManage, query] = await Promise.all([getCurrentUserTenant(), hasPermission(PermissionKey.MANAGE_COMPLIANCE), searchParams]);
  const selected = /^\d{4}-\d{2}$/.test(query.month || "") ? query.month! : new Date().toISOString().slice(0, 7);
  const start = new Date(`${selected}-01T00:00:00.000Z`); const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
  const occurrences = await prisma.complianceCalendarOccurrence.findMany({ where: { organizationId, dueAt: { gte: start, lt: end }, ...(query.scope === "mine" ? { assignedToId: user.id } : {}) }, include: { task: true, site: true, department: true, assignedTo: true }, orderBy: { dueAt: "asc" } });
  const days = Array.from({ length: new Date(start.getUTCFullYear(), start.getUTCMonth() + 1, 0).getDate() }, (_, index) => index + 1);
  const previous = new Date(start); previous.setUTCMonth(previous.getUTCMonth() - 1); const next = new Date(start); next.setUTCMonth(next.getUTCMonth() + 1);
  return <div><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm text-cyan-300"><CalendarDays size={17}/>Operational Assurance</p><h1 className="mt-2 text-4xl font-bold">Compliance Calendar</h1><p className="mt-2 text-slate-400">Recurring obligations, clear ownership, evidence, approvals and escalation.</p></div><div className="flex flex-wrap gap-3"><Link href="/compliance/calendar/analytics" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2"><BarChart3 size={16}/>Analytics</Link>{canManage && <Link href="/compliance/calendar/new" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 font-semibold text-slate-950"><Plus size={16}/>New Calendar Task</Link>}</div></div>
    <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex gap-2"><Link href={`?month=${selected}`} className={`rounded-lg px-3 py-2 text-sm ${query.scope !== "mine" ? "bg-cyan-300 text-slate-950" : "bg-white/5"}`}>Organization</Link><Link href={`?month=${selected}&scope=mine`} className={`rounded-lg px-3 py-2 text-sm ${query.scope === "mine" ? "bg-cyan-300 text-slate-950" : "bg-white/5"}`}>My tasks</Link></div><div className="flex items-center gap-3"><Link href={`?month=${previous.toISOString().slice(0,7)}${query.scope === "mine" ? "&scope=mine" : ""}`}>← Previous</Link><strong>{start.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</strong><Link href={`?month=${next.toISOString().slice(0,7)}${query.scope === "mine" ? "&scope=mine" : ""}`}>Next →</Link></div></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">{days.map((day) => { const items = occurrences.filter((item) => item.dueAt.getUTCDate() === day); return <section key={day} className="min-h-36 rounded-2xl border border-white/10 bg-white/[.04] p-3"><p className="text-sm font-semibold text-slate-400">{day}</p><div className="mt-2 space-y-2">{items.map((item) => <Link key={item.id} href={`/compliance/calendar/${item.id}`} className="block rounded-xl bg-slate-950/70 p-3 text-xs"><p className="font-medium text-white">{item.task.title}</p><p className={`mt-1 ${statusColor[item.status]}`}>{item.status.replaceAll("_", " ")}</p><p className="mt-1 text-slate-500">{item.site.name} · {item.assignedTo.name}</p></Link>)}</div></section>; })}</div>
  </div>;
}
