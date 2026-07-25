"use client";

import {
  initialFormActionState,
  type FormActionState,
} from "@/core/actions/action-state";
import {
  addExecutiveAgendaItem,
  approveExecutiveReview,
  archiveExecutiveReview,
  assignExecutiveAttendee,
  cancelExecutiveReview,
  closeExecutiveDecision,
  completeExecutiveReview,
  createCapaFromExecutiveDecision,
  createExecutiveDecision,
  createExecutiveReview,
  publishExecutiveReview,
  recordExecutiveAgendaOutcome,
  recordExecutiveAttendance,
  refreshExecutiveReviewSnapshot,
  scheduleExecutiveReview,
  startExecutiveReview,
} from "@/features/executive-review/actions";
import {
  ExecutiveReviewAgendaStatus,
  ExecutiveReviewAttendanceRole,
  ExecutiveReviewConclusion,
  ExecutiveReviewDecisionType,
  ExecutiveReviewFrequency,
  ExecutiveReviewStatus,
  RiskLevel,
} from "@prisma/client";
import { useActionState } from "react";

const field =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white";
const primary =
  "rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50";
const secondary =
  "rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 disabled:opacity-50";
type UserOption = { id: string; name: string; jobTitle: string | null };
type SiteOption = { id: string; name: string };

