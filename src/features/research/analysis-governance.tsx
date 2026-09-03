"use client";

import { useActionState } from "react";
import { ResearchAnalysisStatus } from "@prisma/client";

import { initialFormActionState } from "@/core/actions/action-state";
import { changeResearchAnalysisStatus } from "@/features/research/analysis-actions";
import { useRefreshOnSuccess } from "@/features/research/use-refresh-on-success";

export function AnalysisGovernanceControl({ analysisId, nextStatuses }: { analysisId: string; nextStatuses: ResearchAnalysisStatus[] }) {
  const [state, action, pending] = useActionState(changeResearchAnalysisStatus, initialFormActionState);
  useRefreshOnSuccess(state);
  if (!nextStatuses.length) return null;
  return <form action={action} className="flex flex-wrap items-center gap-2">
    <input type="hidden" name="analysisId" value={analysisId}/>
    <select name="status" className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-xs">{nextStatuses.map(status => <option key={status}>{status}</option>)}</select>
    <button disabled={pending} className="rounded-xl border border-cyan-300/25 px-3 py-2 text-xs text-cyan-300 disabled:opacity-50">{pending ? "Updating…" : "Apply gate"}</button>
    {state.message && <span className={`text-xs ${state.status === "ERROR" ? "text-red-300" : "text-emerald-300"}`}>{state.message}</span>}
  </form>;
}
