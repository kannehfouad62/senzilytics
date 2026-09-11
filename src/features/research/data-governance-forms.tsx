"use client";

import { useActionState } from "react";
import {
  ResearchDataDisposalMethod,
  ResearchDataLifecycleStatus,
  ResearchDatasetAccessLevel,
  ResearchDatasetAccessStatus,
  ResearchDisclosureRisk,
  ResearchPrivacyReviewStatus,
  ResearchPrivacyReviewType,
} from "@prisma/client";
import { initialFormActionState, type FormActionState } from "@/core/actions/action-state";
import {
  changeDataLifecycleStatusAction,
  changePrivacyReviewStatusAction,
  createPrivacyReviewAction,
  decideDatasetAccessAction,
  requestDatasetAccessAction,
  saveDataLifecyclePlanAction,
} from "@/features/research/data-governance-actions";
import { useRefreshOnSuccess } from "@/features/research/use-refresh-on-success";
import { dataLifecycleTransitions, datasetAccessTransitions, privacyReviewTransitions } from "@/modules/research/research-data-governance";

const field = "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm";

export function DataLifecyclePlanForm({ projectId, users, defaultRetentionDays }: { projectId: string; users: Array<{ id: string; name: string }>; defaultRetentionDays: number | null }) {
  const [state, action, pending] = useActionState(saveDataLifecyclePlanAction, initialFormActionState); useRefreshOnSuccess(state);
  return <Form action={action} title="Data retention and disposal plan"><input type="hidden" name="projectId" value={projectId}/><div className="grid gap-4 md:grid-cols-2"><Label text="Retention days"><input name="retentionDays" type="number" min="1" max="36500" defaultValue={defaultRetentionDays ?? 2555} required className={field}/></Label><Label text="Scheduled disposal"><input name="scheduledDisposalAt" type="date" required className={field}/></Label><Label text="Disposal method"><select name="disposalMethod" className={field}>{Object.values(ResearchDataDisposalMethod).map(value=><option key={value} value={value}>{pretty(value)}</option>)}</select></Label><Label text="Accountable owner"><select name="ownerId" required className={field}><option value="">Select owner</option>{users.map(user=><option key={user.id} value={user.id}>{user.name}</option>)}</select></Label></div><Label text="Legal, contractual, ethics, or operational retention basis"><textarea name="retentionBasis" minLength={20} required rows={4} className={field}/></Label><Submit pending={pending} label="Save lifecycle plan"/><Feedback state={state}/></Form>;
}

export function DataLifecycleStatusForm({ projectId, planId, status, canApprove }: { projectId: string; planId: string; status: ResearchDataLifecycleStatus; canApprove: boolean }) {
  const [state, action, pending] = useActionState(changeDataLifecycleStatusAction, initialFormActionState); useRefreshOnSuccess(state);
  const next = dataLifecycleTransitions[status].filter(value => value !== ResearchDataLifecycleStatus.ACTIVE || status !== ResearchDataLifecycleStatus.DRAFT || canApprove); if (!next.length) return null;
  return <form action={action} className="mt-4 grid gap-3 md:grid-cols-[.8fr_1fr_1fr_auto]"><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="planId" value={planId}/><select name="status" className={field}>{next.map(value=><option key={value} value={value}>{pretty(value)}</option>)}</select><input name="reason" placeholder="Legal-hold reason, when applicable" className={field}/><input name="evidence" placeholder="Disposal evidence reference" className={field}/><Submit pending={pending} label="Apply"/><Feedback state={state}/></form>;
}

export function PrivacyReviewForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(createPrivacyReviewAction, initialFormActionState); useRefreshOnSuccess(state);
  return <Form action={action} title="De-identification and disclosure-risk review"><input type="hidden" name="projectId" value={projectId}/><div className="grid gap-4 md:grid-cols-2"><Label text="Dataset reference"><input name="datasetReference" required maxLength={100} className={field}/></Label><Label text="Review type"><select name="type" className={field}>{Object.values(ResearchPrivacyReviewType).map(value=><option key={value} value={value}>{pretty(value)}</option>)}</select></Label><Label text="Residual disclosure risk"><select name="residualRisk" className={field}>{Object.values(ResearchDisclosureRisk).map(value=><option key={value} value={value}>{pretty(value)}</option>)}</select></Label><Label text="Evidence reference"><input name="evidenceReference" required maxLength={500} className={field}/></Label></div><label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" name="directIdentifiersRemoved"/>Direct identifiers have been removed</label><Label text="Review or de-identification method"><textarea name="method" required minLength={10} rows={3} className={field}/></Label><Label text="Quasi-identifier controls"><textarea name="quasiIdentifierControls" rows={3} className={field}/></Label><Label text="Findings"><textarea name="findings" required minLength={20} rows={4} className={field}/></Label><Label text="Mitigation (required for high or critical risk)"><textarea name="mitigation" rows={3} className={field}/></Label><Submit pending={pending} label="Create privacy review"/><Feedback state={state}/></Form>;
}

