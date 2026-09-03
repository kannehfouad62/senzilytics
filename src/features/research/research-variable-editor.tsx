"use client";
import { ResearchMeasurementLevel, ResearchVariableDataType } from "@prisma/client";
import { useActionState } from "react";
import { initialFormActionState } from "@/core/actions/action-state";
import { finalizeResearchDictionary, updateResearchVariable } from "@/features/research/import-actions";
import { useRefreshOnSuccess } from "@/features/research/use-refresh-on-success";

export function ResearchVariableEditor({variable}:{variable:{id:string;label:string;dataType:ResearchVariableDataType;measurementLevel:ResearchMeasurementLevel;unit:string|null;missingValues:string[]}}){
 const[state,action,pending]=useActionState(updateResearchVariable,initialFormActionState);useRefreshOnSuccess(state);
 return <form action={action} className="grid gap-2 border-t border-white/10 py-3 lg:grid-cols-[1.2fr_.7fr_.7fr_.6fr_1fr_auto]"><input type="hidden" name="variableId" value={variable.id}/><input name="label" defaultValue={variable.label} required className={input}/><select name="dataType" defaultValue={variable.dataType} className={input}>{Object.values(ResearchVariableDataType).map(v=><option key={v}>{v}</option>)}</select><select name="measurementLevel" defaultValue={variable.measurementLevel} className={input}>{Object.values(ResearchMeasurementLevel).map(v=><option key={v}>{v}</option>)}</select><input name="unit" defaultValue={variable.unit??""} placeholder="Unit" className={input}/><input name="missingValues" defaultValue={variable.missingValues.join(", ")} placeholder="Missing codes" className={input}/><button disabled={pending} className="rounded-lg border border-cyan-400/25 px-3 text-xs text-cyan-200">Save</button>{state.message&&<p className="lg:col-span-6 text-xs text-slate-400">{state.message}</p>}</form>
}
export function FinalizeDictionary({datasetId}:{datasetId:string}){const[state,action,pending]=useActionState(finalizeResearchDictionary,initialFormActionState);useRefreshOnSuccess(state);return <form action={action} className="mt-4 flex items-center gap-3"><input type="hidden" name="datasetId" value={datasetId}/><button disabled={pending} className="rounded-xl bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950">Complete mapping</button>{state.message&&<span className="text-xs text-slate-400">{state.message}</span>}</form>}
const input="min-w-0 rounded-lg border border-white/10 bg-slate-950/80 px-2 py-2 text-xs";
