"use client";

import { useActionState } from "react";
import { approveMobileAuthorization, denyMobileAuthorization, initialMobileAuthorizationState } from "@/features/mobile/mobile-authorization.actions";

export function MobileAuthorizationForm({ challenge }: { challenge: string }) {
  const [approveState, approveAction, approving] = useActionState(approveMobileAuthorization, initialMobileAuthorizationState);
  const [denyState, denyAction, denying] = useActionState(denyMobileAuthorization, initialMobileAuthorizationState);
  const error = approveState.message || denyState.message;
  return <><div className="mt-8 flex gap-3"><form action={denyAction} className="flex-1"><input type="hidden" name="challenge" value={challenge} /><button disabled={approving || denying} className="w-full rounded-xl border border-white/10 px-5 py-3 disabled:opacity-50">{denying ? "Denying…" : "Deny"}</button></form><form action={approveAction} className="flex-1"><input type="hidden" name="challenge" value={challenge} /><button disabled={approving || denying} className="w-full rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{approving ? "Authorizing…" : "Authorize App"}</button></form></div>{error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-300">{error}</p>}</>;
}
