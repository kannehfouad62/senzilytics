"use client";

import { useActionState } from "react";
import {
  initialFormActionState,
  type FormActionState,
} from "@/core/actions/action-state";
import {
  addLongitudinalWave,
  changeLongitudinalStudyStatus,
  createLongitudinalStudy,
  enrollLongitudinalPanel,
  markLongitudinalAttrition,
  sendLongitudinalWaveInvitations,
} from "@/features/research/research-longitudinal-actions";
import { useRefreshOnSuccess } from "@/features/research/use-refresh-on-success";

const input =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm";
const button =
  "rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50";
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

export function LongitudinalStudyForm({
  projects,
  panels,
}: {
  projects: Array<{
    id: string;
    title: string;
    questionnaires: Array<{ id: string; name: string }>;
  }>;
  panels: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(
    createLongitudinalStudy,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-cyan-400/15 bg-cyan-400/[.035] p-6"
    >
      <h2 className="text-xl font-semibold">Create longitudinal study</h2>
      <p className="mt-2 text-sm text-slate-400">
        Link a governed project, questionnaire and consented participant panel.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          Project
          <select name="projectId" required defaultValue="" className={input}>
            <option value="" disabled>
              Select project
            </option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Questionnaire
          <select
            name="questionnaireId"
            required
            defaultValue=""
            className={input}
          >
            <option value="" disabled>
              Select questionnaire
            </option>
            {projects.flatMap((p) =>
              p.questionnaires.map((q) => (
                <option key={q.id} value={q.id}>
                  {p.title} — {q.name}
                </option>
              )),
            )}
          </select>
        </label>
        <label className="text-sm">
          Participant panel
          <select name="panelId" required defaultValue="" className={input}>
            <option value="" disabled>
              Select panel
            </option>
            {panels.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Study title
          <input name="title" required maxLength={160} className={input} />
        </label>
        <label className="text-sm">
          Planned waves
          <input
            name="plannedWaveCount"
            type="number"
            min={2}
            max={100}
            defaultValue={3}
            className={input}
          />
        </label>
        <label className="text-sm">
          Retention target (%)
          <input
            name="retentionTargetPercent"
            type="number"
            min={1}
            max={100}
            defaultValue={80}
            className={input}
          />
        </label>
      </div>
      <label className="mt-4 block text-sm">
        Study purpose
        <textarea name="purpose" required rows={3} className={input} />
      </label>
      <label className="mt-4 block text-sm">
        Participant recontact statement
        <textarea
          name="recontactStatement"
          required
          rows={3}
          className={input}
        />
      </label>
      <button disabled={pending} className={`mt-4 ${button}`}>
        {pending ? "Creating…" : "Create study"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function LongitudinalWaveForm({
  studyId,
  collections,
}: {
  studyId: string;
  collections: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(
    addLongitudinalWave,
    initialFormActionState,
  );
  return (
    <form action={action} className="rounded-2xl border border-white/10 p-5">
      <input type="hidden" name="studyId" value={studyId} />
      <h3 className="font-semibold">Link collection wave</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          Collection
          <select
            name="collectionId"
            required
            defaultValue=""
            className={input}
          >
            <option value="" disabled>
              Select collection
            </option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Wave label
          <input
            name="label"
            required
            className={input}
            placeholder="Baseline"
          />
        </label>
        <label className="text-sm">
          Sequence
          <input
            name="sequence"
            required
            type="number"
            min={1}
            className={input}
          />
        </label>
        <label className="text-sm">
          Type
          <select name="type" className={input}>
            <option>BASELINE</option>
            <option>MIDLINE</option>
            <option>ENDLINE</option>
            <option>FOLLOW_UP</option>
            <option>CUSTOM</option>
          </select>
        </label>
        <label className="text-sm">
          Scheduled date
          <input name="scheduledAt" type="datetime-local" className={input} />
        </label>
      </div>
      <button
        disabled={pending || !collections.length}
        className={`mt-4 ${button}`}
      >
        {pending ? "Linking…" : "Link wave"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function StudyStatusForm({
  studyId,
  options,
}: {
  studyId: string;
  options: string[];
}) {
  const [state, action, pending] = useActionState(
    changeLongitudinalStudyStatus,
    initialFormActionState,
  );
  if (!options.length) return null;
  return (
    <form action={action} className="flex items-end gap-2">
      <input type="hidden" name="studyId" value={studyId} />
      <select name="status" className={`${input} mt-0`}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <button disabled={pending} className={button}>
        {pending ? "Updating…" : "Update status"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function EnrollPanelButton({ studyId }: { studyId: string }) {
  const [state, action, pending] = useActionState(
    enrollLongitudinalPanel,
    initialFormActionState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="studyId" value={studyId} />
      <button disabled={pending} className={button}>
        {pending ? "Enrolling…" : "Enroll eligible panel"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function WaveInviteButton({
  studyId,
  waveId,
}: {
  studyId: string;
  waveId: string;
}) {
  const [state, action, pending] = useActionState(
    sendLongitudinalWaveInvitations,
    initialFormActionState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="studyId" value={studyId} />
      <input type="hidden" name="waveId" value={waveId} />
      <button
        disabled={pending}
        className="rounded-lg border border-violet-400/25 px-3 py-2 text-xs text-violet-200"
      >
        {pending ? "Sending…" : "Launch recontact"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function AttritionForm({ participantId }: { participantId: string }) {
  const [state, action, pending] = useActionState(
    markLongitudinalAttrition,
    initialFormActionState,
  );
  return (
    <form action={action} className="flex flex-wrap gap-2">
      <input type="hidden" name="participantId" value={participantId} />
      <select name="status" className={`${input} mt-0 w-auto`}>
        <option value="LOST_TO_FOLLOW_UP">Lost to follow-up</option>
        <option value="WITHDRAWN">Withdrawn</option>
      </select>
      <input
        name="reason"
        required
        className={`${input} mt-0 min-w-52 flex-1`}
        placeholder="Documented reason"
      />
      <button
        disabled={pending}
        className="rounded-lg border border-amber-400/25 px-3 py-2 text-xs text-amber-200"
      >
        {pending ? "Saving…" : "Record"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
