"use client";

import {
  initialFormActionState,
  type FormActionState,
} from "@/core/actions/action-state";
import {
  decideProductionReadinessAction,
  initializeProductionReadinessAction,
  submitProductionReadinessAction,
  updateProductionReadinessControlAction,
  updateProductionReadinessMetadataAction,
} from "@/features/platform/production-readiness.actions";
import { productionReadinessControlDefinitions } from "@/modules/platform/production-readiness";
import {
  ProductionReadinessControlKey,
  ProductionReadinessControlStatus,
  ProductionReadinessReviewStatus,
} from "@prisma/client";
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

const input =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-50";

type ReadinessReview = {
  id: string;
  version: number;
  status: ProductionReadinessReviewStatus;
  targetReviewAt: string | null;
  executiveSummary: string | null;
  submissionNotes: string | null;
  reviewNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  controls: Array<{
    id: string;
    key: ProductionReadinessControlKey;
    status: ProductionReadinessControlStatus;
    ownerId: string | null;
    dueAt: string | null;
    testMethod: string | null;
    evidenceSummary: string | null;
    resultNotes: string | null;
    evidenceUrl: string | null;
    testedAt: string | null;
    owner: { name: string } | null;
    testedBy: { name: string } | null;
  }>;
};

type UserOption = { id: string; name: string; email: string };

