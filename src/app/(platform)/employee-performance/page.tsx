import Link from "next/link";
import { PermissionKey } from "@prisma/client";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Download, UserRoundCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  getEmployeePerformanceWorkspace,
  parseEmployeePerformanceFilters,
} from "@/modules/employee-performance/employee-performance.service";
import { EmployeePerformanceCharts } from "@/features/employee-performance/employee-performance-charts";

export const dynamic = "force-dynamic";

export default async function EmployeePerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; search?: string; siteId?: string; departmentId?: string }>;
}) {
  const [{ organizationId, user }, permissions, params] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
    searchParams,
  ]);
  const canViewTeam = permissions.includes(PermissionKey.VIEW_EMPLOYEE_PERFORMANCE);
  const canViewOwn = permissions.includes(PermissionKey.VIEW_OWN_EMPLOYEE_PERFORMANCE);
  if (!canViewTeam && !canViewOwn) redirect("/unauthorized");

  const filters = parseEmployeePerformanceFilters(params);
  const workspace = await getEmployeePerformanceWorkspace({
    organizationId,
    viewerId: user.id,
    canViewTeam,
    ...filters,
  });
  const exportQuery = new URLSearchParams({ days: String(filters.days), ...(filters.search ? { search: filters.search } : {}), ...(filters.siteId ? { siteId: filters.siteId } : {}), ...(filters.departmentId ? { departmentId: filters.departmentId } : {}) }).toString();
  const metrics = [
    { label: "Assigned work", value: workspace.portfolio.assigned, icon: Activity, tone: "text-cyan-300" },
    { label: "Completed", value: workspace.portfolio.completed, icon: CheckCircle2, tone: "text-emerald-300" },
    { label: "On-time completion", value: formatRate(workspace.portfolio.onTimeRate), icon: Clock3, tone: "text-violet-300" },
    { label: "Open overdue", value: workspace.portfolio.overdue, icon: AlertTriangle, tone: workspace.portfolio.overdue ? "text-amber-300" : "text-emerald-300" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300"><UserRoundCheck size={16} />Employee Performance &amp; Accountability</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">Governed work performance</h1>
          <p className="mt-2 max-w-4xl text-slate-400">
            Transparent completion, timeliness, workload and overdue indicators derived from accountable platform work. Every result remains traceable to its source record.
          </p>
        </div>
        <a href={`/api/employee-performance/export?${exportQuery}`} className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950"><Download size={17}/>Export CSV</a>
      </div>

      <form method="get" className="mt-8 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
          <label className="text-xs text-slate-400">Employee search<input name="search" defaultValue={filters.search} placeholder="Name, email, or job title" className="mt-1 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white"/></label>
          <label className="text-xs text-slate-400">Reporting window
            <select name="days" defaultValue={String(filters.days)} className="mt-1 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white">
              <option value="30">Past 30 days</option><option value="90">Past 90 days</option><option value="180">Past 180 days</option><option value="365">Past 365 days</option>
            </select>
          </label>
          <label className="text-xs text-slate-400">Site<select name="siteId" defaultValue={filters.siteId ?? ""} className="mt-1 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white"><option value="">All sites</option>{workspace.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
          <label className="text-xs text-slate-400">Department<select name="departmentId" defaultValue={filters.departmentId ?? ""} className="mt-1 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white"><option value="">All departments</option>{workspace.departments.map((department) => <option key={department.id} value={department.id}>{department.site.name} — {department.name}</option>)}</select></label>
          <button className="self-end rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950">Apply</button>
        </form>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, tone }) => <article key={label} className="rounded-3xl border border-white/10 bg-white/5 p-5"><Icon className={tone} size={22}/><p className="mt-5 text-sm text-slate-400">{label}</p><p className="mt-1 text-3xl font-bold">{value}</p></article>)}
      </div>

      <EmployeePerformanceCharts workload={workspace.charts.workload} trends={workspace.charts.trends}/>

      <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        <div className="border-b border-white/10 p-6"><h2 className="text-xl font-semibold">{canViewTeam ? "Employee portfolio" : "My performance"}</h2><p className="mt-2 text-sm text-slate-400">Completion rates include non-cancelled assigned work. On-time rates use only completed records that have a due date.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-white/10 text-slate-400"><tr><th className="px-6 py-4">Employee</th><th className="px-4 py-4">Assigned</th><th className="px-4 py-4">Completed</th><th className="px-4 py-4">Completion</th><th className="px-4 py-4">On time</th><th className="px-4 py-4">Overdue</th><th className="px-4 py-4">Avg. cycle</th><th className="px-6 py-4">Report</th></tr></thead>
            <tbody>{workspace.employees.map((employee) => <tr key={employee.id} className="border-b border-white/5"><td className="px-6 py-5"><p className="font-medium">{employee.name}</p><p className="mt-1 text-xs text-slate-500">{employee.jobTitle || employee.role.replaceAll("_", " ")} · {employee.departmentName || "No department"}</p></td><td className="px-4 py-5">{employee.summary.assigned}</td><td className="px-4 py-5 text-emerald-300">{employee.summary.completed}</td><td className="px-4 py-5">{formatRate(employee.summary.completionRate)}</td><td className="px-4 py-5">{formatRate(employee.summary.onTimeRate)}</td><td className={employee.summary.overdue ? "px-4 py-5 text-amber-300" : "px-4 py-5 text-slate-400"}>{employee.summary.overdue}</td><td className="px-4 py-5">{employee.summary.averageCompletionDays === null ? "—" : `${employee.summary.averageCompletionDays} days`}</td><td className="px-6 py-5"><Link href={`/employee-performance/${employee.id}?days=${filters.days}`} className="text-cyan-300 hover:text-cyan-200">Open report</Link></td></tr>)}</tbody>
          </table>
        </div>
        {!workspace.employees.length && <p className="p-8 text-center text-slate-500">No active employees are available in this reporting scope.</p>}
      </section>

      <p className="mt-6 rounded-2xl border border-violet-400/20 bg-violet-400/5 p-4 text-xs leading-5 text-slate-400">{workspace.provenance}</p>
    </div>
  );
}

function formatRate(value: number | null) { return value === null ? "—" : `${value}%`; }
