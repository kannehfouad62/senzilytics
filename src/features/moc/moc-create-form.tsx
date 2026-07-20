"use client";

import { initialFormActionState } from "@/core/actions/action-state";
import { RuntimeFormFields } from "@/features/forms/runtime-form-fields";
import { createMoc } from "@/features/moc/actions";
import Link from "next/link";
import {
  useActionState,
  type ReactNode,
} from "react";

type RuntimeForms = Parameters<
  typeof RuntimeFormFields
>[0]["forms"];

export function MocCreateForm({
  children,
  forms,
}: {
  children: ReactNode;
  forms: RuntimeForms;
}) {
  const [state, action, pending] =
    useActionState(
      createMoc,
      initialFormActionState
    );

  return (
    <form
      action={action}
      aria-busy={pending}
      className={`mt-8 space-y-8 transition ${
        pending
          ? "pointer-events-none opacity-70"
          : ""
      }`}
    >
      {children}

      <RuntimeFormFields
        forms={forms}
      />

      {state.status === "ERROR" &&
        state.message && (
          <p
            role="alert"
            className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300"
          >
            {state.message}
          </p>
        )}

      <div className="flex flex-wrap justify-end gap-3">
        <Link
          href="/moc"
          className="rounded-2xl border border-white/10 px-5 py-3 text-sm text-slate-300 transition hover:bg-white/5"
        >
          Cancel
        </Link>

        <button
          type="submit"
          disabled={pending}
          className="rounded-2xl bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? "Creating…"
            : "Create Change"}
        </button>
      </div>
    </form>
  );
}
