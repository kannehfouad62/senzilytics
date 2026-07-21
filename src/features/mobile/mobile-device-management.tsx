"use client";

import { useActionState } from "react";
import { initialFormActionState } from "@/core/actions/action-state";
import { revokeTenantMobileDevice } from "@/features/mobile/mobile-device.actions";

export function RevokeMobileDeviceForm({ sessionId }: { sessionId: string }) {
  const [state, action, pending] = useActionState(revokeTenantMobileDevice, initialFormActionState);
  return <form action={action}><input type="hidden" name="sessionId" value={sessionId} /><button disabled={pending} className="text-red-300 disabled:opacity-50">{pending ? "Revoking…" : "Revoke"}</button>{state.message && <p role={state.status === "ERROR" ? "alert" : "status"} className={`mt-1 text-xs ${state.status === "ERROR" ? "text-red-300" : "text-emerald-300"}`}>{state.message}</p>}</form>;
}
