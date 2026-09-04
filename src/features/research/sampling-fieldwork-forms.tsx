"use client";

import { ResearchSampleUnitStatus } from "@prisma/client";
import { useActionState } from "react";

import {
  initialFormActionState,
  type FormActionState,
} from "@/core/actions/action-state";
import {
  activateReserveReplacement,
  activateSamplingFieldwork,
  assignResearchSampleUnit,
  closeSamplingFieldwork,
  recordResearchFieldworkDisposition,
} from "@/features/research/sampling-fieldwork-actions";
import { useRefreshOnSuccess } from "@/features/research/use-refresh-on-success";

const field =
  "rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-xs";
const button =
  "rounded-lg border border-cyan-400/20 px-3 py-2 text-xs text-cyan-200 disabled:opacity-50";

function Feedback({ state }: { state: FormActionState }) {
  useRefreshOnSuccess(state);
  return state.message ? (
    <p
      className={`mt-2 text-xs ${state.status === "ERROR" ? "text-red-300" : "text-emerald-300"}`}
    >
      {state.message}
    </p>
  ) : null;
}

function ExecutionAction({
  executionId,
  close = false,
}: {
  executionId: string;
  close?: boolean;
}) {
  const [state, action, pending] = useActionState(
    close ? closeSamplingFieldwork : activateSamplingFieldwork,
    initialFormActionState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="executionId" value={executionId} />
      <button disabled={pending} className={button}>
        {pending
          ? "Updating…"
          : close
            ? "Close fieldwork"
            : "Activate fieldwork"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
export const ActivateFieldworkControl = ({
  executionId,
}: {
  executionId: string;
}) => <ExecutionAction executionId={executionId} />;
export const CloseFieldworkControl = ({
  executionId,
}: {
  executionId: string;
}) => <ExecutionAction executionId={executionId} close />;

export function SampleUnitAssignmentForm({
  unitId,
  researchers,
}: {
  unitId: string;
  researchers: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(
    assignResearchSampleUnit,
    initialFormActionState,
  );
  return (
    <form action={action} className="flex min-w-[430px] items-start gap-2">
      <input type="hidden" name="unitId" value={unitId} />
      <select name="assigneeId" required defaultValue="" className={field}>
        <option value="" disabled>
          Researcher
        </option>
        {researchers.map((researcher) => (
          <option key={researcher.id} value={researcher.id}>
            {researcher.name}
          </option>
        ))}
      </select>
      <input name="dueAt" type="date" required className={field} />
      <button disabled={pending} className={button}>
        {pending ? "Assigning…" : "Assign"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function SampleUnitDispositionForm({ unitId }: { unitId: string }) {
  const [state, action, pending] = useActionState(
    recordResearchFieldworkDisposition,
    initialFormActionState,
  );
  return (
    <form action={action} className="min-w-[520px]">
      <input type="hidden" name="unitId" value={unitId} />
      <div className="flex gap-2">
        <select name="status" required defaultValue="" className={field}>
          <option value="" disabled>
            Disposition
          </option>
          {[
            ResearchSampleUnitStatus.CONTACTED,
            ResearchSampleUnitStatus.PARTIAL,
            ResearchSampleUnitStatus.COMPLETED,
            ResearchSampleUnitStatus.REFUSED,
            ResearchSampleUnitStatus.INELIGIBLE,
            ResearchSampleUnitStatus.WITHDRAWN,
          ].map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <input
          name="note"
          maxLength={1000}
          placeholder="Contact/disposition note"
          className={`${field} flex-1`}
        />
        <button disabled={pending} className={button}>
          {pending ? "Saving…" : "Record"}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function ReserveReplacementControl({ unitId }: { unitId: string }) {
  const [state, action, pending] = useActionState(
    activateReserveReplacement,
    initialFormActionState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="unitId" value={unitId} />
      <button disabled={pending} className={button}>
        {pending ? "Activating…" : "Activate reserve"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
