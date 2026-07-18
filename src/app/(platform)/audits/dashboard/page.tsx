import { AuditAnalyticsCharts } from "@/features/audits/audit-analytics-charts";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getAuditAnalytics } from "@/modules/audit/audit-analytics.service";
import { PermissionKey } from "@prisma/client";
import { ArrowLeft, BarChart3, CalendarClock, CircleAlert, Gauge, ShieldCheck } from "lucide-react";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function AuditDashboardPage() {
  await requirePermission(PermissionKey.VIEW_AUDITS); const { organizationId } = await getCurrentUserTenant(); const data = await getAuditAnalytics(organizationId);
  return <div><Link href="/audits" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16}/> Back to audits</Link><div className="mt-6"><p className="flex items-center gap-2 text-sm text-cyan-300"><BarChart3 size={16}/> Executive assurance</p><h1 className="mt-2 text-4xl font-bold">Audit Performance</h1><p className="mt-2 text-slate-400">Tenant-scoped delivery, compliance, risk, and finding intelligence. Updated {data.generatedAt.toLocaleString()}.</p></div>
  <div className="my-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Completion rate" value={`${data.summary.completionRate}%`} icon={<Gauge/>}/><Metric label="Average score" value={`${data.summary.averageScore}%`} icon={<ShieldCheck/>}/><Metric label="Overdue audits" value={String(data.summary.overdue)} icon={<CalendarClock/>}/><Metric label="Open findings" value={String(data.summary.openFindings)} icon={<CircleAlert/>}/><Metric label="Repeat findings" value={String(data.summary.repeatFindings)} icon={<CircleAlert/>}/></div>
  <AuditAnalyticsCharts status={data.statusDistribution} type={data.typeDistribution} risk={data.riskDistribution} severity={data.findingSeverityDistribution} trend={data.trend} sites={data.sitePerformance}/>
  <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-lg font-semibold">Management attention</h2>{data.attention.length ? <div className="mt-4 divide-y divide-white/10">{data.attention.map((a)=><Link key={a.id} href={`/audits/${a.id}`} className="flex justify-between gap-4 py-4 text-sm"><span><b>{a.reference}</b> · {a.title}<span className="ml-2 text-slate-500">{a.siteName}</span></span><span className="text-red-300">Due {a.dueDate.toLocaleDateString()}</span></Link>)}</div>:<p className="mt-3 text-sm text-emerald-300">No overdue audits require attention.</p>}</section></div>;
}
function Metric({label,value,icon}:{label:string;value:string;icon:React.ReactNode}){return <div className="rounded-3xl border border-white/10 bg-white/5 p-5"><div className="flex justify-between text-sm text-slate-400"><span>{label}</span><span className="text-cyan-300">{icon}</span></div><p className="mt-3 text-3xl font-bold">{value}</p></div>}
