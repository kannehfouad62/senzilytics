"use client";

import { initialFormActionState } from "@/core/actions/action-state";
import { createContractor } from "@/features/contractors/actions";
import { RuntimeFormFields } from "@/features/forms/runtime-form-fields";
import Link from "next/link";
import { useActionState, type ReactNode } from "react";

type RuntimeForms = Parameters<typeof RuntimeFormFields>[0]["forms"];

export function ContractorCreateForm({ children, forms }: { children: ReactNode; forms: RuntimeForms }) {
  const [state, action, pending] = useActionState(createContractor, initialFormActionState);

  return <form action={action} aria-busy={pending} className={`mt-8 space-y-6 rounded-3xl border border-white/10 bg-white/5 p-7 ${pending ? "pointer-events-none opacity-70" : ""}`}>
    {children}
    <RuntimeFormFields forms={forms} />
    {state.status === "ERROR" && state.message && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">{state.message}</p>}
    <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 pt-6">
      <Link href="/contractors" className="rounded-xl border border-white/10 px-5 py-3 text-sm text-slate-300">Cancel</Link>
      <button disabled={pending} className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{pending ? "Registering…" : "Register Contractor"}</button>
    </div>
  </form>;
}
