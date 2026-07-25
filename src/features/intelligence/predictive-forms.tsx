"use client";

import {
  initialFormActionState,
  type FormActionState,
} from "@/core/actions/action-state";
import {
  reviewPredictiveSignal,
  runPredictiveAnalysis,
  updatePredictivePolicy,
} from "@/features/intelligence/predictive-actions";
import { PredictiveSignalReviewDecision } from "@prisma/client";
import { useActionState } from "react";

const input =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm";

export function PredictiveRunForm() {
  const [state, action, pending] = useActionState(
    runPredictiveAnalysis,
    initialFormActionState,
  );
  return (
    <form action={action} className="text-right">
      <button
        disabled={pending}
        className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
      >
        {pending ? "Analyzing governed data…" : "Run analysis now"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function PredictivePolicyForm({
  policy,
}: {
  policy: {
    isActive: boolean;
    lookbackDays: number;
    minimumEventCount: number;
    deteriorationThresholdPercent: number;
    overdueActionThreshold: number;
    controlFailureThreshold: number;
    reviewCadenceDays: number;
  };
}) {
  const [state, action, pending] = useActionState(
    updatePredictivePolicy,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-white/10 bg-white/[.04] p-6"
    >
      <h2 className="text-xl font-semibold">Governed detection policy</h2>
      <p className="mt-1 text-sm text-slate-400">
        Threshold changes are audited and apply to the next analysis.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <NumberField
          name="lookbackDays"
          label="Comparison window (days)"
          value={policy.lookbackDays}
          min={30}
          max={365}
        />
        <NumberField
          name="minimumEventCount"
          label="Minimum evidence count"
          value={policy.minimumEventCount}
          min={1}
          max={100}
        />
        <NumberField
          name="deteriorationThresholdPercent"
          label="Deterioration threshold (%)"
          value={policy.deteriorationThresholdPercent}
          min={5}
          max={500}
        />
        <NumberField
          name="overdueActionThreshold"
          label="Overdue CAPA threshold"
          value={policy.overdueActionThreshold}
          min={1}
        />
        <NumberField
          name="controlFailureThreshold"
          label="Control weakness threshold"
          value={policy.controlFailureThreshold}
          min={1}
        />
        <NumberField
          name="reviewCadenceDays"
          label="Signal review cadence (days)"
          value={policy.reviewCadenceDays}
          min={1}
          max={90}
        />
      </div>
      <label className="mt-5 flex items-center gap-3 text-sm">
        <input name="isActive" type="checkbox" defaultChecked={policy.isActive} />
        Enable daily scheduled analysis
      </label>
      <button
        disabled={pending}
        className="mt-5 rounded-xl border border-cyan-300/30 px-5 py-3 text-sm font-semibold text-cyan-200 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save policy"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function PredictiveReviewForm({
  signalId,
  users,
}: {
  signalId: string;
  users: Array<{ id: string; name: string; jobTitle: string | null }>;
}) {
  const [state, action, pending] = useActionState(
    reviewPredictiveSignal,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-white/10 bg-white/[.04] p-6"
    >
      <input type="hidden" name="signalId" value={signalId} />
      <h2 className="text-xl font-semibold">Qualified human review</h2>
      <p className="mt-1 text-sm text-slate-400">
        A review decision does not change any source record or imply a causal
        forecast.
      </p>
      <label className="mt-5 block text-sm">
        Owner
        <select name="ownerId" className={input} defaultValue="">
          <option value="">Keep current owner</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
              {user.jobTitle ? ` — ${user.jobTitle}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-4 block text-sm">
        Decision
        <select name="decision" className={input}>
          {Object.values(PredictiveSignalReviewDecision).map((decision) => (
            <option key={decision} value={decision}>
              {decision.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-4 block text-sm">
        Review rationale
        <textarea
          name="rationale"
          rows={5}
          required
          minLength={10}
          className={input}
          placeholder="Document the evidence reviewed, interpretation, and next action."
        />
      </label>
      <button
        disabled={pending}
        className="mt-5 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
      >
        {pending ? "Recording…" : "Record review"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function NumberField({
  name,
  label,
  value,
  min,
  max,
}: {
  name: string;
  label: string;
  value: number;
  min: number;
  max?: number;
}) {
  return (
    <label className="text-sm">
      {label}
      <input
        name={name}
        type="number"
        min={min}
        max={max}
        required
        defaultValue={value}
        className={input}
      />
    </label>
  );
}

function Feedback({ state }: { state: FormActionState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.status === "ERROR" ? "alert" : "status"}
      className={`mt-4 text-sm ${
        state.status === "ERROR" ? "text-red-300" : "text-emerald-300"
      }`}
    >
      {state.message}
    </p>
  );
}
