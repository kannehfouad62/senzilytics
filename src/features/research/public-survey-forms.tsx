"use client";

import {
  ResearchPublicLinkStatus,
  ResearchResponseIdentityMode,
} from "@prisma/client";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useActionState, useState } from "react";

import {
  initialFormActionState,
  type FormActionState,
} from "@/core/actions/action-state";
import { RuntimeFormFields } from "@/features/forms/runtime-form-fields";
import {
  changePublicSurveyLinkStatus,
  createPublicSurveyLink,
} from "@/features/research/public-survey-link-actions";
import {
  savePublicResearchSurveyDraft,
  submitPublicResearchSurvey,
} from "@/features/research/public-survey-actions";
import { useRefreshOnSuccess } from "@/features/research/use-refresh-on-success";

const input =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white";
const primary =
  "rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50";

function Feedback({
  state,
  refresh = false,
}: {
  state: FormActionState;
  refresh?: boolean;
}) {
  if (refresh) return <RefreshingFeedback state={state} />;
  return state.message ? (
    <p
      role={state.status === "ERROR" ? "alert" : "status"}
      className={`mt-4 rounded-xl border p-3 text-sm ${state.status === "ERROR" ? "border-red-400/20 bg-red-400/10 text-red-200" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"}`}
    >
      {state.message}
    </p>
  ) : null;
}

function RefreshingFeedback({ state }: { state: FormActionState }) {
  useRefreshOnSuccess(state);
  return <Feedback state={state} />;
}

export function PublicSurveyLinkForm({
  collectionId,
}: {
  collectionId: string;
}) {
  const [state, action, pending] = useActionState(
    createPublicSurveyLink,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-cyan-400/15 bg-cyan-400/[.035] p-6"
    >
      <input type="hidden" name="collectionId" value={collectionId} />
      <h2 className="text-xl font-semibold">Create public response link</h2>
      <p className="mt-2 text-sm text-slate-400">
        Create a secure shareable link for collecting multiple external
        responses without requiring Senzilytics accounts.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Label text="Link label">
          <input
            name="label"
            required
            maxLength={160}
            placeholder="Employee engagement survey"
            className={input}
          />
        </Label>
        <Label text="Maximum responses">
          <input
            name="maxResponses"
            type="number"
            min={1}
            placeholder="Unlimited"
            className={input}
          />
        </Label>
        <Label text="Link expiry">
          <input name="expiresAt" type="datetime-local" className={input} />
        </Label>
        <Label text="Speeding review threshold (seconds)">
          <input
            name="minimumCompletionSeconds"
            type="number"
            min={10}
            max={86400}
            placeholder="Optional"
            className={input}
          />
        </Label>
      </div>
      <div className="mt-4 flex flex-wrap gap-5 text-sm text-slate-300">
        <label className="flex items-center gap-2">
          <input name="allowSaveResume" type="checkbox" defaultChecked />
          Allow secure save and resume
        </label>
        <label className="flex items-center gap-2">
          <input name="randomizeQuestions" type="checkbox" />
          Deterministically randomize questions
        </label>
      </div>
      <button disabled={pending} className={`mt-5 ${primary}`}>
        {pending ? "Creating…" : "Create shareable link"}
      </button>
      <Feedback state={state} refresh />
    </form>
  );
}

export function PublicSurveyLinkCard({
  link,
}: {
  link: {
    id: string;
    token: string;
    label: string;
    status: ResearchPublicLinkStatus;
    maxResponses: number | null;
    expiresAt: Date | null;
    responseCount: number;
    createdBy: string | null;
  };
}) {
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState(
    changePublicSurveyLinkStatus,
    initialFormActionState,
  );
  const path = `/survey/${link.token}`;
  const copy = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const targets =
    link.status === ResearchPublicLinkStatus.ACTIVE
      ? [ResearchPublicLinkStatus.PAUSED, ResearchPublicLinkStatus.REVOKED]
      : link.status === ResearchPublicLinkStatus.PAUSED
        ? [ResearchPublicLinkStatus.ACTIVE, ResearchPublicLinkStatus.REVOKED]
        : [];
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/45 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{link.label}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {link.responseCount} responses ·{" "}
            {link.maxResponses ? `limit ${link.maxResponses}` : "unlimited"} ·{" "}
            {link.expiresAt
              ? `expires ${link.expiresAt.toLocaleString()}`
              : "no separate expiry"}
          </p>
        </div>
        <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-cyan-200">
          {link.status}
        </span>
      </div>
      <p className="mt-3 truncate rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs text-slate-400">
        {path}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 px-3 py-2 text-xs text-cyan-200"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy full link"}
        </button>
        <a
          href={path}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300"
        >
          <ExternalLink size={14} />
          Preview
        </a>
        {targets.map((target) => (
          <form action={action} key={target}>
            <input type="hidden" name="linkId" value={link.id} />
            <input type="hidden" name="status" value={target} />
            <button
              disabled={pending}
              className={`rounded-lg border px-3 py-2 text-xs ${target === ResearchPublicLinkStatus.REVOKED ? "border-red-400/20 text-red-300" : "border-amber-400/20 text-amber-200"}`}
            >
              {target === ResearchPublicLinkStatus.ACTIVE
                ? "Resume"
                : target === ResearchPublicLinkStatus.PAUSED
                  ? "Pause"
                  : "Revoke"}
            </button>
          </form>
        ))}
      </div>
      <Feedback state={state} refresh />
    </article>
  );
}

