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
  reviewResearchFieldworkBackcheck,
  selectResearchBackcheckSample,
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

export function BackcheckSampleForm({ executionId }: { executionId: string }) {
  const [state, action, pending] = useActionState(selectResearchBackcheckSample, initialFormActionState);
  return <form action={action} className="mt-4 grid gap-3 sm:grid-cols-[120px_180px_auto]">
    <input type="hidden" name="executionId" value={executionId} />
    <label className="text-xs text-slate-400">Sample %<input name="percentage" type="number" min="1" max="100" defaultValue="10" required className={`${field} mt-1 w-full`} /></label>
    <label className="text-xs text-slate-400">Due date<input name="dueAt" type="date" required className={`${field} mt-1 w-full`} /></label>
    <div className="self-end"><button disabled={pending} className={button}>{pending ? "Selecting…" : "Select governed sample"}</button></div>
    <div className="sm:col-span-3"><Feedback state={state} /></div>
  </form>;
}

export function BackcheckReviewForm({ responseId }: { responseId: string }) {
  const [state, action, pending] = useActionState(reviewResearchFieldworkBackcheck, initialFormActionState);
  return <form action={action} className="min-w-[520px]">
    <input type="hidden" name="responseId" value={responseId} />
    <div className="flex gap-2">
      <select name="status" required defaultValue="" className={field}>
        <option value="" disabled>Decision</option>
        <option value="APPROVED">Verified</option>
        <option value="RECONTACT_REQUIRED">Recontact required</option>
        <option value="REJECTED">Rejected / flag response</option>
      </select>
      <input name="notes" minLength={10} maxLength={2000} required placeholder="Verification evidence" className={`${field} flex-1`} />
      <button disabled={pending} className={button}>{pending ? "Saving…" : "Record review"}</button>
    </div>
    <Feedback state={state} />
  </form>;
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
