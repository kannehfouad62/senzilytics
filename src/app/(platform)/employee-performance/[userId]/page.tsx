import Link from "next/link";
import { PermissionKey } from "@prisma/client";
import { ArrowLeft, CalendarClock, CheckCircle2, Printer, UserRoundCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  employeeWorkSourceLabels,
  getEmployeePerformanceWorkspace,
  parseEmployeePerformanceWindow,
} from "@/modules/employee-performance/employee-performance.service";

export const dynamic = "force-dynamic";

export default async function EmployeePerformanceReportPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ days?: string }> }) {
  const [{ organizationId, user }, permissions, route, query] = await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions(), params, searchParams]);
  const canViewTeam = permissions.includes(PermissionKey.VIEW_EMPLOYEE_PERFORMANCE);
  const canViewOwn = permissions.includes(PermissionKey.VIEW_OWN_EMPLOYEE_PERFORMANCE);
  if (!canViewTeam && (!canViewOwn || route.userId !== user.id)) redirect("/unauthorized");
  const days = parseEmployeePerformanceWindow(query.days);
  const workspace = await getEmployeePerformanceWorkspace({ organizationId, viewerId: user.id, canViewTeam, days, employeeId: route.userId });
  const employee = workspace.employees[0];
  if (!employee) redirect("/employee-performance");

  return <div>
    <Link href={`/employee-performance?days=${days}`} className="inline-flex items-center gap-2 text-sm text-cyan-300"><ArrowLeft size={16}/>Employee performance</Link>
    <div className="mt-6 flex flex-wrap items-start justify-between gap-5"><div><p className="flex items-center gap-2 text-sm text-violet-300"><UserRoundCheck size={16}/>Individual governed report</p><h1 className="mt-2 text-4xl font-bold">{employee.name}</h1><p className="mt-2 text-slate-400">{employee.jobTitle || employee.role.replaceAll("_", " ")} · {employee.siteName || "No site"} · {employee.departmentName || "No department"}</p></div><div className="flex items-start gap-3"><Link href={`/employee-performance/${employee.id}/print?days=${days}`} className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950"><Printer size={17}/>Print / PDF</Link><div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm"><p className="text-slate-500">Reporting window</p><p className="mt-1 font-medium">{workspace.filters.from.toLocaleDateString()}–{workspace.filters.to.toLocaleDateString()}</p></div></div></div>

    <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Metric label="Assigned" value={employee.summary.assigned}/><Metric label="Completed" value={employee.summary.completed} tone="text-emerald-300"/><Metric label="On-time completion" value={formatRate(employee.summary.onTimeRate)} tone="text-violet-300"/><Metric label="Open overdue" value={employee.summary.overdue} tone={employee.summary.overdue ? "text-amber-300" : "text-emerald-300"}/></div>

    <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">{employee.sources.map((source) => <article key={source.source} className="rounded-3xl border border-white/10 bg-white/5 p-5"><p className="text-sm font-medium">{source.label}</p><p className="mt-4 text-3xl font-bold">{source.summary.completed}<span className="text-base font-normal text-slate-500">/{source.summary.assigned}</span></p><p className="mt-2 text-xs text-slate-500">{formatRate(source.summary.onTimeRate)} on time · {source.summary.overdue} overdue</p></article>)}</section>

    <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5"><div className="border-b border-white/10 p-6"><h2 className="text-xl font-semibold">Source-record evidence</h2><p className="mt-2 text-sm text-slate-400">Open a record to review its scope, evidence and governance history before drawing conclusions.</p></div><div className="divide-y divide-white/5">{employee.records.map((record) => <article key={`${record.source}:${record.id}`} className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">{employeeWorkSourceLabels[record.source]}</p><Link href={record.href} className="mt-1 block font-medium hover:text-cyan-200">{record.title}</Link><p className="mt-2 flex items-center gap-2 text-xs text-slate-500"><CalendarClock size={14}/>{record.dueAt ? `Due ${record.dueAt.toLocaleDateString()}` : "No due date"}</p></div><div className="text-right"><p className={record.completed ? "inline-flex items-center gap-2 text-sm text-emerald-300" : record.dueAt && record.dueAt < workspace.filters.to ? "text-sm text-amber-300" : "text-sm text-slate-300"}>{record.completed && <CheckCircle2 size={15}/>} {record.status.replaceAll("_", " ")}</p>{record.completedAt && <p className="mt-1 text-xs text-slate-500">Completed {record.completedAt.toLocaleDateString()}</p>}</div></article>)}{!employee.records.length && <p className="p-8 text-center text-slate-500">No governed work records were found for this period.</p>}</div></section>
    <p className="mt-6 rounded-2xl border border-violet-400/20 bg-violet-400/5 p-4 text-xs leading-5 text-slate-400">{workspace.provenance}</p>
  </div>;
}

function Metric({ label, value, tone = "text-white" }: { label: string; value: number | string; tone?: string }) { return <article className="rounded-3xl border border-white/10 bg-white/5 p-5"><p className="text-sm text-slate-400">{label}</p><p className={`mt-2 text-3xl font-bold ${tone}`}>{value}</p></article>; }
function formatRate(value: number | null) { return value === null ? "—" : `${value}%`; }