export function PublicResearchSurveyForm({
  token,
  identityMode,
  consentStatement,
  form,
  invitationToken,
  invitedName,
  invitedEmail,
  allowSaveResume,
  initialValues,
  initialIdentity,
}: {
  token: string;
  identityMode: ResearchResponseIdentityMode;
  consentStatement: string | null;
  form: Parameters<typeof RuntimeFormFields>[0]["forms"][number];
  invitationToken: string | null;
  invitedName: string | null;
  invitedEmail: string | null;
  allowSaveResume: boolean;
  initialValues: Record<string, string | string[] | boolean>;
  initialIdentity: {
    participantName?: string | null;
    participantEmail?: string | null;
    pseudonymousReference?: string | null;
  };
}) {
  const [state, action, pending] = useActionState(
    submitPublicResearchSurvey,
    initialFormActionState,
  );
  const [saveState, saveAction, saving] = useActionState(
    savePublicResearchSurveyDraft,
    initialFormActionState,
  );
  if (state.status === "SUCCESS")
    return (
      <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[.06] p-8 text-center">
        <Check className="mx-auto text-emerald-300" size={34} />
        <h2 className="mt-4 text-2xl font-semibold">Response submitted</h2>
        <p className="mt-2 text-slate-300">{state.message}</p>
        {!invitationToken && (
          <a
            href={`/survey/${token}`}
            className="mt-6 inline-block rounded-xl border border-emerald-400/25 px-5 py-3 text-sm font-semibold text-emerald-200"
          >
            Submit another response
          </a>
        )}
      </section>
    );
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="token" value={token} />
      {invitationToken && (
        <input type="hidden" name="invitationToken" value={invitationToken} />
      )}
      <label className="absolute -left-[10000px]" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {identityMode === ResearchResponseIdentityMode.IDENTIFIED && (
        <div className="grid gap-4 md:grid-cols-2">
          <Label text="Your name">
            <input
              name="participantName"
              required
              maxLength={160}
              autoComplete="name"
              defaultValue={
                invitedName ?? initialIdentity.participantName ?? ""
              }
              className={input}
            />
          </Label>
          <Label text="Your email">
            <input
              name="participantEmail"
              required
              type="email"
              maxLength={254}
              autoComplete="email"
              defaultValue={
                invitedEmail ?? initialIdentity.participantEmail ?? ""
              }
              className={input}
            />
          </Label>
        </div>
      )}
      {identityMode === ResearchResponseIdentityMode.PSEUDONYMIZED && (
        <Label text="Participant reference">
          <input
            name="pseudonymousReference"
            required
            maxLength={160}
            autoComplete="off"
            defaultValue={initialIdentity.pseudonymousReference ?? ""}
            className={input}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Use the participant code supplied by the research team. Your name is
            not collected here.
          </span>
        </Label>
      )}
      {consentStatement && (
        <label className="block rounded-2xl border border-amber-400/20 bg-amber-400/[.06] p-5 text-sm text-slate-300">
          <span className="block font-semibold text-amber-200">
            Participant consent
          </span>
          <span className="mt-2 block whitespace-pre-wrap">
            {consentStatement}
          </span>
          <span className="mt-4 flex items-start gap-3">
            <input
              type="checkbox"
              name="participantConsent"
              required
              className="mt-1"
            />{" "}
            I have read this statement and consent to participate.
          </span>
        </label>
      )}
      <RuntimeFormFields forms={[form]} initialValues={initialValues} />
      <Feedback state={state} />
      <Feedback state={saveState} />
      <div className="flex flex-wrap gap-3">
        <button disabled={pending || saving} className={primary}>
          {pending ? "Submitting securely…" : "Submit response"}
        </button>
        {allowSaveResume && (
          <button
            type="submit"
            formAction={saveAction}
            disabled={pending || saving}
            formNoValidate
            className="rounded-xl border border-cyan-400/25 px-5 py-3 text-sm font-semibold text-cyan-200 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save and continue later"}
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Each submission is recorded as a separate response against this governed
        questionnaire version.
      </p>
    </form>
  );
}

function Label({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm text-slate-300">
      <span>{text}</span>
      {children}
    </label>
  );
}
