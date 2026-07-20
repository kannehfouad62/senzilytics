"use client";

import { initialFormActionState } from "@/core/actions/action-state";
import { updateCapaStatus } from "@/features/capa/actions";
import { Status } from "@prisma/client";
import { useActionState } from "react";

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3";

export function CapaStatusForm({
  actionId,
  currentStatus,
  allowedStatuses,
}: {
  actionId: string;
  currentStatus: Status;
  allowedStatuses: Status[];
}) {
  const [state, action, pending] =
    useActionState(
      updateCapaStatus,
      initialFormActionState
    );

  return (
    <form
      action={action}
      className="rounded-3xl border border-white/10 bg-white/5 p-6"
    >
      <input
        type="hidden"
        name="actionId"
        value={actionId}
      />

      <h2 className="text-xl font-semibold">
        Lifecycle status
      </h2>

      <p className="mt-1 text-sm text-slate-400">
        Record progress and formal completion of this corrective action.
      </p>

      <label className="mt-5 block text-sm">
        Status
        <select
          name="status"
          defaultValue={currentStatus}
          className={inputClassName}
        >
          {allowedStatuses.map(
            (status) => (
              <option
                key={status}
                value={status}
              >
                {status.replaceAll(
                  "_",
                  " "
                )}
              </option>
            )
          )}
        </select>
      </label>

      {state.message && (
        <p
          role={
            state.status === "ERROR"
              ? "alert"
              : "status"
          }
          className={`mt-4 rounded-xl border p-3 text-sm ${
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
        className="mt-5 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
      >
        {pending
          ? "Saving…"
          : "Save Status"}
      </button>
    </form>
  );
}
