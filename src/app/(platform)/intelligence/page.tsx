import { GenerateEnterpriseAiForm } from "@/features/intelligence/enterprise-ai-forms";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { listEnterpriseAiAnalysesService } from "@/modules/intelligence/enterprise-ai.service";
import { AiIntelligenceStatus, PermissionKey } from "@prisma/client";
import { BrainCircuit, CheckCircle2, Clock3, DatabaseZap, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EnterpriseIntelligencePage() {
  await requirePermission(PermissionKey.VIEW_DASHBOARD);
  await requirePermission(PermissionKey.USE_AI);
  const { organizationId } = await getCurrentUserTenant();
  const analyses = await listEnterpriseAiAnalysesService(organizationId);
  const pending = analyses.filter((item) => item.status === AiIntelligenceStatus.PENDING_REVIEW).length;
  const approved = analyses.filter((item) => item.status === AiIntelligenceStatus.APPROVED).length;
  const rejected = analyses.filter((item) => item.status === AiIntelligenceStatus.REJECTED).length;

  return <div>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="flex items-center gap-2 text-sm text-purple-300"><BrainCircuit size={18} />Governed Premium Intelligence</p><h1 className="mt-2 text-4xl font-bold">EHS Intelligence Workspace</h1><p className="mt-2 max-w-3xl text-slate-400">Generate cross-module leadership analysis from permission-filtered tenant data, preserve its sources, and record a qualified human review decision.</p></div>
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[.05] px-4 py-3 text-sm text-emerald-200"><ShieldCheck size={17} className="mr-2 inline" />Review-only · no autonomous record changes</div>
    </div>

    <div className="mt-8 grid gap-4 sm:grid-cols-3">
      <Metric icon={Clock3} label="Pending human review" value={pending} tone="text-amber-300" />
      <Metric icon={CheckCircle2} label="Approved analyses" value={approved} tone="text-emerald-300" />
      <Metric icon={XCircle} label="Rejected analyses" value={rejected} tone="text-red-300" />
    </div>

    <div className="mt-8"><GenerateEnterpriseAiForm /></div>

    <section className="mt-8 rounded-3xl border border-white/10 bg-white/[.04] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-sm text-cyan-300"><DatabaseZap size={16} />Auditable analysis register</p><h2 className="mt-2 text-2xl font-semibold">Recent intelligence</h2></div><p className="text-xs text-slate-500">Latest 50 analyses</p></div>
      <div className="mt-5 space-y-3">
        {analyses.map((analysis) => <Link key={analysis.id} href={`/intelligence/${analysis.id}`} className="block rounded-2xl border border-white/10 bg-slate-950/40 p-4 transition hover:border-purple-400/30">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-purple-300">{label(analysis.useCase)}</p><h3 className="mt-1 font-semibold text-white">{analysis.title}</h3><p className="mt-2 text-sm text-slate-400 line-clamp-2">{analysis.executiveSummary}</p></div><Status status={analysis.status} /></div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500"><span>Requested by {analysis.requestedBy.name}</span><span>{analysis.createdAt.toLocaleString()}</span><span>{analysis._count.sources} cited sources</span><span>{analysis._count.feedback} feedback record{analysis._count.feedback === 1 ? "" : "s"}</span>{analysis.reviewedBy && <span>Reviewed by {analysis.reviewedBy.name}</span>}</div>
        </Link>)}
        {!analyses.length && <p className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">No governed AI analyses have been generated for this organization.</p>}
      </div>
    </section>
  </div>;
}

function Metric({ icon: Icon, label: metricLabel, value, tone }: { icon: typeof Clock3; label: string; value: number; tone: string }) {
  return <div className="rounded-3xl border border-white/10 bg-white/[.04] p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-400">{metricLabel}</p><p className={`mt-2 text-3xl font-bold ${tone}`}>{value}</p></div><Icon className={tone} /></div></div>;
}

function Status({ status }: { status: AiIntelligenceStatus }) {
  const tone = status === AiIntelligenceStatus.APPROVED ? "bg-emerald-400/10 text-emerald-200" : status === AiIntelligenceStatus.REJECTED ? "bg-red-400/10 text-red-200" : "bg-amber-400/10 text-amber-200";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{status.replaceAll("_", " ")}</span>;
}

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}
