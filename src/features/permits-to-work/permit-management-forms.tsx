"use client";

import { initialFormActionState } from "@/core/actions/action-state";
import { assignPermitWorker, recordPermitGasTest, transitionPermitToWork, verifyPermitControl } from "@/features/permits-to-work/actions";
import { getPermitToWorkNextStatuses } from "@/modules/permits-to-work/permit-to-work-lifecycle";
import { PermitGasTestResult, PermitToWorkStatus } from "@prisma/client";
import { useActionState } from "react";

const input = "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3";
function Feedback({ state }: { state: { status: string; message: string | null } }) { if (!state.message) return null; return <p role={state.status === "ERROR" ? "alert" : "status"} className={`mt-4 rounded-xl border p-3 text-sm ${state.status === "ERROR" ? "border-red-400/20 bg-red-400/10 text-red-300" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"}`}>{state.message}</p>; }

export function PermitTransitionForm({ permitId, currentStatus }: { permitId: string; currentStatus: PermitToWorkStatus }) {
  const [state, action, pending] = useActionState(transitionPermitToWork, initialFormActionState); const statuses = getPermitToWorkNextStatuses(currentStatus);
  if (!statuses.length) return <section className="rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">Lifecycle complete</h2><p className="mt-2 text-sm text-slate-400">This permit is in a terminal state and cannot be advanced.</p></section>;
  return <form action={action} aria-busy={pending} className="rounded-3xl border border-white/10 bg-white/5 p-6"><input type="hidden" name="permitId" value={permitId}/><h2 className="text-xl font-semibold">Permit decision</h2><p className="mt-2 text-sm text-slate-400">Lifecycle gates are enforced before approval, activation, and closeout.</p><label className="mt-4 block text-sm">Next status<select name="status" className={input}>{statuses.map(status => <option key={status}>{status}</option>)}</select></label><label className="mt-4 block text-sm">Decision reason / comments<textarea name="comments" rows={3} className={input}/></label><label className="mt-4 block text-sm">Closeout notes<textarea name="closeoutNotes" rows={3} className={input}/></label><button disabled={pending} className="mt-5 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{pending ? "Updating…" : "Apply Decision"}</button><Feedback state={state}/></form>;
}

export function PermitControlForm({ permitId, controlId, verified }: { permitId: string; controlId: string; verified: boolean }) {
  const [state, action, pending] = useActionState(verifyPermitControl, initialFormActionState);
  return <form action={action}><input type="hidden" name="permitId" value={permitId}/><input type="hidden" name="controlId" value={controlId}/><input type="hidden" name="verified" value={String(!verified)}/><button disabled={pending} title={state.message || undefined} className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${verified ? "bg-emerald-400/15 text-emerald-300" : "bg-white/5 text-slate-300"}`}>{pending ? "Saving…" : verified ? "Verified ✓" : "Verify"}</button></form>;
}

export function PermitGasTestForm({ permitId }: { permitId: string }) {
  const [state, action, pending] = useActionState(recordPermitGasTest, initialFormActionState);
  return <form action={action} aria-busy={pending} className="rounded-3xl border border-white/10 bg-white/5 p-6"><input type="hidden" name="permitId" value={permitId}/><h2 className="text-xl font-semibold">Record atmospheric test</h2><div className="mt-4 grid grid-cols-2 gap-4"><Field name="oxygenPercent" label="O₂ %"/><Field name="lelPercent" label="LEL %"/><Field name="h2sPpm" label="H₂S ppm"/><Field name="coPpm" label="CO ppm"/></div><label className="mt-4 block text-sm">Result<select name="result" className={input}>{Object.values(PermitGasTestResult).map(result => <option key={result}>{result}</option>)}</select></label><label className="mt-4 block text-sm">Notes<textarea name="notes" rows={2} className={input}/></label><button disabled={pending} className="mt-5 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{pending ? "Recording…" : "Record Gas Test"}</button><Feedback state={state}/></form>;
}

export function PermitWorkerForm({ permitId, workers }: { permitId: string; workers: { id: string; firstName: string; lastName: string; jobTitle: string | null }[] }) {
  const [state, action, pending] = useActionState(assignPermitWorker, initialFormActionState);
  return <form action={action} aria-busy={pending} className="rounded-3xl border border-white/10 bg-white/5 p-6"><input type="hidden" name="permitId" value={permitId}/><h2 className="text-xl font-semibold">Assign worker</h2><label className="mt-4 block text-sm">Worker<select name="workerId" required className={input}><option value="">Select worker</option>{workers.map(worker => <option key={worker.id} value={worker.id}>{worker.firstName} {worker.lastName}</option>)}</select></label><label className="mt-4 block text-sm">Permit role<input name="role" className={input}/></label><button disabled={pending || workers.length === 0} className="mt-5 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{pending ? "Assigning…" : "Assign Worker"}</button><Feedback state={state}/></form>;
}
function Field({ name, label }: { name: string; label: string }) { return <label className="text-sm">{label}<input name={name} type="number" min="0" step="0.01" className={input}/></label>; }
