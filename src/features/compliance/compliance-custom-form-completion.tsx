"use client";

import { initialFormActionState } from "@/core/actions/action-state";
import { completeComplianceForms } from "@/features/compliance/actions";
import { RuntimeFormFields } from "@/features/forms/runtime-form-fields";
import { useActionState } from "react";

type RuntimeForms = Parameters<typeof RuntimeFormFields>[0]["forms"];

export function ComplianceCustomFormCompletion({
  complianceItemId,
  forms,
}: {
  complianceItemId: string;
  forms: RuntimeForms;
}) {
  const [state, action, pending] = useActionState(
    completeComplianceForms,
    initialFormActionState
  );

  if (forms.length === 0) {
    return null;
  }

  return (
    <form action={action} className="mt-8 space-y-5" aria-busy={pending}>
      <input
        type="hidden"
        name="complianceItemId"
        value={complianceItemId}
      />
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
        {pending ? "Saving…" : "Save Compliance Forms"}
      </button>
    </form>
  );
}
