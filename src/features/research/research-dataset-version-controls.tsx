"use client";

import { ResearchDatasetVersionStatus } from "@prisma/client";
import { useActionState } from "react";
import { initialFormActionState, type FormActionState } from "@/core/actions/action-state";
import { changeResearchDatasetVersionStatus, materializeResearchDatasetVersion } from "@/features/research/dataset-version-actions";
import { useRefreshOnSuccess } from "@/features/research/use-refresh-on-success";

function Feedback({state}:{state:FormActionState}){useRefreshOnSuccess(state);return state.message?<span className={state.status==="ERROR"?"text-xs text-red-300":"text-xs text-emerald-300"}>{state.message}</span>:null}

export function MaterializeDatasetVersion({datasetId}:{datasetId:string}){
  const [state,action,pending]=useActionState(materializeResearchDatasetVersion,initialFormActionState);
  return <form action={action} className="mt-4 flex flex-wrap items-center gap-3"><input type="hidden" name="datasetId" value={datasetId}/><button disabled={pending} className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">{pending?"Generating…":"Generate analysis-ready version"}</button><Feedback state={state}/></form>
}

export function DatasetVersionStatusControl({versionId,target,label}:{versionId:string;target:ResearchDatasetVersionStatus;label:string}){
  const [state,action,pending]=useActionState(changeResearchDatasetVersionStatus,initialFormActionState);
  return <form action={action} className="flex flex-wrap items-center gap-2"><input type="hidden" name="versionId" value={versionId}/><input type="hidden" name="status" value={target}/><button disabled={pending} className="rounded-lg border border-cyan-300/30 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-300/10">{pending?"Updating…":label}</button><Feedback state={state}/></form>
}
