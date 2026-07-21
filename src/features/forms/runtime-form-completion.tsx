"use client";

import {
  initialFormActionState,
  type FormActionState,
} from "@/core/actions/action-state";
import { RuntimeFormFields } from "@/features/forms/runtime-form-fields";
import { useActionState } from "react";

type RuntimeForms = Parameters<typeof RuntimeFormFields>[0]["forms"];
type CompletionAction = (
  state: FormActionState,
  data: FormData
) => Promise<FormActionState>;

export function RuntimeFormCompletion({
  action,
  entityId,
  entityIdName,
  forms,
  submitLabel,
}: {
  action: CompletionAction;
  entityId: string;
  entityIdName: string;
  forms: RuntimeForms;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialFormActionState
  );

  if (forms.length === 0) {
    return null;
  }

  return (
    <form action={formAction} className="mt-8 space-y-5" aria-busy={pending}>
      <input type="hidden" name={entityIdName} value={entityId} />
      <RuntimeFormFields forms={forms} />

      {state.message && (
        <p
          role={state.status === "ERROR" ? "alert" : "status"}
          className={`rounded-xl border p-4 text-sm ${
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
        className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
