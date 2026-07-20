"use client";

import { RuntimeFormFields } from "@/features/forms/runtime-form-fields";
import {
  createInspection,
  type InspectionCreateState,
} from "@/features/inspections/actions";
import {
  useActionState,
  type ReactNode,
} from "react";
import Link from "next/link";

type RuntimeForms = Parameters<
  typeof RuntimeFormFields
>[0]["forms"];

export function InspectionCreateForm({
  children,
  forms,
  cancelHref,
  submitDisabled = false,
  submitLabel,
}: {
  children: ReactNode;
  forms: RuntimeForms;
  cancelHref: string;
  submitDisabled?: boolean;
  submitLabel: string;
}) {
  const initialState: InspectionCreateState = {
    error: null,
  };

  const [state, action, pending] =
    useActionState(
      createInspection,
      initialState
    );

  return (
    <form
      action={action}
      aria-busy={pending}
      className={`mt-8 space-y-7 rounded-3xl border border-white/10 bg-white/5 p-7 shadow-2xl backdrop-blur-xl transition ${
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

      <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 pt-6">
        <Link
          href={cancelHref}
          className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5"
        >
          Cancel
        </Link>

        <button
          type="submit"
          disabled={
            pending ||
            submitDisabled
          }
          className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? "Creating…"
            : submitLabel}
        </button>
      </div>
    </form>
  );
}
