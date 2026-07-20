"use client";

import {
  createIncident,
  type IncidentCreateState,
} from "@/features/incidents/actions";
import { RuntimeFormFields } from "@/features/forms/runtime-form-fields";
import {
  useActionState,
  type ReactNode,
} from "react";
import Link from "next/link";

type RuntimeForms = Parameters<
  typeof RuntimeFormFields
>[0]["forms"];

export function IncidentCreateForm({
  children,
  forms,
  cancelHref,
  submitLabel,
}: {
  children: ReactNode;
  forms: RuntimeForms;
  cancelHref: string;
  submitLabel: string;
}) {
  const initialState: IncidentCreateState = {
    error: null,
  };

  const [state, action, pending] =
    useActionState(
      createIncident,
      initialState
    );

  return (
    <form
      action={action}
      aria-busy={pending}
      className={`space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl transition ${
        pending
          ? "pointer-events-none opacity-70"
          : ""
      }`}
    >
      {children}

      <RuntimeFormFields
        forms={forms}
      />

      {state.error && (
        <p
          role="alert"
          className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300"
        >
          {state.error}
        </p>
      )}

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-2xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? "Submitting…"
            : submitLabel}
        </button>

        <Link
          href={cancelHref}
          className="rounded-2xl border border-white/10 px-6 py-3 text-slate-300 transition hover:bg-white/5"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
