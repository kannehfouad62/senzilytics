"use client";

import { initialFormActionState } from "@/core/actions/action-state";
import { createEsgPeriod } from "@/features/esg/actions";
import { RuntimeFormFields } from "@/features/forms/runtime-form-fields";
import { useActionState, type ReactNode } from "react";

type RuntimeForms = Parameters<typeof RuntimeFormFields>[0]["forms"];

export function EsgPeriodCreateForm({
  children,
  forms,
}: {
  children: ReactNode;
  forms: RuntimeForms;
}) {
  const [state, action, pending] = useActionState(
    createEsgPeriod,
    initialFormActionState
  );

  return (
    <form
      action={action}
      aria-busy={pending}
      className={`space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 ${
        pending ? "pointer-events-none opacity-70" : ""
      }`}
    >
      <h2 className="text-xl font-semibold">New Disclosure Period</h2>
      {children}
      <RuntimeFormFields forms={forms} />

      {state.status === "ERROR" && state.message && (
        <p
          role="alert"
          className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300"
        >
          {state.message}
        </p>
      )}

      <button
        disabled={pending}
        className="rounded-xl bg-cyan-300 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create Period"}
      </button>
    </form>
  );
}
