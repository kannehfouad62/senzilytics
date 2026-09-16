import Link from "next/link";
import { PermissionKey } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { PrintReportButton } from "@/features/reports/print-report-button";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { employeeWorkSourceLabels, getEmployeePerformanceWorkspace, parseEmployeePerformanceWindow } from "@/modules/employee-performance/employee-performance.service";

export const dynamic = "force-dynamic";

export default async function PrintableEmployeePerformanceReport({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ days?: string }> }) {
  const [{ organizationId, organization, user }, permissions, route, query] = await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions(), params, searchParams]);
  const canViewTeam = permissions.includes(PermissionKey.VIEW_EMPLOYEE_PERFORMANCE);
  const canViewOwn = permissions.includes(PermissionKey.VIEW_OWN_EMPLOYEE_PERFORMANCE);
  if (!canViewTeam && (!canViewOwn || route.userId !== user.id)) redirect("/unauthorized");
  const days = parseEmployeePerformanceWindow(query.days);
  const workspace = await getEmployeePerformanceWorkspace({ organizationId, viewerId: user.id, canViewTeam, days, employeeId: route.userId });
  const employee = workspace.employees[0];
  if (!employee) redirect("/employee-performance");

  return <article className="mx-auto max-w-5xl print:max-w-none print:bg-white print:text-black">
    <div className="mb-8 flex items-center justify-between print:hidden"><Link href={`/employee-performance/${employee.id}?days=${days}`} className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16}/>Individual report</Link><PrintReportButton/></div>
    <header className="border-b border-white/10 pb-6 print:border-black/20"><p className="text-sm font-semibold uppercase tracking-widest text-cyan-300 print:text-slate-600">{organization?.name} · Employee Performance &amp; Accountability</p><h1 className="mt-3 text-4xl font-bold">{employee.name}</h1><p className="mt-2 text-slate-400 print:text-slate-700">{employee.jobTitle || employee.role.replaceAll("_", " ")} · {employee.siteName || "No site"} · {employee.departmentName || "No department"}</p><p className="mt-2 text-sm text-slate-500 print:text-slate-600">Reporting period {workspace.filters.from.toLocaleDateString()}–{workspace.filters.to.toLocaleDateString()} · Generated {new Date().toLocaleString()}</p></header>
    <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">{[["Assigned", employee.summary.assigned], ["Completed", employee.summary.completed], ["Completion rate", formatRate(employee.summary.completionRate)], ["On-time rate", formatRate(employee.summary.onTimeRate)], ["Open", employee.summary.open], ["Overdue", employee.summary.overdue], ["Average completion", employee.summary.averageCompletionDays === null ? "—" : `${employee.summary.averageCompletionDays} days`]].map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 p-4 print:border-black/20"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}</section>
    <section className="mt-8"><h2 className="text-xl font-semibold">Work-source summary</h2><table className="mt-4 w-full border-collapse text-sm"><thead><tr className="border-b border-white/10 print:border-black/20"><th className="py-3 text-left">Source</th><th className="py-3 text-right">Assigned</th><th className="py-3 text-right">Completed</th><th className="py-3 text-right">On time</th><th className="py-3 text-right">Overdue</th></tr></thead><tbody>{employee.sources.map((source) => <tr key={source.source} className="border-b border-white/5 print:border-black/10"><td className="py-3">{source.label}</td><td className="py-3 text-right">{source.summary.assigned}</td><td className="py-3 text-right">{source.summary.completed}</td><td className="py-3 text-right">{formatRate(source.summary.onTimeRate)}</td><td className="py-3 text-right">{source.summary.overdue}</td></tr>)}</tbody></table></section>
    <section className="mt-8 break-before-page"><h2 className="text-xl font-semibold">Source-record register</h2><div className="mt-4 divide-y divide-white/5 print:divide-black/10">{employee.records.map((record) => <div key={`${record.source}:${record.id}`} className="grid grid-cols-[1fr_auto] gap-4 py-3 text-sm"><div><p className="font-medium">{record.title}</p><p className="text-xs text-slate-500">{employeeWorkSourceLabels[record.source]} · {record.id}</p></div><div className="text-right"><p>{record.status.replaceAll("_", " ")}</p><p className="text-xs text-slate-500">{record.dueAt ? `Due ${record.dueAt.toLocaleDateString()}` : "No due date"}</p></div></div>)}</div></section>
    <footer className="mt-8 border-t border-white/10 pt-4 text-xs leading-5 text-slate-500 print:border-black/20">{workspace.provenance}</footer>
  </article>;
}

function formatRate(value: number | null) { return value === null ? "—" : `${value}%`; }
