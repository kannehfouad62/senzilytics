"use client";

import { initialFormActionState } from "@/core/actions/action-state";
import { addContractorSite, addContractorWorker, updateContractorStatus } from "@/features/contractors/actions";
import { ContractorStatus, ContractorWorkerStatus } from "@prisma/client";
import { useActionState } from "react";

const input = "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3";
function Feedback({ state }: { state: { status: string; message: string | null } }) {
  if (!state.message) return null;
  return <p role={state.status === "ERROR" ? "alert" : "status"} className={`mt-4 rounded-xl border p-3 text-sm ${state.status === "ERROR" ? "border-red-400/20 bg-red-400/10 text-red-300" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"}`}>{state.message}</p>;
}

export function ContractorStatusForm({ contractorId, currentStatus }: { contractorId: string; currentStatus: ContractorStatus }) {
  const [state, action, pending] = useActionState(updateContractorStatus, initialFormActionState);
  return <form action={action} aria-busy={pending} className="rounded-3xl border border-white/10 bg-white/5 p-6">
    <input type="hidden" name="contractorId" value={contractorId} />
    <h2 className="text-xl font-semibold">Approval & status</h2>
    <p className="mt-2 text-sm text-slate-400">Approval requires a site authorization and valid future-dated insurance.</p>
    <label className="mt-4 block text-sm">Status<select name="status" defaultValue={currentStatus} className={input}>{Object.values(ContractorStatus).map(status => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
    <label className="mt-4 block text-sm">Reason / decision notes<textarea name="reason" rows={3} className={input} /></label>
    <button disabled={pending} className="mt-5 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{pending ? "Saving…" : "Update Status"}</button>
    <Feedback state={state} />
  </form>;
}

export function ContractorSiteForm({ contractorId, sites }: { contractorId: string; sites: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addContractorSite, initialFormActionState);
  return <form action={action} aria-busy={pending} className="rounded-3xl border border-white/10 bg-white/5 p-6">
    <input type="hidden" name="contractorId" value={contractorId} />
    <h2 className="text-xl font-semibold">Authorize site</h2>
    <label className="mt-4 block text-sm">Site<select name="siteId" required className={input}><option value="">Select site</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
    <label className="mt-4 block text-sm">Authorization expires<input type="date" name="expiresAt" className={input} /></label>
    <label className="mt-4 block text-sm">Notes<textarea name="notes" rows={2} className={input} /></label>
    <button disabled={pending || sites.length === 0} className="mt-5 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{pending ? "Saving…" : "Save Authorization"}</button>
    <Feedback state={state} />
  </form>;
}

export function ContractorWorkerForm({ contractorId }: { contractorId: string }) {
  const [state, action, pending] = useActionState(addContractorWorker, initialFormActionState);
  return <form action={action} aria-busy={pending} className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:col-span-2">
    <input type="hidden" name="contractorId" value={contractorId} />
    <h2 className="text-xl font-semibold">Add contractor worker</h2>
    <div className="mt-4 grid gap-4 md:grid-cols-3">
      <Field name="firstName" label="First name" required /><Field name="lastName" label="Last name" required /><Field name="employeeNumber" label="Employee number" />
      <Field name="email" label="Email" type="email" /><Field name="phone" label="Phone" /><Field name="jobTitle" label="Job title" />
      <label className="text-sm">Status<select name="status" defaultValue={ContractorWorkerStatus.PENDING} className={input}>{Object.values(ContractorWorkerStatus).map(status => <option key={status}>{status}</option>)}</select></label>
      <Field name="inductionCompletedAt" label="Induction completed" type="date" /><Field name="inductionExpiresAt" label="Induction expires" type="date" /><Field name="medicalExpiresAt" label="Medical expires" type="date" />
    </div>
    <label className="mt-4 block text-sm">Competencies<textarea name="competencySummary" rows={2} className={input} /></label>
    <label className="mt-4 block text-sm">Notes<textarea name="notes" rows={2} className={input} /></label>
    <button disabled={pending} className="mt-5 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{pending ? "Adding…" : "Add Worker"}</button>
    <Feedback state={state} />
  </form>;
}

function Field({ name, label, type = "text", required = false }: { name: string; label: string; type?: string; required?: boolean }) {
  return <label className="text-sm">{label}<input name={name} type={type} required={required} className={input} /></label>;
}
