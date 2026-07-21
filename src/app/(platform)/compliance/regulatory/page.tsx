import { RegulatorySourceReviewForm, RegulatorySourceStatusForm } from "@/features/compliance/regulatory-intelligence-forms";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getRegulatoryIntelligenceDashboardService } from "@/modules/compliance/regulatory-intelligence.service";
import { PermissionKey } from "@prisma/client";
import { ArrowLeft, ExternalLink, FileSearch, Plus, Scale } from "lucide-react";
import Link from "next/link";

export default async function RegulatoryIntelligencePage({ searchParams }: { searchParams: Promise<{ sourceId?: string }> }) {
  await requirePermission(PermissionKey.VIEW_COMPLIANCE);
  const [{ organizationId }, permissions, query] = await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions(), searchParams]);
  const { sources, changes, metrics } = await getRegulatoryIntelligenceDashboardService(organizationId);
  const canManage = permissions.includes(PermissionKey.MANAGE_COMPLIANCE);
  const selectedSource = sources.find(source => source.id === query.sourceId);
  return <div>
    <Link href="/compliance" className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16} />Compliance Obligations</Link>
    <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
      <div><p className="flex items-center gap-2 text-sm text-cyan-300"><Scale size={17} />Legal Register Governance</p><h1 className="mt-2 text-4xl font-bold">Regulatory Intelligence</h1><p className="mt-2 max-w-3xl text-slate-400">Monitor authoritative sources, assess regulatory changes with human approval, and trace implementation into obligations and corrective actions.</p></div>
      {canManage && <div className="flex flex-wrap gap-3"><Link href="/compliance/regulatory/sources/new" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3"><Plus size={17} />New Source</Link><Link href="/compliance/regulatory/changes/new" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950"><FileSearch size={17} />Record Change</Link></div>}
    </div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(metrics).map(([label, value]) => <Metric key={label} label={label} value={value} danger={["sourceReviewsOverdue", "assessmentsOverdue", "criticalExposure", "implementationActionsOpen"].includes(label) && value > 0} />)}</div>
    <div className="mt-8 grid gap-6 xl:grid-cols-2">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">Regulatory sources</h2><div className="mt-4 space-y-3">{sources.map(source => <div key={source.id} className="rounded-2xl border border-white/10 p-4"><div className="flex flex-wrap justify-between gap-3"><Link href={`/compliance/regulatory?sourceId=${source.id}`} className="font-semibold text-cyan-200">{source.code} — {source.name}</Link><span className="text-xs">{source.status}</span></div><p className="mt-2 text-xs text-slate-500">{source.authority} · {source.jurisdiction} · Owner {source.owner.name}</p><p className={`mt-2 text-xs ${source.nextReviewAt < new Date() ? "text-red-300" : "text-slate-400"}`}>Next review {source.nextReviewAt.toLocaleDateString()} · {source._count.changes} changes · {source._count.obligations} obligations</p><a href={source.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-300">Official source <ExternalLink size={12} /></a></div>)}{!sources.length && <p className="text-sm text-slate-400">No governed regulatory sources have been registered.</p>}</div></section>
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">Regulatory change pipeline</h2><div className="mt-4 space-y-3">{changes.slice(0, 20).map(change => <Link key={change.id} href={`/compliance/regulatory/changes/${change.id}`} className="block rounded-2xl border border-white/10 p-4 hover:bg-white/5"><div className="flex flex-wrap justify-between gap-3"><span className="font-semibold">{change.reference} — {change.title}</span><span className={change.significance === "CRITICAL" ? "text-red-300" : change.significance === "HIGH" ? "text-amber-300" : "text-slate-300"}>{change.significance}</span></div><p className="mt-2 text-xs text-slate-500">{change.source.name} · {change.status.replaceAll("_", " ")} · Owner {change.owner.name}</p><p className={`mt-2 text-xs ${change.assessmentDueAt < new Date() && ["DETECTED", "UNDER_REVIEW", "IMPACT_ASSESSMENT"].includes(change.status) ? "text-red-300" : "text-slate-400"}`}>Assessment due {change.assessmentDueAt.toLocaleDateString()}{change.effectiveAt ? ` · Effective ${change.effectiveAt.toLocaleDateString()}` : ""}</p></Link>)}{!changes.length && <p className="text-sm text-slate-400">No regulatory change notices have been recorded.</p>}</div></section>
    </div>
    {canManage && selectedSource && <section className="mt-8"><div className="mb-4"><p className="text-sm text-cyan-300">Source governance</p><h2 className="mt-1 text-2xl font-semibold">{selectedSource.code} — {selectedSource.name}</h2></div><div className="grid gap-6 xl:grid-cols-2"><RegulatorySourceReviewForm sourceId={selectedSource.id} /><RegulatorySourceStatusForm sourceId={selectedSource.id} status={selectedSource.status} /></div></section>}
  </div>;
}

function Metric({ label, value, danger }: { label: string; value: number; danger: boolean }) { return <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-wide text-slate-500">{label.replace(/([A-Z])/g, " $1")}</p><p className={`mt-2 text-3xl font-bold ${danger ? "text-red-300" : ""}`}>{value}</p></div>; }
