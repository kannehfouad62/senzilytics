"use client";

import { initialFormActionState, type FormActionState } from "@/core/actions/action-state";
import {
  changeRegulatorySourceStatus,
  closeRegulatoryChange,
  createRegulatoryChange,
  createRegulatoryChangeCapa,
  createRegulatorySource,
  linkRegulatoryObligation,
  markRegulatoryChangeImplemented,
  recordRegulatorySourceReview,
  reviewRegulatoryImpactAssessment,
  startRegulatoryChangeReview,
  submitRegulatoryImpactAssessment,
} from "@/features/compliance/regulatory-intelligence.actions";
import { RuntimeFormFields } from "@/features/forms/runtime-form-fields";
import {
  RegulatoryChangeType,
  RegulatoryImpactDecision,
  RegulatoryObligationRelationship,
  RegulatorySourceStatus,
  RegulatorySourceType,
  RiskLevel,
} from "@prisma/client";
import { useActionState, type ReactNode } from "react";

type Option = { id: string; name: string };
type Forms = Parameters<typeof RuntimeFormFields>[0]["forms"];
const input = "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60";
const card = "rounded-3xl border border-white/10 bg-white/5 p-6";
const button = "mt-5 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50";

function Feedback({ state }: { state: FormActionState }) { if (state.status === "IDLE") return null; return <p role={state.status === "ERROR" ? "alert" : "status"} className={`mt-4 rounded-xl border p-3 text-sm ${state.status === "ERROR" ? "border-red-400/20 bg-red-400/10 text-red-200" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"}`}>{state.message}</p>; }
function Field({ name, label, type = "text", required, defaultValue }: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string | number }) { return <label className="text-sm">{label}{required && <span className="text-red-300"> *</span>}<input name={name} type={type} required={required} defaultValue={defaultValue} className={input} /></label>; }
function Area({ name, label, required }: { name: string; label: string; required?: boolean }) { return <label className="mt-4 block text-sm">{label}{required && <span className="text-red-300"> *</span>}<textarea name={name} required={required} rows={3} className={input} /></label>; }
function Select({ name, label, values }: { name: string; label: string; values: readonly string[] }) { return <label className="text-sm">{label}<select name={name} required className={input}>{values.map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>; }
function OptionSelect({ name, label, options, required = true }: { name: string; label: string; options: Option[]; required?: boolean }) { return <label className="text-sm">{label}<select name={name} required={required} className={input}><option value="">Select</option>{options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>; }
function ActionForm({ action, title, children, submitLabel }: { action: (state: FormActionState, data: FormData) => Promise<FormActionState>; title: string; children: ReactNode; submitLabel: string }) { const [state, formAction, pending] = useActionState(action, initialFormActionState); return <form action={formAction} className={card}><h2 className="text-xl font-semibold">{title}</h2>{children}<button disabled={pending} className={button}>{pending ? "Saving…" : submitLabel}</button><Feedback state={state} /></form>; }

export function RegulatorySourceCreateForm({ users }: { users: Option[] }) {
  return <ActionForm action={createRegulatorySource} title="Register regulatory source" submitLabel="Register Source"><div className="mt-4 grid gap-4 md:grid-cols-2"><Field name="code" label="Source code" required /><Field name="name" label="Source name" required /><Field name="authority" label="Issuing authority" required /><Select name="type" label="Source type" values={Object.values(RegulatorySourceType)} /><Field name="jurisdiction" label="Jurisdiction" required /><Field name="sourceUrl" label="Official source URL" type="url" required /><OptionSelect name="ownerId" label="Monitoring owner" options={users} /><Field name="reviewCadenceDays" label="Review cadence (days)" type="number" defaultValue={90} required /><Field name="nextReviewAt" label="Next source review" type="date" required /></div><Area name="description" label="Coverage and monitoring notes" /></ActionForm>;
}

export function RegulatorySourceReviewForm({ sourceId }: { sourceId: string }) { return <ActionForm action={recordRegulatorySourceReview} title="Record source review" submitLabel="Complete Review"><input type="hidden" name="sourceId" value={sourceId} /><Area name="notes" label="Sources checked, changes found, and review conclusion" required /></ActionForm>; }

export function RegulatorySourceStatusForm({ sourceId, status }: { sourceId: string; status: RegulatorySourceStatus }) {
  const choices = Object.values(RegulatorySourceStatus).filter(value => value !== status);
  if (!choices.length) return null;
  return <ActionForm action={changeRegulatorySourceStatus} title="Source lifecycle" submitLabel="Change Status"><input type="hidden" name="sourceId" value={sourceId} /><div className="mt-4"><Select name="status" label="New status" values={choices} /></div><Area name="reason" label="Reason" required /></ActionForm>;
}

export function RegulatoryChangeCreateForm({ sources, users, forms }: { sources: Option[]; users: Option[]; forms: Forms }) {
  const [state, action, pending] = useActionState(createRegulatoryChange, initialFormActionState);
  return <form action={action} className="mt-8 space-y-6 rounded-3xl border border-white/10 bg-white/5 p-7"><div className="grid gap-4 md:grid-cols-3"><OptionSelect name="sourceId" label="Regulatory source" options={sources} /><Field name="reference" label="Change reference" required /><Field name="title" label="Change title" required /><Select name="type" label="Change type" values={Object.values(RegulatoryChangeType)} /><Select name="significance" label="Potential significance" values={Object.values(RiskLevel)} /><OptionSelect name="ownerId" label="Assessment owner" options={users} /><Field name="sourceUrl" label="Official change URL" type="url" required /><Field name="citation" label="Citation / section" required /><Field name="publishedAt" label="Published date" type="date" /><Field name="effectiveAt" label="Effective date" type="date" /><Field name="assessmentDueAt" label="Impact assessment due" type="date" required /></div><Area name="summary" label="Objective change summary (no legal conclusion)" required /><RuntimeFormFields forms={forms} /><Feedback state={state} /><button disabled={pending || !sources.length} className={button}>{pending ? "Creating…" : "Create Change Notice"}</button></form>;
}

export function RegulatoryReviewStartForm({ changeId }: { changeId: string }) { return <ActionForm action={startRegulatoryChangeReview} title="Start triage" submitLabel="Start Review"><input type="hidden" name="changeId" value={changeId} /><Area name="note" label="Review scope and stakeholders" required /></ActionForm>; }

export function RegulatoryImpactAssessmentForm({ changeId }: { changeId: string }) { return <ActionForm action={submitRegulatoryImpactAssessment} title="Submit impact assessment" submitLabel="Submit for Approval"><input type="hidden" name="changeId" value={changeId} /><div className="mt-4 grid gap-4 sm:grid-cols-2"><Select name="decision" label="Applicability recommendation" values={Object.values(RegulatoryImpactDecision)} /><Field name="implementationDueAt" label="Implementation due (required if applicable)" type="date" /></div><Area name="applicabilityRationale" label="Applicability rationale" required /><Area name="impactSummary" label="Operational, legal-register, and control impact" /><Area name="gapSummary" label="Current-state gaps" /><Area name="requiredActions" label="Required implementation actions" /></ActionForm>; }

export function RegulatoryAssessmentReviewForm({ changeId, assessmentId }: { changeId: string; assessmentId: string }) { return <ActionForm action={reviewRegulatoryImpactAssessment} title="Approve impact assessment" submitLabel="Record Decision"><input type="hidden" name="changeId" value={changeId} /><input type="hidden" name="assessmentId" value={assessmentId} /><div className="mt-4"><Select name="decision" label="Decision" values={["APPROVE", "REJECT"]} /></div><Area name="reviewNotes" label="Review rationale" required /></ActionForm>; }

export function RegulatoryObligationLinkForm({ changeId, obligations }: { changeId: string; obligations: Option[] }) { return <ActionForm action={linkRegulatoryObligation} title="Link legal obligation" submitLabel="Link Obligation"><input type="hidden" name="changeId" value={changeId} /><div className="mt-4 grid gap-4 sm:grid-cols-2"><OptionSelect name="complianceItemId" label="Compliance obligation" options={obligations} /><Select name="relationship" label="Relationship" values={Object.values(RegulatoryObligationRelationship)} /></div><Area name="notes" label="How the obligation was created or changed" /></ActionForm>; }

export function RegulatoryCapaForm({ changeId, reference, users }: { changeId: string; reference: string; users: Option[] }) { return <ActionForm action={createRegulatoryChangeCapa} title="Create implementation CAPA" submitLabel="Create CAPA"><input type="hidden" name="changeId" value={changeId} /><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field name="title" label="Action title" defaultValue={`${reference} implementation action`} required /><OptionSelect name="assignedToId" label="Action owner" options={users} /><Field name="dueDate" label="Due date" type="date" required /></div><Area name="description" label="Required change, evidence, and acceptance criteria" /></ActionForm>; }

export function RegulatoryImplementationForm({ changeId }: { changeId: string }) { return <ActionForm action={markRegulatoryChangeImplemented} title="Record implementation" submitLabel="Mark Implemented"><input type="hidden" name="changeId" value={changeId} /><Area name="implementationSummary" label="Implementation evidence, validation, and residual issues" required /></ActionForm>; }

export function RegulatoryCloseForm({ changeId }: { changeId: string }) { return <ActionForm action={closeRegulatoryChange} title="Close change record" submitLabel="Close Change"><input type="hidden" name="changeId" value={changeId} /><Area name="rationale" label="Final closure rationale" required /></ActionForm>; }
