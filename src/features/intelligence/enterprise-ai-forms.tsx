"use client";

import { initialAiIntelligenceActionState } from "@/modules/intelligence/enterprise-ai.types";
import {
  AiIntelligenceFeedbackRating,
  AiIntelligenceUseCase,
} from "@prisma/client";
import { BrainCircuit, CheckCircle2, LoaderCircle, Sparkles, ThumbsDown, ThumbsUp, XCircle } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import {
  generateEnterpriseAiAnalysis,
  recordEnterpriseAiFeedback,
  reviewEnterpriseAiAnalysis,
} from "./enterprise-ai.actions";

const input = "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm outline-none focus:border-purple-400/50";

export function GenerateEnterpriseAiForm() {
  const [state, action, pending] = useActionState(generateEnterpriseAiAnalysis, initialAiIntelligenceActionState);

  return <form action={action} className="rounded-3xl border border-purple-400/20 bg-purple-400/[.05] p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="flex items-center gap-2 text-sm text-purple-300"><BrainCircuit size={17} />Premium AI Intelligence</p><h2 className="mt-2 text-2xl font-semibold">Create a governed analysis</h2><p className="mt-2 max-w-2xl text-sm text-slate-400">The assistant receives only tenant-authorized operational metrics and assurance signals. Its output is saved as a review draft and cannot change platform records.</p></div>
      <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">HUMAN REVIEW REQUIRED</span>
    </div>
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <label className="text-sm">Analysis type
        <select name="useCase" className={input} defaultValue={AiIntelligenceUseCase.DAILY_BRIEFING}>
          <option value={AiIntelligenceUseCase.DAILY_BRIEFING}>Daily leadership briefing</option>
          <option value={AiIntelligenceUseCase.EXECUTIVE_RISK}>Executive risk exposure</option>
          <option value={AiIntelligenceUseCase.AUDIT_FOCUS}>Audit focus</option>
          <option value={AiIntelligenceUseCase.REGULATORY_IMPACT}>Regulatory impact</option>
          <option value={AiIntelligenceUseCase.CONTROL_EFFECTIVENESS}>Control effectiveness</option>
          <option value={AiIntelligenceUseCase.CUSTOM_QUERY}>Custom management question</option>
        </select>
      </label>
      <label className="text-sm">Management question <span className="text-slate-500">(required for custom analysis)</span>
        <textarea name="question" maxLength={1500} rows={4} className={input} placeholder="Example: Which recurring control weaknesses require leadership attention this quarter?" />
      </label>
    </div>
    <div className="mt-5 flex flex-wrap items-center gap-4">
      <button disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-purple-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{pending ? <LoaderCircle size={17} className="animate-spin" /> : <Sparkles size={17} />}{pending ? "Analyzing authorized sources…" : "Generate review draft"}</button>
      <p className="text-xs text-slate-500">No corrective action, risk, status, assignment, or approval is applied automatically.</p>
    </div>
    <ActionFeedback state={state} />
    {state.status === "SUCCESS" && state.analysisId && <Link href={`/intelligence/${state.analysisId}`} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-purple-400/30 px-4 py-2 text-sm text-purple-200">Open generated analysis</Link>}
  </form>;
}

export function AiAnalysisReviewForm({ analysisId }: { analysisId: string }) {
  const [state, action, pending] = useActionState(reviewEnterpriseAiAnalysis, initialAiIntelligenceActionState);

  return <form action={action} className="rounded-3xl border border-amber-400/20 bg-amber-400/[.04] p-6">
    <input type="hidden" name="analysisId" value={analysisId} />
    <h2 className="text-xl font-semibold">Human disposition</h2>
    <p className="mt-2 text-sm text-slate-400">Approval confirms a qualified user reviewed the cited sources and limitations. It does not execute any recommendation.</p>
    <label className="mt-5 block text-sm">Review notes
      <textarea name="notes" maxLength={1500} rows={4} className={input} placeholder="Required when rejecting; optional approval rationale" />
    </label>
    <div className="mt-5 flex flex-wrap gap-3">
      <button name="decision" value="APPROVED" disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"><CheckCircle2 size={17} />Approve analysis</button>
      <button name="decision" value="REJECTED" disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 px-5 py-3 font-semibold text-red-200 disabled:opacity-50"><XCircle size={17} />Reject analysis</button>
    </div>
    <ActionFeedback state={state} />
  </form>;
}

export function AiAnalysisFeedbackForm({ analysisId }: { analysisId: string }) {
  const [state, action, pending] = useActionState(recordEnterpriseAiFeedback, initialAiIntelligenceActionState);

  return <form action={action} className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
    <input type="hidden" name="analysisId" value={analysisId} />
    <h2 className="text-xl font-semibold">Quality feedback</h2>
    <p className="mt-2 text-sm text-slate-400">Your feedback creates an auditable quality signal for improving the assistant.</p>
    <label className="mt-5 block text-sm">Comment
      <textarea name="comment" maxLength={1500} rows={3} className={input} placeholder="What was accurate, missing, or not useful?" />
    </label>
    <div className="mt-4 flex flex-wrap gap-3">
      <button name="rating" value={AiIntelligenceFeedbackRating.HELPFUL} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 px-4 py-2 text-sm text-emerald-200 disabled:opacity-50"><ThumbsUp size={16} />Helpful</button>
      <button name="rating" value={AiIntelligenceFeedbackRating.NOT_HELPFUL} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 px-4 py-2 text-sm text-red-200 disabled:opacity-50"><ThumbsDown size={16} />Not helpful</button>
    </div>
    <ActionFeedback state={state} />
  </form>;
}

function ActionFeedback({ state }: { state: typeof initialAiIntelligenceActionState }) {
  if (state.status === "IDLE" || !state.message) return null;
  return <p role={state.status === "ERROR" ? "alert" : "status"} className={`mt-4 text-sm ${state.status === "ERROR" ? "text-red-300" : "text-emerald-300"}`}>{state.message}</p>;
}
