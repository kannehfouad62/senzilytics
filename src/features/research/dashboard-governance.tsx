"use client";
import{useActionState}from"react";
import type{ResearchDashboardStatus}from"@prisma/client";
import{initialFormActionState}from"@/core/actions/action-state";
import{changeResearchDashboardStatus}from"@/features/research/dashboard-actions";
import{useRefreshOnSuccess}from"@/features/research/use-refresh-on-success";
export function ResearchDashboardGovernance({dashboardId,next}:{dashboardId:string;next:ResearchDashboardStatus[]}){const[state,action,pending]=useActionState(changeResearchDashboardStatus,initialFormActionState);useRefreshOnSuccess(state);return <form action={action} className="flex flex-wrap items-center gap-2"><input type="hidden" name="dashboardId" value={dashboardId}/>{next.map(status=><button key={status} name="status" value={status} disabled={pending} className="rounded-lg border border-cyan-300/20 px-3 py-1.5 text-xs text-cyan-200 disabled:opacity-40">{status.replaceAll("_"," ")}</button>)}{state.message&&<span className={`text-xs ${state.status==="ERROR"?"text-red-300":"text-emerald-300"}`}>{state.message}</span>}</form>}
