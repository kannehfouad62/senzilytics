"use client";

import { initialFormActionState } from "@/core/actions/action-state";
import { RuntimeFormFields } from "@/features/forms/runtime-form-fields";
import { createPermitToWork } from "@/features/permits-to-work/actions";
import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";

type RuntimeForms = Parameters<typeof RuntimeFormFields>[0]["forms"];
type Contractor = { id: string; name: string; workers: { id: string; firstName: string; lastName: string; jobTitle: string | null }[] };
export function PermitCreateForm({ children, forms, contractors, defaultContractorId }: { children: ReactNode; forms: RuntimeForms; contractors: Contractor[]; defaultContractorId?: string }) {
  const [state, action, pending] = useActionState(createPermitToWork, initialFormActionState);
  const [contractorId, setContractorId] = useState(defaultContractorId || ""); const contractor = contractors.find(item => item.id === contractorId);
  const input = "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3";
  return <form action={action} aria-busy={pending} className={`mt-8 space-y-6 rounded-3xl border border-white/10 bg-white/5 p-7 ${pending ? "pointer-events-none opacity-70" : ""}`}>
    {children}
    <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-5"><h2 className="text-lg font-semibold">Contractor and work crew</h2><label className="mt-4 block text-sm">Contractor<select name="contractorId" value={contractorId} onChange={event => setContractorId(event.target.value)} className={input}><option value="">Internal work / no contractor</option>{contractors.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{contractor && <fieldset className="mt-4"><legend className="text-sm text-slate-300">Assigned contractor workers</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{contractor.workers.map(worker => <label key={worker.id} className="flex items-center gap-3 rounded-xl border border-white/10 p-3 text-sm"><input type="checkbox" name="workerIds" value={worker.id}/><span>{worker.firstName} {worker.lastName}<span className="block text-xs text-slate-500">{worker.jobTitle || "Worker"}</span></span></label>)}</div>{!contractor.workers.length && <p className="mt-3 text-sm text-amber-300">This contractor has no active workers with current induction.</p>}</fieldset>}</section>
    <RuntimeFormFields forms={forms}/>
    {state.status === "ERROR" && state.message && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">{state.message}</p>}
    <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 pt-6"><Link href="/permits-to-work" className="rounded-xl border border-white/10 px-5 py-3 text-sm text-slate-300">Cancel</Link><button disabled={pending} className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{pending ? "Creating…" : "Create Draft Permit"}</button></div>
  </form>;
}
