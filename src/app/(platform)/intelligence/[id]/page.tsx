import { AiAnalysisFeedbackForm, AiAnalysisReviewForm } from "@/features/intelligence/enterprise-ai-forms";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getEnterpriseAiAnalysisService } from "@/modules/intelligence/enterprise-ai.service";
import type { AiIntelligenceDraft } from "@/modules/intelligence/enterprise-ai.types";
import { AiIntelligenceStatus, PermissionKey } from "@prisma/client";
import { ArrowLeft, BrainCircuit, CheckCircle2, ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EnterpriseIntelligenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PermissionKey.VIEW_DASHBOARD);
  await requirePermission(PermissionKey.USE_AI);
  const [{ organizationId, user }, permissions, { id }] = await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions(), params]);
  const analysis = await getEnterpriseAiAnalysisService(organizationId, id);
  if (!analysis) notFound();
  const draft = analysis.responsePayload as unknown as AiIntelligenceDraft;
  const sourceMap = new Map(analysis.sources.map((source) => [source.sourceKey, source]));
  const ownFeedback = analysis.feedback.find((item) => item.userId === user.id);
  const canReview = permissions.includes(PermissionKey.VIEW_REPORTS) && analysis.status === AiIntelligenceStatus.PENDING_REVIEW;

  return <div>
    <Link href="/intelligence" className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16} />Intelligence Workspace</Link>
    <div className="mt-6 flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm text-purple-300"><BrainCircuit size={17} />{pretty(analysis.useCase)}</p><h1 className="mt-2 max-w-4xl text-4xl font-bold">{analysis.title}</h1><p className="mt-2 text-sm text-slate-500">Generated {analysis.createdAt.toLocaleString()} by {analysis.requestedBy.name} · Model {analysis.model}</p></div><Status status={analysis.status} /></div>

    <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/[.05] p-4 text-sm text-amber-100"><ShieldAlert size={18} className="mr-2 inline" />Decision support only. Verify every cited source before acting. This analysis cannot create, update, approve, assign, or close any Senzilytics record.</div>

    {analysis.question && <section className="mt-6 rounded-2xl border border-white/10 bg-white/[.04] p-5"><p className="text-xs uppercase tracking-wide text-slate-500">Management question</p><p className="mt-2 text-slate-200">{analysis.question}</p></section>}

    <section className="mt-6 rounded-3xl border border-purple-400/20 bg-purple-400/[.04] p-6"><h2 className="text-2xl font-semibold">Executive summary</h2><p className="mt-4 leading-7 text-slate-200">{draft.executiveSummary}</p><Citations keys={draft.executiveSummarySourceKeys} sourceMap={sourceMap} /></section>

    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <AnalysisList title="Key risks and exceptions" items={draft.keyRisks.map((item) => ({ heading: `${item.severity} · ${item.title}`, text: item.analysis, keys: item.sourceKeys }))} sourceMap={sourceMap} />
      <AnalysisList title="Management priorities" items={draft.priorities.map((item) => ({ heading: `${pretty(item.urgency)} · ${item.title}`, text: item.rationale, keys: item.sourceKeys }))} sourceMap={sourceMap} />
      <AnalysisList title="Trend assessment" items={draft.trends.map((item) => ({ heading: `${pretty(item.direction)} · ${item.title}`, text: item.analysis, keys: item.sourceKeys }))} sourceMap={sourceMap} />
      <AnalysisList title="Questions leadership should ask" items={draft.managementQuestions.map((item) => ({ heading: item.question, text: item.rationale, keys: item.sourceKeys }))} sourceMap={sourceMap} />
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6"><h2 className="text-xl font-semibold">Confidence: {analysis.confidence}</h2><p className="mt-3 text-sm leading-6 text-slate-300">{analysis.confidenceRationale}</p></section>
      <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6"><h2 className="text-xl font-semibold">Limitations</h2><p className="mt-3 text-sm leading-6 text-slate-300">{analysis.limitations}</p></section>
    </div>

    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[.04] p-6"><h2 className="text-2xl font-semibold">Captured source register</h2><p className="mt-2 text-sm text-slate-400">These tenant-authorized source summaries were frozen when the analysis was generated.</p><div className="mt-5 grid gap-3 lg:grid-cols-2">{analysis.sources.map((source) => <Link key={source.id} href={source.href} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 hover:border-purple-400/30"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-purple-300">{source.sourceKey} · {source.module}</span><ExternalLink size={14} className="text-slate-500" /></div><p className="mt-2 font-medium">{source.title}</p><p className="mt-2 text-sm text-slate-400">{source.summary}</p></Link>)}</div></section>

    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      {canReview ? <AiAnalysisReviewForm analysisId={analysis.id} /> : <ReviewDecision status={analysis.status} reviewer={analysis.reviewedBy?.name ?? null} reviewedAt={analysis.reviewedAt} notes={analysis.reviewNotes} />}
      <AiAnalysisFeedbackForm analysisId={analysis.id} />
    </div>
    {ownFeedback && <p className="mt-3 text-xs text-slate-500">Your current feedback: {pretty(ownFeedback.rating)}{ownFeedback.comment ? ` — ${ownFeedback.comment}` : ""}</p>}
  </div>;
}

