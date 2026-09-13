import Link from "next/link";
import { AlertTriangle, Clock3, DatabaseZap, Download, FileCheck2, ShieldAlert, Users } from "lucide-react";
import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getResearchGovernanceReport } from "@/modules/research/research-governance-monitor.service";

export const dynamic = "force-dynamic";

export default async function ResearchGovernanceDashboard() {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId } = await getCurrentUserTenant();
  const report = await getResearchGovernanceReport(organizationId);
  const metrics = [
    ["Research projects", report.summary.projects, DatabaseZap],
    ["Consent due ≤30 days", report.summary.expiringConsent, Users],
    ["Approvals due ≤30 days", report.summary.expiringRecords, FileCheck2],
    ["Disposal due ≤30 days", report.summary.disposalDue, Clock3],
    ["Access awaiting decision", report.summary.pendingAccess, ShieldAlert],
    ["High privacy risk", report.summary.highRisk, AlertTriangle],
  ] as const;
  return <div><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-sm text-cyan-300">Research Governance Assurance</p><h1 className="mt-2 text-4xl font-bold">Governance Monitoring</h1><p className="mt-2 max-w-3xl text-slate-400">Tenant-wide visibility of consent, protocol approvals, disposal duties, privacy risk, and governed dataset access.</p></div><a href="/api/research/consent-evidence/export" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950"><Download size={17}/>Export consent evidence</a></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{metrics.map(([label, value, Icon]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[.04] p-5"><div className="flex items-center justify-between"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><Icon size={17} className={value > 0 && label !== "Research projects" ? "text-amber-300" : "text-cyan-300"}/></div><p className="mt-3 text-3xl font-bold">{value}</p></div>)}</div>
    {report.summary.failedEmails > 0 ? <p className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">{report.summary.failedEmails} governance reminder email dispatches require operational review. In-app and push evidence remains recorded.</p> : null}
    <div className="mt-8 grid gap-6 xl:grid-cols-2"><Register title="Approval and protocol expiries">{report.upcomingRecords.map(record => <Link key={record.id} href={`/research/projects/${record.project.id}/governance`} className="block rounded-xl border border-white/10 bg-slate-950/40 p-4"><p className="text-xs text-cyan-300">{record.project.reference} · {pretty(record.status)}</p><h3 className="mt-1 font-semibold">{record.reference} — {record.title}</h3><p className="mt-2 text-xs text-slate-500">Due {record.expiresAt?.toLocaleDateString()}</p></Link>)}{!report.upcomingRecords.length ? <Empty/> : null}</Register><Register title="Data disposal schedule">{report.upcomingPlans.map(plan => <Link key={plan.id} href={`/research/projects/${plan.project.id}/data-governance`} className="block rounded-xl border border-white/10 bg-slate-950/40 p-4"><p className="text-xs text-violet-300">{plan.project.reference} · {pretty(plan.status)}</p><h3 className="mt-1 font-semibold">{plan.project.title}</h3><p className="mt-2 text-xs text-slate-500">Disposal due {plan.scheduledDisposalAt.toLocaleDateString()}</p></Link>)}{!report.upcomingPlans.length ? <Empty/> : null}</Register></div>
  </div>;
}

function Register({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-white/10 bg-white/[.035] p-6"><h2 className="text-xl font-semibold">{title}</h2><div className="mt-5 space-y-3">{children}</div></section>; }
function Empty() { return <p className="text-sm text-slate-500">No items are due within the monitoring window.</p>; }
function pretty(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()); }
