"use client";

import { initialFormActionState } from "@/core/actions/action-state";
import { approveEsgPeriod } from "@/features/esg/actions";
import { useActionState } from "react";

export function EsgPeriodApprovalForm({ periodId }: { periodId: string }) {
  const [state, action, pending] = useActionState(
    approveEsgPeriod,
    initialFormActionState
  );

  return (
    <form action={action} aria-busy={pending}>
      <input type="hidden" name="id" value={periodId} />
      {state.message && (
        <p
          role={state.status === "ERROR" ? "alert" : "status"}
          className={`mb-3 rounded-xl border p-3 text-sm ${
            state.status === "ERROR"
              ? "border-red-400/20 bg-red-400/10 text-red-300"
              : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
          }`}
        >
          {state.message}
        </p>
      )}
      <button
        disabled={pending}
        className="rounded-xl bg-emerald-300 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50"
      >
        {pending ? "Checking…" : "Approve Complete Period"}
      </button>
    </form>
  );
}
