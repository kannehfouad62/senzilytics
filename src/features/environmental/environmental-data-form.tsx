"use client";

import { initialFormActionState } from "@/core/actions/action-state";
import { recordEnvironmentalData } from "@/features/environmental/actions";
import { RuntimeFormFields } from "@/features/forms/runtime-form-fields";
import { useActionState, type ReactNode } from "react";

type RuntimeForms = Parameters<typeof RuntimeFormFields>[0]["forms"];

export function EnvironmentalDataForm({
  children,
  forms,
}: {
  children: ReactNode;
  forms: RuntimeForms;
}) {
  const [state, action, pending] = useActionState(
    recordEnvironmentalData,
    initialFormActionState
  );

  return (
    <form
      action={action}
      aria-busy={pending}
      className={`mt-8 space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 ${
        pending ? "pointer-events-none opacity-70" : ""
      }`}
    >
      <div className="grid gap-4 md:grid-cols-3">{children}</div>
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
        className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
      >
        {pending ? "Recording…" : "Record Data"}
      </button>
    </form>
  );
}