export function ExecutiveReviewCreateForm({
  sites,
  users,
}: {
  sites: SiteOption[];
  users: UserOption[];
}) {
  const [state, action, pending] = useActionState(
    createExecutiveReview,
    initialFormActionState,
  );
  const now = new Date();
  const periodEnd = dateValue(now);
  const periodStartDate = new Date(now);
  periodStartDate.setMonth(periodStartDate.getMonth() - 3);
  const scheduled = new Date(now);
  scheduled.setDate(scheduled.getDate() + 14);
  return (
    <form
      action={action}
      className="rounded-3xl border border-white/10 bg-white/[.04] p-6"
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Review title">
          <input
            name="title"
            required
            maxLength={200}
            className={field}
            placeholder="Q3 enterprise EHS management review"
          />
        </Field>
        <Field label="Frequency">
          <select
            name="frequency"
            defaultValue={ExecutiveReviewFrequency.QUARTERLY}
            className={field}
          >
            {Object.values(ExecutiveReviewFrequency).map((value) => (
              <option value={value} key={value}>
                {pretty(value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Chair">
          <select name="chairId" required className={field} defaultValue="">
            <option value="" disabled>
              Select review chair
            </option>
            {users.map((user) => (
              <option value={user.id} key={user.id}>
                {user.name}
                {user.jobTitle ? ` — ${user.jobTitle}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Site scope">
          <select name="siteId" className={field} defaultValue="">
            <option value="">Enterprise-wide</option>
            {sites.map((site) => (
              <option value={site.id} key={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reporting period start">
          <input
            name="periodStart"
            type="date"
            required
            defaultValue={dateValue(periodStartDate)}
            className={field}
          />
        </Field>
        <Field label="Reporting period end">
          <input
            name="periodEnd"
            type="date"
            required
            defaultValue={periodEnd}
            className={field}
          />
        </Field>
        <Field label="Meeting date and time">
          <input
            name="scheduledAt"
            type="datetime-local"
            required
            defaultValue={dateTimeValue(scheduled)}
            className={field}
          />
        </Field>
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Field label="Scope">
          <textarea
            name="scope"
            rows={5}
            minLength={10}
            maxLength={4000}
            required
            className={field}
            placeholder="Sites, operations, business units, standards, and exclusions."
          />
        </Field>
        <Field label="Objectives">
          <textarea
            name="objectives"
            rows={5}
            minLength={10}
            maxLength={4000}
            required
            className={field}
            placeholder="Decisions the leadership team must reach and performance questions it must answer."
          />
        </Field>
      </div>
      <p className="mt-5 text-sm text-slate-400">
        Eight cross-module agenda topics and the chair attendance record are
        created automatically. You can add organization-specific topics before
        scheduling.
      </p>
      <button disabled={pending} className={`mt-5 ${primary}`}>
        {pending ? "Creating…" : "Create controlled review"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function ExecutiveReviewLifecycleControls({
  reviewId,
  status,
  canManage,
  canApprove,
}: {
  reviewId: string;
  status: ExecutiveReviewStatus;
  canManage: boolean;
  canApprove: boolean;
}) {
  if (!canManage && !canApprove) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {canManage && status === ExecutiveReviewStatus.DRAFT ? (
        <>
          <InlineAction
            action={refreshExecutiveReviewSnapshot}
            reviewId={reviewId}
            label="Preview evidence snapshot"
          />
          <InlineAction
            action={scheduleExecutiveReview}
            reviewId={reviewId}
            label="Schedule review"
            prominent
          />
          <InlineAction
            action={cancelExecutiveReview}
            reviewId={reviewId}
            label="Cancel"
          />
        </>
      ) : null}
      {canManage && status === ExecutiveReviewStatus.SCHEDULED ? (
        <>
          <InlineAction
            action={startExecutiveReview}
            reviewId={reviewId}
            label="Start and freeze evidence"
            prominent
          />
          <InlineAction
            action={cancelExecutiveReview}
            reviewId={reviewId}
            label="Cancel"
          />
        </>
      ) : null}
      {canApprove && status === ExecutiveReviewStatus.COMPLETED ? (
        <InlineAction
          action={approveExecutiveReview}
          reviewId={reviewId}
          label="Approve review"
          prominent
        />
      ) : null}
      {canManage && status === ExecutiveReviewStatus.APPROVED ? (
        <InlineAction
          action={publishExecutiveReview}
          reviewId={reviewId}
          label="Publish board pack"
          prominent
        />
      ) : null}
      {canManage && status === ExecutiveReviewStatus.PUBLISHED ? (
        <InlineAction
          action={archiveExecutiveReview}
          reviewId={reviewId}
          label="Archive review"
        />
      ) : null}
    </div>
  );
}

export function AgendaItemForm({
  reviewId,
  users,
}: {
  reviewId: string;
  users: UserOption[];
}) {
  const [state, action, pending] = useActionState(
    addExecutiveAgendaItem,
    initialFormActionState,
  );
  return (
    <details className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
      <summary className="cursor-pointer font-semibold text-cyan-200">
        Add organization-specific agenda topic
      </summary>
      <form action={action} className="mt-4 grid gap-4 md:grid-cols-2">
        <input type="hidden" name="reviewId" value={reviewId} />
        <Field label="Topic">
          <input name="topic" required maxLength={200} className={field} />
        </Field>
        <Field label="Evidence owner">
          <select name="ownerId" className={field} defaultValue="">
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option value={user.id} key={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Source module">
          <input
            name="sourceModule"
            required
            maxLength={80}
            className={field}
            placeholder="QUALITY"
          />
        </Field>
        <Field label="Internal source link">
          <input
            name="sourceHref"
            maxLength={500}
            className={field}
            placeholder="/quality"
          />
        </Field>
        <label className="md:col-span-2">
          <span className="text-sm">Review prompt</span>
          <textarea
            name="reviewPrompt"
            required
            rows={3}
            maxLength={2000}
            className={field}
          />
        </label>
        <button disabled={pending} className={primary}>
          {pending ? "Adding…" : "Add agenda item"}
        </button>
        <Feedback state={state} />
      </form>
    </details>
  );
}

export function AttendeeForm({
  reviewId,
  users,
}: {
  reviewId: string;
  users: UserOption[];
}) {
  const [state, action, pending] = useActionState(
    assignExecutiveAttendee,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4 md:grid-cols-3"
    >
      <input type="hidden" name="reviewId" value={reviewId} />
      <Field label="Participant">
        <select name="userId" required defaultValue="" className={field}>
          <option value="" disabled>
            Select user
          </option>
          {users.map((user) => (
            <option value={user.id} key={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Review role">
        <select
          name="role"
          defaultValue={ExecutiveReviewAttendanceRole.ATTENDEE}
          className={field}
        >
          {Object.values(ExecutiveReviewAttendanceRole).map((value) => (
            <option value={value} key={value}>
              {pretty(value)}
            </option>
          ))}
        </select>
      </Field>
      <div className="self-end">
        <button disabled={pending} className={primary}>
          {pending ? "Assigning…" : "Assign participant"}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function AttendanceForm({
  reviewId,
  attendee,
}: {
  reviewId: string;
  attendee: {
    id: string;
    attended: boolean;
    attendanceNote: string | null;
  };
}) {
  const [state, action, pending] = useActionState(
    recordExecutiveAttendance,
    initialFormActionState,
  );
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="reviewId" value={reviewId} />
      <input type="hidden" name="attendeeId" value={attendee.id} />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="attended"
          defaultChecked={attendee.attended}
        />
        Attended
      </label>
      <input
        name="attendanceNote"
        defaultValue={attendee.attendanceNote ?? ""}
        maxLength={1000}
        className={field}
        placeholder="Attendance note (optional)"
      />
      <button disabled={pending} className={`mt-3 ${secondary}`}>
        {pending ? "Saving…" : "Save attendance"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function AgendaOutcomeForm({
  reviewId,
  agendaItemId,
  discussion,
  conclusion,
  status,
}: {
  reviewId: string;
  agendaItemId: string;
  discussion: string | null;
  conclusion: string | null;
  status: ExecutiveReviewAgendaStatus;
}) {
  const [state, action, pending] = useActionState(
    recordExecutiveAgendaOutcome,
    initialFormActionState,
  );
  return (
    <form action={action} className="mt-4 border-t border-white/10 pt-4">
      <input type="hidden" name="reviewId" value={reviewId} />
      <input type="hidden" name="agendaItemId" value={agendaItemId} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Outcome status">
          <select name="status" defaultValue={status} className={field}>
            {[
              ExecutiveReviewAgendaStatus.PRESENTED,
              ExecutiveReviewAgendaStatus.DEFERRED,
              ExecutiveReviewAgendaStatus.CLOSED,
            ].map((value) => (
              <option value={value} key={value}>
                {pretty(value)}
              </option>
            ))}
          </select>
        </Field>
        <span />
        <Field label="Discussion record">
          <textarea
            name="discussion"
            rows={4}
            minLength={20}
            required
            defaultValue={discussion ?? ""}
            className={field}
          />
        </Field>
        <Field label="Conclusion">
          <textarea
            name="conclusion"
            rows={4}
            minLength={10}
            required
            defaultValue={conclusion ?? ""}
            className={field}
          />
        </Field>
      </div>
      <button disabled={pending} className={`mt-4 ${primary}`}>
        {pending ? "Recording…" : "Record agenda outcome"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function DecisionForm({
  reviewId,
  agenda,
  users,
}: {
  reviewId: string;
  agenda: Array<{ id: string; topic: string }>;
  users: UserOption[];
}) {
  const [state, action, pending] = useActionState(
    createExecutiveDecision,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="rounded-2xl border border-white/10 bg-slate-950/30 p-5"
    >
      <input type="hidden" name="reviewId" value={reviewId} />
      <h3 className="font-semibold">Record management decision</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Decision type">
          <select
            name="type"
            defaultValue={ExecutiveReviewDecisionType.ACTION_REQUIRED}
            className={field}
          >
            {Object.values(ExecutiveReviewDecisionType).map((value) => (
              <option value={value} key={value}>
                {pretty(value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Agenda item">
          <select name="agendaItemId" defaultValue="" className={field}>
            <option value="">General review decision</option>
            {agenda.map((item) => (
              <option value={item.id} key={item.id}>
                {item.topic}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title">
          <input name="title" required maxLength={200} className={field} />
        </Field>
        <Field label="Priority">
          <select name="priority" defaultValue={RiskLevel.HIGH} className={field}>
            {Object.values(RiskLevel).map((value) => (
              <option value={value} key={value}>
                {pretty(value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Owner (required for actions)">
          <select name="ownerId" defaultValue="" className={field}>
            <option value="">Unassigned / note only</option>
            {users.map((user) => (
              <option value={user.id} key={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due date (required for actions)">
          <input name="dueAt" type="date" className={field} />
        </Field>
        <Field label="Decision rationale">
          <textarea
            name="rationale"
            required
            minLength={10}
            rows={4}
            className={field}
          />
        </Field>
        <Field label="Expected outcome">
          <textarea name="expectedOutcome" rows={4} className={field} />
        </Field>
      </div>
      <button disabled={pending} className={`mt-4 ${primary}`}>
        {pending ? "Recording…" : "Record decision"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function DecisionGovernanceForms({
  reviewId,
  decision,
  users,
  canCreateCapa,
}: {
  reviewId: string;
  decision: {
    id: string;
    title: string;
    status: string;
    correctiveActionId: string | null;
    ownerId: string | null;
    dueAt: Date | null;
  };
  users: UserOption[];
  canCreateCapa: boolean;
}) {
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      {canCreateCapa && !decision.correctiveActionId ? (
        <CapaForm reviewId={reviewId} decision={decision} users={users} />
      ) : null}
      {decision.status === "OPEN" || decision.status === "ACTION_LINKED" ? (
        <DecisionClosureForm reviewId={reviewId} decisionId={decision.id} />
      ) : null}
    </div>
  );
}

function CapaForm({
  reviewId,
  decision,
  users,
}: {
  reviewId: string;
  decision: {
    id: string;
    title: string;
    ownerId: string | null;
    dueAt: Date | null;
  };
  users: UserOption[];
}) {
  const [state, action, pending] = useActionState(
    createCapaFromExecutiveDecision,
    initialFormActionState,
  );
  return (
    <details className="rounded-xl border border-cyan-300/20 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-cyan-200">
        Materialize as CAPA
      </summary>
      <form action={action} className="mt-4">
        <input type="hidden" name="reviewId" value={reviewId} />
        <input type="hidden" name="decisionId" value={decision.id} />
        <Field label="CAPA title">
          <input
            name="title"
            required
            defaultValue={decision.title}
            className={field}
          />
        </Field>
        <Field label="Assignee">
          <select
            name="assignedToId"
            required
            defaultValue={decision.ownerId ?? ""}
            className={field}
          >
            <option value="" disabled>
              Select assignee
            </option>
            {users.map((user) => (
              <option value={user.id} key={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due date">
          <input
            name="dueDate"
            type="date"
            required
            defaultValue={
              decision.dueAt ? dateValue(decision.dueAt) : undefined
            }
            className={field}
          />
        </Field>
        <Field label="Description">
          <textarea name="description" rows={3} className={field} />
        </Field>
        <button disabled={pending} className={`mt-3 ${primary}`}>
          {pending ? "Creating…" : "Create linked CAPA"}
        </button>
        <Feedback state={state} />
      </form>
    </details>
  );
}

function DecisionClosureForm({
  reviewId,
  decisionId,
}: {
  reviewId: string;
  decisionId: string;
}) {
  const [state, action, pending] = useActionState(
    closeExecutiveDecision,
    initialFormActionState,
  );
  return (
    <details className="rounded-xl border border-white/10 p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Record implementation / closure
      </summary>
      <form action={action} className="mt-4">
        <input type="hidden" name="reviewId" value={reviewId} />
        <input type="hidden" name="decisionId" value={decisionId} />
        <textarea
          name="closureEvidence"
          minLength={20}
          required
          rows={4}
          className={field}
          placeholder="Record implementation evidence and effectiveness."
        />
        <button disabled={pending} className={`mt-3 ${secondary}`}>
          {pending ? "Closing…" : "Close decision"}
        </button>
        <Feedback state={state} />
      </form>
    </details>
  );
}

export function ReviewCompletionForm({
  reviewId,
  frequency,
  suggestedNextReviewAt,
}: {
  reviewId: string;
  frequency: ExecutiveReviewFrequency;
  suggestedNextReviewAt: Date | null;
}) {
  const [state, action, pending] = useActionState(
    completeExecutiveReview,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[.04] p-6"
    >
      <input type="hidden" name="reviewId" value={reviewId} />
      <h2 className="text-xl font-semibold">Complete management review</h2>
      <p className="mt-1 text-sm text-slate-400">
        Capture the leadership team’s controlled conclusions. Each narrative
        requires substantive content before completion.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {[
          ["executiveSummary", "Executive summary"],
          ["performanceConclusion", "Performance conclusion"],
          ["riskControlConclusion", "Risk and control conclusion"],
          ["complianceConclusion", "Compliance conclusion"],
          ["resourceAdequacy", "Resource adequacy"],
          ["decisionsSummary", "Decisions summary"],
        ].map(([name, label]) => (
          <Field label={label} key={name}>
            <textarea
              name={name}
              required
              minLength={20}
              rows={4}
              className={field}
            />
          </Field>
        ))}
        <Field label="Significant changes">
          <textarea name="significantChanges" rows={4} className={field} />
        </Field>
        <Field label="Overall conclusion">
          <select
            name="overallConclusion"
            defaultValue={ExecutiveReviewConclusion.EFFECTIVE_WITH_CONCERNS}
            className={field}
          >
            {Object.values(ExecutiveReviewConclusion).map((value) => (
              <option value={value} key={value}>
                {pretty(value)}
              </option>
            ))}
          </select>
        </Field>
        {frequency !== ExecutiveReviewFrequency.AD_HOC ? (
          <Field label="Next review date">
            <input
              name="nextReviewAt"
              type="date"
              required
              defaultValue={
                suggestedNextReviewAt
                  ? dateValue(suggestedNextReviewAt)
                  : undefined
              }
              className={field}
            />
          </Field>
        ) : null}
      </div>
      <button disabled={pending} className={`mt-5 ${primary}`}>
        {pending ? "Validating…" : "Complete for approval"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function InlineAction({
  action,
  reviewId,
  label,
  prominent = false,
}: {
  action: (
    state: FormActionState,
    data: FormData,
  ) => Promise<FormActionState>;
  reviewId: string;
  label: string;
  prominent?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialFormActionState,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="reviewId" value={reviewId} />
      <button
        disabled={pending}
        className={prominent ? primary : secondary}
      >
        {pending ? "Working…" : label}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      {label}
      {children}
    </label>
  );
}

function Feedback({ state }: { state: FormActionState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.status === "ERROR" ? "alert" : "status"}
      className={`mt-3 text-sm ${
        state.status === "ERROR" ? "text-red-300" : "text-emerald-300"
      }`}
    >
      {state.message}
    </p>
  );
}

function pretty(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function dateTimeValue(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}