export function ProductionReadinessWorkspace({
  organization,
  users,
  review,
  progress,
}: {
  organization: { id: string; name: string };
  users: UserOption[];
  review: ReadinessReview | null;
  progress: number;
}) {
  if (!review) {
    return (
      <InitializeReview
        organizationId={organization.id}
        title={`Initialize Production Assurance for ${organization.name}`}
      />
    );
  }
  const editable =
    review.status === ProductionReadinessReviewStatus.DRAFT ||
    review.status === ProductionReadinessReviewStatus.REJECTED;
  const controlsByKey = new Map(review.controls.map((control) => [control.key, control]));
  const counts = Object.values(ProductionReadinessControlStatus).map((status) => ({
    status,
    count: review.controls.filter((control) => control.status === status).length,
  }));

  return (
    <div className="space-y-7">
      <section className="rounded-3xl border border-emerald-400/15 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,.12),transparent_35%),rgba(255,255,255,.035)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-sm text-emerald-300">
              <ShieldCheck size={17} /> Production Assurance 2.0
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Readiness review v{review.version}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Evidence-based controls independently govern the final tenant
              go-live decision. Approval records readiness; it does not claim
              zero operational risk.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-center">
            <p className="text-3xl font-bold text-emerald-200">{progress}%</p>
            <p className="mt-1 text-xs text-slate-500">Readiness score</p>
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-950">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-400"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <StatusBadge status={review.status} />
          {counts
            .filter((item) => item.count > 0)
            .map((item) => (
              <span
                key={item.status}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400"
              >
                {pretty(item.status)}: {item.count}
              </span>
            ))}
        </div>
      </section>

      {editable ? (
        <ReviewMetadataForm organizationId={organization.id} review={review} />
      ) : (
        <ReviewSummary review={review} />
      )}

      <section>
        <div className="mb-4">
          <h2 className="text-2xl font-semibold text-white">
            Governed production controls
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Every result requires traceable evidence. Conditional or failed
            controls require an accountable tenant owner and remediation date.
          </p>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          {productionReadinessControlDefinitions.map((definition, index) => {
            const control = controlsByKey.get(definition.key);
            if (!control) return null;
            return (
              <article
                key={definition.key}
                className={`rounded-3xl border p-5 ${
                  control.status === ProductionReadinessControlStatus.FAIL
                    ? "border-red-400/25 bg-red-400/[.04]"
                    : control.status ===
                        ProductionReadinessControlStatus.CONDITIONAL
                      ? "border-amber-400/25 bg-amber-400/[.04]"
                      : control.status === ProductionReadinessControlStatus.PASS
                        ? "border-emerald-400/20 bg-emerald-400/[.025]"
                        : "border-white/10 bg-white/[.035]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-cyan-300">
                      CONTROL {index + 1}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      {definition.label}
                    </h3>
                  </div>
                  <ControlBadge status={control.status} />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {definition.description}
                </p>
                {editable ? (
                  <ControlForm
                    organizationId={organization.id}
                    control={control}
                    users={users}
                  />
                ) : (
                  <ControlEvidence control={control} />
                )}
              </article>
            );
          })}
        </div>
      </section>

      {editable ? (
        <SubmitReviewForm organizationId={organization.id} review={review} />
      ) : review.status === ProductionReadinessReviewStatus.IN_REVIEW ? (
        <ReviewDecisionForm organizationId={organization.id} review={review} />
      ) : review.status === ProductionReadinessReviewStatus.APPROVED ? (
        <InitializeReview
          organizationId={organization.id}
          title="Start a new reassessment version"
        />
      ) : null}
    </div>
  );
}

function InitializeReview({
  organizationId,
  title,
}: {
  organizationId: string;
  title: string;
}) {
  const [state, action, pending] = useActionState(
    initializeProductionReadinessAction,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[.04] p-7"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <p className="flex items-center gap-2 text-sm text-emerald-300">
        <Rocket size={17} /> Production Assurance 2.0
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
        Create the controlled twelve-point assessment used for launch approval,
        reassessment, and operational audit evidence.
      </p>
      <Feedback state={state} />
      <button
        disabled={pending}
        className="mt-5 rounded-xl bg-emerald-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
      >
        {pending ? "Initializing…" : "Initialize readiness review"}
      </button>
    </form>
  );
}

function ReviewMetadataForm({
  organizationId,
  review,
}: {
  organizationId: string;
  review: ReadinessReview;
}) {
  const [state, action, pending] = useActionState(
    updateProductionReadinessMetadataAction,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-white/10 bg-white/[.04] p-6"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="reviewId" value={review.id} />
      <h2 className="text-xl font-semibold text-white">Review scope and conclusion</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-[.4fr_1fr]">
        <label className="text-sm text-slate-300">
          Target review date
          <input
            type="date"
            name="targetReviewAt"
            defaultValue={review.targetReviewAt ?? ""}
            className={input}
          />
        </label>
        <label className="text-sm text-slate-300">
          Executive readiness summary
          <textarea
            name="executiveSummary"
            maxLength={4_000}
            rows={4}
            defaultValue={review.executiveSummary ?? ""}
            placeholder="Summarize readiness, residual concerns, dependencies, and the proposed decision."
            className={input}
          />
        </label>
      </div>
      <Feedback state={state} />
      <button
        disabled={pending}
        className="mt-5 rounded-xl border border-cyan-400/25 px-5 py-3 font-semibold text-cyan-200 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save review summary"}
      </button>
    </form>
  );
}

function ControlForm({
  organizationId,
  control,
  users,
}: {
  organizationId: string;
  control: ReadinessReview["controls"][number];
  users: UserOption[];
}) {
  const [state, action, pending] = useActionState(
    updateProductionReadinessControlAction,
    initialFormActionState,
  );
  return (
    <form action={action} className="mt-5 grid gap-3 md:grid-cols-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="controlId" value={control.id} />
      <label className="text-xs text-slate-400">
        Result
        <select name="status" defaultValue={control.status} className={input}>
          {Object.values(ProductionReadinessControlStatus).map((status) => (
            <option key={status} value={status}>
              {pretty(status)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-slate-400">
        Remediation owner
        <select name="ownerId" defaultValue={control.ownerId ?? ""} className={input}>
          <option value="">Unassigned</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-slate-400">
        Test date
        <input
          type="date"
          name="testedAt"
          defaultValue={control.testedAt ?? ""}
          className={input}
        />
      </label>
      <label className="text-xs text-slate-400">
        Remediation due
        <input
          type="date"
          name="dueAt"
          defaultValue={control.dueAt ?? ""}
          className={input}
        />
      </label>
      <label className="text-xs text-slate-400 md:col-span-2">
        Test method
        <input
          name="testMethod"
          maxLength={1_000}
          defaultValue={control.testMethod ?? ""}
          placeholder="Test procedure, sample, environment, and expected result"
          className={input}
        />
      </label>
      <label className="text-xs text-slate-400 md:col-span-2">
        Evidence summary
        <textarea
          name="evidenceSummary"
          maxLength={3_000}
          rows={3}
          defaultValue={control.evidenceSummary ?? ""}
          className={input}
        />
      </label>
      <label className="text-xs text-slate-400 md:col-span-2">
        Result, exception, or not-applicable rationale
        <textarea
          name="resultNotes"
          maxLength={2_000}
          rows={2}
          defaultValue={control.resultNotes ?? ""}
          className={input}
        />
      </label>
      <label className="text-xs text-slate-400 md:col-span-2">
        Evidence reference
        <input
          name="evidenceUrl"
          maxLength={1_000}
          defaultValue={control.evidenceUrl ?? ""}
          placeholder="/documents or an approved HTTPS evidence location"
          className={input}
        />
      </label>
      <Feedback state={state} className="md:col-span-2" />
      <button
        disabled={pending}
        className="rounded-xl border border-cyan-400/25 px-4 py-3 text-sm font-semibold text-cyan-200 disabled:opacity-50 md:col-span-2"
      >
        {pending ? "Recording…" : "Record control evidence"}
      </button>
    </form>
  );
}

function SubmitReviewForm({
  organizationId,
  review,
}: {
  organizationId: string;
  review: ReadinessReview;
}) {
  const [state, action, pending] = useActionState(
    submitProductionReadinessAction,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-cyan-400/20 bg-cyan-400/[.04] p-6"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="reviewId" value={review.id} />
      <h2 className="text-xl font-semibold text-white">Submit for go-live review</h2>
      <p className="mt-2 text-sm text-slate-400">
        All controls must be assessed and failed controls remediated. Conditional
        controls may enter review but cannot receive final approval.
      </p>
      <label className="mt-5 block text-sm text-slate-300">
        Submission notes
        <textarea name="submissionNotes" maxLength={2_000} rows={3} className={input} />
      </label>
      <Feedback state={state} />
      <button
        disabled={pending}
        className="mt-5 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit readiness review"}
      </button>
    </form>
  );
}

function ReviewDecisionForm({
  organizationId,
  review,
}: {
  organizationId: string;
  review: ReadinessReview;
}) {
  const [state, action, pending] = useActionState(
    decideProductionReadinessAction,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-amber-400/20 bg-amber-400/[.04] p-6"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="reviewId" value={review.id} />
      <h2 className="text-xl font-semibold text-white">Platform review decision</h2>
      <p className="mt-2 text-sm text-slate-400">
        Approval requires every control to pass or be formally not applicable.
        The decision and rationale are retained in the tenant activity log.
      </p>
      <label className="mt-5 block text-sm text-slate-300">
        Review rationale
        <textarea name="reviewNotes" required maxLength={3_000} rows={4} className={input} />
      </label>
      <Feedback state={state} />
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          name="decision"
          value={ProductionReadinessReviewStatus.APPROVED}
          disabled={pending}
          className="rounded-xl bg-emerald-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
        >
          Approve readiness
        </button>
        <button
          name="decision"
          value={ProductionReadinessReviewStatus.REJECTED}
          disabled={pending}
          className="rounded-xl border border-red-400/30 px-5 py-3 font-semibold text-red-200 disabled:opacity-50"
        >
          Reject for remediation
        </button>
      </div>
    </form>
  );
}

function ReviewSummary({ review }: { review: ReadinessReview }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
      <h2 className="text-xl font-semibold text-white">Review conclusion</h2>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
        {review.executiveSummary || "No executive summary recorded."}
      </p>
      {review.reviewNotes ? (
        <p className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
          Review rationale: {review.reviewNotes}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
        {review.submittedAt ? <span>Submitted {review.submittedAt}</span> : null}
        {review.reviewedAt ? <span>Reviewed {review.reviewedAt}</span> : null}
      </div>
    </section>
  );
}

function ControlEvidence({
  control,
}: {
  control: ReadinessReview["controls"][number];
}) {
  return (
    <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm">
      <p className="text-slate-300">
        {control.evidenceSummary || "No evidence summary recorded."}
      </p>
      <p className="text-xs leading-5 text-slate-500">
        Method: {control.testMethod || "Not recorded"} · Tested:{" "}
        {control.testedAt || "Not recorded"}
        {control.testedBy ? ` by ${control.testedBy.name}` : ""}
      </p>
      {control.resultNotes ? (
        <p className="text-xs leading-5 text-slate-500">
          Result: {control.resultNotes}
        </p>
      ) : null}
      {control.owner || control.dueAt ? (
        <p className="text-xs text-amber-200">
          Remediation: {control.owner?.name || "Unassigned"}
          {control.dueAt ? ` · due ${control.dueAt}` : ""}
        </p>
      ) : null}
      {control.evidenceUrl ? (
        <Link
          href={control.evidenceUrl}
          target={control.evidenceUrl.startsWith("/") ? undefined : "_blank"}
          rel={control.evidenceUrl.startsWith("/") ? undefined : "noreferrer"}
          className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-300"
        >
          Open evidence <ExternalLink size={14} />
        </Link>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: ProductionReadinessReviewStatus }) {
  const tone =
    status === ProductionReadinessReviewStatus.APPROVED
      ? "bg-emerald-400/10 text-emerald-300"
      : status === ProductionReadinessReviewStatus.REJECTED
        ? "bg-red-400/10 text-red-300"
        : status === ProductionReadinessReviewStatus.IN_REVIEW
          ? "bg-amber-400/10 text-amber-200"
          : "bg-cyan-400/10 text-cyan-200";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {pretty(status)}
    </span>
  );
}

function ControlBadge({
  status,
}: {
  status: ProductionReadinessControlStatus;
}) {
  const tone =
    status === ProductionReadinessControlStatus.PASS
      ? "bg-emerald-400/10 text-emerald-300"
      : status === ProductionReadinessControlStatus.FAIL
        ? "bg-red-400/10 text-red-300"
        : status === ProductionReadinessControlStatus.CONDITIONAL
          ? "bg-amber-400/10 text-amber-200"
          : "bg-slate-800 text-slate-400";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>
      {pretty(status)}
    </span>
  );
}

function Feedback({
  state,
  className = "",
}: {
  state: FormActionState;
  className?: string;
}) {
  if (!state.message) return null;
  const success = state.status === "SUCCESS";
  const Icon = success
    ? CheckCircle2
    : state.status === "ERROR"
      ? CircleAlert
      : LoaderCircle;
  return (
    <p
      role={success ? "status" : "alert"}
      className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${
        success
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          : "border-red-400/20 bg-red-400/10 text-red-300"
      } ${className}`}
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
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
