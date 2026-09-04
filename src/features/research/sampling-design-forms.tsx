"use client";
import {
  ResearchSamplingDesignStatus,
  ResearchSamplingDesignType,
} from "@prisma/client";
import { useActionState } from "react";
import {
  initialFormActionState,
  type FormActionState,
} from "@/core/actions/action-state";
import {
  changeResearchSamplingDesignStatus,
  createResearchSamplingDesign,
} from "@/features/research/sampling-design-actions";
import { useRefreshOnSuccess } from "@/features/research/use-refresh-on-success";
const input =
  "rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm";
function Feedback({ state }: { state: FormActionState }) {
  useRefreshOnSuccess(state);
  return state.message ? (
    <p
      className={
        state.status === "ERROR"
          ? "mt-3 text-sm text-red-300"
          : "mt-3 text-sm text-emerald-300"
      }
    >
      {state.message}
    </p>
  ) : null;
}
export function SamplingDesignForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(
    createResearchSamplingDesign,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-white/10 bg-white/[.04] p-6"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <h2 className="text-xl font-semibold">New sampling design version</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <input
          name="name"
          required
          placeholder="Design name"
          className={input}
        />
        <select name="type" className={input}>
          {Object.values(ResearchSamplingDesignType).map((type) => (
            <option key={type}>{type.replaceAll("_", " ")}</option>
          ))}
        </select>
        <input
          name="targetSampleSize"
          required
          type="number"
          min="1"
          placeholder="Target sample size"
          className={input}
        />
        <input
          name="populationSize"
          type="number"
          min="1"
          placeholder="Population size"
          className={input}
        />
        <input
          name="samplingFrameSize"
          type="number"
          min="1"
          placeholder="Sampling-frame size"
          className={input}
        />
        <input
          name="selectionInterval"
          type="number"
          min="0"
          step="any"
          placeholder="Systematic interval"
          className={input}
        />
        <input
          name="strataVariableKey"
          placeholder="Strata variable key"
          className={input}
        />
        <input
          name="clusterVariableKey"
          placeholder="Cluster variable key"
          className={input}
        />
        <label className="flex items-center gap-2 rounded-xl border border-white/10 px-3 text-sm">
          <input name="finitePopulationCorrection" type="checkbox" /> Apply
          finite-population correction
        </label>
        <textarea
          name="stages"
          placeholder="Multistage selection procedure"
          className={`${input} md:col-span-3`}
        />
        <textarea
          name="weightMethod"
          placeholder="Base-weight construction"
          className={input}
        />
        <textarea
          name="nonresponseAdjustment"
          placeholder="Nonresponse adjustment"
          className={input}
        />
        <textarea
          name="calibrationMethod"
          placeholder="Calibration or raking targets"
          className={input}
        />
        <textarea
          name="assumptions"
          required
          minLength={20}
          placeholder="Sampling assumptions, coverage limitations, eligibility and replacement rules"
          className={`${input} md:col-span-3`}
        />
      </div>
      <button
        disabled={pending}
        className="mt-4 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
      >
        {pending ? "Saving…" : "Create design draft"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function SamplingDesignStatusControl({
  id,
  target,
  label,
}: {
  id: string;
  target: ResearchSamplingDesignStatus;
  label: string;
}) {
  const [state, action, pending] = useActionState(
    changeResearchSamplingDesignStatus,
    initialFormActionState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="designId" value={id} />
      <input type="hidden" name="status" value={target} />
      <button
        disabled={pending}
        className="rounded-lg border border-cyan-300/30 px-3 py-1.5 text-xs text-cyan-200"
      >
        {label}
      </button>
      <Feedback state={state} />
    </form>
  );
}
