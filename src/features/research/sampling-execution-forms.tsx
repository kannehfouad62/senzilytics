"use client";

import { ResearchSamplingExecutionStatus } from "@prisma/client";
import { useActionState } from "react";

import {
  initialFormActionState,
  type FormActionState,
} from "@/core/actions/action-state";
import {
  changeSamplingExecutionStatus,
  generateResearchSample,
} from "@/features/research/sampling-execution-actions";
import { useRefreshOnSuccess } from "@/features/research/use-refresh-on-success";

const input =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm";
const button =
  "rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50";

function Feedback({ state }: { state: FormActionState }) {
  useRefreshOnSuccess(state);
  return state.message ? (
    <p
      className={`mt-3 text-sm ${state.status === "ERROR" ? "text-red-300" : "text-emerald-300"}`}
    >
      {state.message}
    </p>
  ) : null;
}

export function SamplingExecutionForm({
  frames,
}: {
  frames: Array<{ id: string; label: string; target: number }>;
}) {
  const [state, action, pending] = useActionState(
    generateResearchSample,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-violet-400/15 bg-violet-400/[.035] p-6"
    >
      <h2 className="text-xl font-semibold">Generate reproducible selection</h2>
      <p className="mt-2 text-sm text-slate-400">
        Generate a deterministic primary and reserve sample from a validated
        private frame. Leave the seed empty to generate a cryptographically
        random seed.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="text-sm text-slate-300">
          Validated frame
          <select name="frameId" required defaultValue="" className={input}>
            <option value="" disabled>
              Select frame
            </option>
            {frames.map((frame) => (
              <option key={frame.id} value={frame.id}>
                {frame.label} · target {frame.target}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Reserve percentage
          <input
            name="reservePercent"
            type="number"
            min={0}
            max={100}
            step={1}
            defaultValue={10}
            className={input}
          />
        </label>
        <label className="text-sm text-slate-300">
          Reproducibility seed
          <input
            name="seed"
            maxLength={200}
            placeholder="Generated automatically"
            className={input}
          />
        </label>
      </div>
      <button disabled={pending || !frames.length} className={`mt-5 ${button}`}>
        {pending ? "Generating…" : "Generate governed sample"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function SamplingExecutionStatusControl({
  executionId,
  target,
  label,
}: {
  executionId: string;
  target: ResearchSamplingExecutionStatus;
  label: string;
}) {
  const [state, action, pending] = useActionState(
    changeSamplingExecutionStatus,
    initialFormActionState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="executionId" value={executionId} />
      <input type="hidden" name="status" value={target} />
      <button
        disabled={pending}
        className="rounded-lg border border-cyan-400/20 px-3 py-2 text-xs text-cyan-200 disabled:opacity-50"
      >
        {pending ? "Updating…" : label}
      </button>
      <Feedback state={state} />
    </form>
  );
}
