"use client";

import { initialFormActionState } from "@/core/actions/action-state";
import { completeCapaForms } from "@/features/capa/actions";
import { RuntimeFormFields } from "@/features/forms/runtime-form-fields";
import { useActionState } from "react";

type RuntimeForms = Parameters<
  typeof RuntimeFormFields
>[0]["forms"];

export function CapaCustomFormCompletion({
  actionId,
  forms,
}: {
  actionId: string;
  forms: RuntimeForms;
}) {
  const [state, action, pending] =
    useActionState(
      completeCapaForms,
      initialFormActionState
    );

  if (forms.length === 0) {
    return null;
  }

  return (
    <form
      action={action}
      aria-busy={pending}
      className="mt-8 space-y-6"
    >
      <input
        type="hidden"
        name="actionId"
        value={actionId}
      />

      <div>
        <p className="text-sm text-cyan-300">
          Tenant CAPA requirements
        </p>
        <h2 className="mt-1 text-2xl font-semibold">
          Complete required CAPA forms
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          These published forms were not captured when this action was generated from its source record.
        </p>
      </div>

      <RuntimeFormFields
        forms={forms}
      />

      {state.message && (
        <p
          role={
            state.status === "ERROR"
              ? "alert"
              : "status"
          }
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
        {pending
          ? "Saving…"
          : "Save CAPA Forms"}
      </button>
    </form>
  );
}