type AnalysisResult = NonNullable<Awaited<ReturnType<typeof getEnterpriseAiAnalysisService>>>;
type Source = AnalysisResult["sources"][number];

function Citations({ keys, sourceMap }: { keys: string[]; sourceMap: Map<string, Source> }) {
  const sources = keys.map((key) => sourceMap.get(key)).filter((source): source is Source => Boolean(source));
  if (!sources.length) return null;
  return <div className="mt-4 flex flex-wrap gap-2">{sources.map((source) => <Link key={source.sourceKey} href={source.href} className="rounded-full border border-purple-400/20 px-3 py-1 text-xs text-purple-200">{source.sourceKey} · {source.module}</Link>)}</div>;
}

function AnalysisList({ title, items, sourceMap }: { title: string; items: Array<{ heading: string; text: string; keys: string[] }>; sourceMap: Map<string, Source> }) {
  return <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6"><h2 className="text-xl font-semibold">{title}</h2><div className="mt-4 space-y-4">{items.map((item, index) => <div key={`${item.heading}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><h3 className="font-semibold text-white">{item.heading}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{item.text}</p><Citations keys={item.keys} sourceMap={sourceMap} /></div>)}{!items.length && <p className="text-sm text-slate-500">No source-supported item was identified.</p>}</div></section>;
}

function Status({ status }: { status: AiIntelligenceStatus }) {
  const style = status === AiIntelligenceStatus.APPROVED ? "bg-emerald-400/10 text-emerald-200" : status === AiIntelligenceStatus.REJECTED ? "bg-red-400/10 text-red-200" : "bg-amber-400/10 text-amber-200";
  return <span className={`rounded-full px-4 py-2 text-xs font-semibold ${style}`}>{pretty(status)}</span>;
}

function ReviewDecision({ status, reviewer, reviewedAt, notes }: { status: AiIntelligenceStatus; reviewer: string | null; reviewedAt: Date | null; notes: string | null }) {
  if (status === AiIntelligenceStatus.PENDING_REVIEW) return <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6"><h2 className="text-xl font-semibold">Human disposition</h2><p className="mt-3 text-sm text-slate-400">Your role can view this analysis but cannot approve or reject it.</p></section>;
  return <section className={`rounded-3xl border p-6 ${status === AiIntelligenceStatus.APPROVED ? "border-emerald-400/20 bg-emerald-400/[.04]" : "border-red-400/20 bg-red-400/[.04]"}`}><p className="flex items-center gap-2 text-sm">{status === AiIntelligenceStatus.APPROVED ? <CheckCircle2 size={17} /> : <ShieldAlert size={17} />}{pretty(status)}</p><h2 className="mt-2 text-xl font-semibold">Human review complete</h2><p className="mt-3 text-sm text-slate-300">{reviewer ?? "Authorized reviewer"}{reviewedAt ? ` · ${reviewedAt.toLocaleString()}` : ""}</p>{notes && <p className="mt-3 text-sm leading-6 text-slate-400">{notes}</p>}<p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={14} />Disposition does not execute recommendations.</p></section>;
}

function pretty(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}
