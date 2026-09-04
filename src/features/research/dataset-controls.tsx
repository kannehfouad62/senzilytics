"use client";
import {
  initialFormActionState,
  type FormActionState,
} from "@/core/actions/action-state";
import {
  changeResearchDatasetStatus,
  reviewResearchResponse,
} from "@/features/research/dataset-actions";
import { useRefreshOnSuccess } from "@/features/research/use-refresh-on-success";
import {
  ResearchDatasetStatus,
  ResearchResponseDisposition,
} from "@prisma/client";
import { useActionState } from "react";
const input =
    "rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm",
  button =
    "rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50";
function Feedback({ state }: { state: FormActionState }) {
  useRefreshOnSuccess(state);
  return state.message ? (
    <p
      className={
        state.status === "ERROR"
          ? "text-xs text-red-300"
          : "text-xs text-emerald-300"
      }
    >
      {state.message}
    </p>
  ) : null;
}
export function DatasetStatusControl({
  collectionId,
  status,
  canApprove,
  canLock,
}: {
  collectionId: string;
  status: ResearchDatasetStatus;
  canApprove: boolean;
  canLock: boolean;
}) {
  const [state, action, pending] = useActionState(
      changeResearchDatasetStatus,
      initialFormActionState,
    ),
    next: Record<ResearchDatasetStatus, ResearchDatasetStatus[]> = {
      OPEN: [ResearchDatasetStatus.UNDER_REVIEW],
      UNDER_REVIEW: canLock
        ? [ResearchDatasetStatus.OPEN, ResearchDatasetStatus.LOCKED]
        : [ResearchDatasetStatus.OPEN],
      LOCKED: canApprove
        ? [ResearchDatasetStatus.UNDER_REVIEW, ResearchDatasetStatus.APPROVED]
        : [ResearchDatasetStatus.UNDER_REVIEW],
      APPROVED: [],
    };
  if (!next[status].length) return null;
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="collectionId" value={collectionId} />
      <select name="status" className={input}>
        {next[status].map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
      <button disabled={pending} className={button}>
        {pending ? "Updating…" : "Apply dataset gate"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function ResponseQualityControl({
  assignmentId,
  disposition,
  notes,
  responseSource = "ASSIGNED",
}: {
  assignmentId: string;
  disposition: ResearchResponseDisposition;
  notes: string | null;
  responseSource?: "ASSIGNED" | "PUBLIC" | "FIELDWORK";
}) {
  const [state, action, pending] = useActionState(
    reviewResearchResponse,
    initialFormActionState,
  );
  return (
    <form action={action} className="grid gap-2 md:grid-cols-[.4fr_1fr_auto]">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="responseSource" value={responseSource} />
      <select name="disposition" defaultValue={disposition} className={input}>
        {Object.values(ResearchResponseDisposition).map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
      <input
        name="qualityNotes"
        defaultValue={notes ?? ""}
        placeholder="Required when flagged or excluded"
        maxLength={2000}
        className={input}
      />
      <button disabled={pending} className={button}>
        {pending ? "Saving…" : "Save review"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
