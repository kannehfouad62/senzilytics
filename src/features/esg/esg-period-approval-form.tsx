"use client";

import { initialFormActionState } from "@/core/actions/action-state";
import { transitionEsgPeriod } from "@/features/esg/actions";
import type { EsgDisclosureStatus } from "@prisma/client";
import { useActionState } from "react";

const actions: Partial<
  Record<
    EsgDisclosureStatus,
    Array<{ status: EsgDisclosureStatus; label: string; primary?: boolean }>
  >
> = {
  DATA_COLLECTION: [
    {
      status: "UNDER_REVIEW",
      label: "Submit Complete Period for Review",
      primary: true,
    },
  ],
  UNDER_REVIEW: [
    { status: "DATA_COLLECTION", label: "Return to Data Collection" },
    { status: "APPROVED", label: "Approve Complete Period", primary: true },
  ],
  APPROVED: [
    { status: "PUBLISHED", label: "Publish Approved Period", primary: true },
  ],
};

export function EsgPeriodApprovalForm({
  periodId,
  status,
}: {
  periodId: string;
  status: EsgDisclosureStatus;
}) {
  const [state, action, pending] = useActionState(
    transitionEsgPeriod,
    initialFormActionState
  );
  const available = actions[status] ?? [];

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
      <div className="flex flex-wrap gap-2">
        {available.map((item) => (
          <button
            key={item.status}
            name="status"
            value={item.status}
            disabled={pending}
            className={`rounded-xl px-4 py-2 font-semibold disabled:opacity-50 ${
              item.primary
                ? "bg-emerald-300 text-slate-950"
                : "border border-white/10 text-slate-100"
            }`}
          >
            {pending ? "Checking…" : item.label}
          </button>
        ))}
      </div>
    </form>
  );
}