export function PrivacyReviewStatusForm({ projectId, reviewId, status, canApprove }: { projectId: string; reviewId: string; status: ResearchPrivacyReviewStatus; canApprove: boolean }) {
  const [state, action, pending] = useActionState(changePrivacyReviewStatusAction, initialFormActionState); useRefreshOnSuccess(state); const next = privacyReviewTransitions[status].filter(value => value !== ResearchPrivacyReviewStatus.APPROVED || canApprove); if (!next.length) return null;
  return <form action={action} className="flex items-end gap-2"><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="reviewId" value={reviewId}/><select name="status" className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs">{next.map(value=><option key={value} value={value}>{pretty(value)}</option>)}</select><Submit pending={pending} label="Apply"/><Feedback state={state}/></form>;
}

export function DatasetAccessRequestForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(requestDatasetAccessAction, initialFormActionState); useRefreshOnSuccess(state);
  return <Form action={action} title="Request governed dataset access"><input type="hidden" name="projectId" value={projectId}/><div className="grid gap-4 md:grid-cols-2"><Label text="Dataset reference"><input name="datasetReference" required maxLength={100} className={field}/></Label><Label text="Access level"><select name="accessLevel" className={field}>{Object.values(ResearchDatasetAccessLevel).map(value=><option key={value} value={value}>{pretty(value)}</option>)}</select></Label><Label text="Access starts"><input name="accessStartsAt" type="date" className={field}/></Label><Label text="Access expires"><input name="accessExpiresAt" type="date" className={field}/></Label></div><Label text="Research purpose"><textarea name="purpose" required minLength={20} rows={3} className={field}/></Label><Label text="Requested variables, records, and scope"><textarea name="scope" required minLength={20} rows={3} className={field}/></Label><Label text="Security and confidentiality safeguards"><textarea name="safeguards" required minLength={20} rows={3} className={field}/></Label><Submit pending={pending} label="Submit access request"/><Feedback state={state}/></Form>;
}

export function DatasetAccessDecisionForm({ projectId, requestId, status, canApprove }: { projectId: string; requestId: string; status: ResearchDatasetAccessStatus; canApprove: boolean }) {
  const [state, action, pending] = useActionState(decideDatasetAccessAction, initialFormActionState); useRefreshOnSuccess(state); const next = datasetAccessTransitions[status].filter(() => canApprove); if (!next.length) return null;
  return <form action={action} className="mt-3 flex flex-wrap items-end gap-2"><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="requestId" value={requestId}/><select name="status" className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs">{next.map(value=><option key={value} value={value}>{pretty(value)}</option>)}</select><input name="reason" required minLength={10} placeholder="Decision reason" className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs"/><Submit pending={pending} label="Record"/><Feedback state={state}/></form>;
}

function Form({ action, title, children }: { action: (data: FormData) => void; title: string; children: React.ReactNode }) { return <form action={action} className="rounded-3xl border border-white/10 bg-white/[.04] p-6"><h2 className="text-xl font-semibold">{title}</h2>{children}</form>; }
function Label({ text, children }: { text: string; children: React.ReactNode }) { return <label className="mt-4 block text-sm text-slate-200">{text}{children}</label>; }
function Submit({ pending, label }: { pending: boolean; label: string }) { return <button disabled={pending} className="mt-4 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950">{pending ? "Working…" : label}</button>; }
function Feedback({ state }: { state: FormActionState }) { return state.status === "IDLE" ? null : <p className={`mt-2 text-sm ${state.status === "ERROR" ? "text-red-300" : "text-emerald-300"}`}>{state.message}</p>; }
function pretty(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()); }
