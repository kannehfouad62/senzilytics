"use client";

import {
  initialFormActionState,
} from "@/core/actions/action-state";
import { transitionMocStatus } from "@/features/moc/actions";
import type {
  MocStatus,
} from "@prisma/client";
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";
import {
  useActionState,
  useEffect,
} from "react";
import {
  useRouter,
} from "next/navigation";

type MocStatusTransitionFormProps = {
  mocId: string;
  nextStatuses: MocStatus[];
};

export function MocStatusTransitionForm({
  mocId,
  nextStatuses,
}: MocStatusTransitionFormProps) {
  const router = useRouter();

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    transitionMocStatus,
    initialFormActionState
  );

  useEffect(() => {
    if (
      state.status ===
      "SUCCESS"
    ) {
      router.refresh();
    }
  }, [
    state.status,
    router,
  ]);

  return (
    <div>
      <form
        action={formAction}
        className="mt-6 grid gap-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5 md:grid-cols-[1fr_2fr_auto]"
      >
        <input
          type="hidden"
          name="mocId"
          value={mocId}
        />

        <label className="block text-sm text-slate-300">
          Next status

          <select
            name="status"
            required
            defaultValue=""
            className={inputClass}
          >
            <option
              value=""
              disabled
            >
              Select status
            </option>

            {nextStatuses.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {formatEnum(
                    status
                  )}
                </option>
              )
            )}
          </select>
        </label>

        <label className="block text-sm text-slate-300">
          Transition comments

          <input
            name="comments"
            placeholder="Add a reason, review note, or decision context."
            className={inputClass}
          />
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending && (
              <LoaderCircle
                size={17}
                className="animate-spin"
              />
            )}

            {pending
              ? "Updating..."
              : "Update Status"}
          </button>
        </div>
      </form>

      {state.status ===
        "ERROR" &&
        state.message && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0 text-red-300"
            />

            <div>
              <p className="font-medium text-red-200">
                Action cannot be completed
              </p>

              <p className="mt-1 text-sm leading-6 text-red-100/80">
                {state.message}
              </p>
            </div>
          </div>
        )}

      {state.status ===
        "SUCCESS" &&
        state.message && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-green-400/20 bg-green-400/10 p-4">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0 text-green-300"
            />

            <p className="text-sm text-green-100">
              {state.message}
            </p>
          </div>
        )}
    </div>
  );
}

function formatEnum(
  value: string
) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

const inputClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50";