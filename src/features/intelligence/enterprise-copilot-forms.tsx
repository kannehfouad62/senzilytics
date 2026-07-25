"use client";

import {
  archiveAiCopilotConversation,
  askAiCopilot,
  createAiCopilotConversation,
  recordAiCopilotFeedback,
  updateAiCopilotPolicy,
} from "@/features/intelligence/enterprise-copilot.actions";
import {
  AI_COPILOT_MAX_QUESTION_LENGTH,
  AI_COPILOT_MAX_RETENTION_DAYS,
  AI_COPILOT_MAX_TURNS,
  AI_COPILOT_MIN_RETENTION_DAYS,
  AI_COPILOT_MIN_TURNS,
} from "@/modules/intelligence/enterprise-copilot-governance";
import { initialAiCopilotActionState } from "@/modules/intelligence/enterprise-copilot.types";
import { AiIntelligenceFeedbackRating } from "@prisma/client";
import { Archive, MessageSquareText, Send, Settings2 } from "lucide-react";
import { useActionState, useState } from "react";

const field =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-purple-400/50";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-purple-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-50";

const suggestedQuestions = [
  "What needs management attention today, and why?",
  "Which current control weaknesses have the strongest supporting evidence?",
  "Where are overdue obligations or actions concentrated?",
  "What questions should leadership ask at the next management review?",
];

function Feedback({
  state,
}: {
  state: typeof initialAiCopilotActionState;
}) {
  if (!state.message) return null;
  return (
    <p
      aria-live="polite"
      className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
        state.status === "ERROR"
          ? "border-red-400/20 bg-red-400/[.05] text-red-200"
          : "border-emerald-400/20 bg-emerald-400/[.05] text-emerald-200"
      }`}
    >
      {state.message}
    </p>
  );
}

export function NewCopilotConversationForm({
  enabled,
}: {
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    createAiCopilotConversation,
    initialAiCopilotActionState,
  );
  const [question, setQuestion] = useState("");

  return (
    <section className="rounded-3xl border border-purple-400/20 bg-purple-400/[.04] p-6">
      <p className="flex items-center gap-2 text-sm text-purple-300">
        <MessageSquareText size={17} />
        Private source-grounded conversation
      </p>
      <h2 className="mt-2 text-2xl font-semibold">Ask the EHS Copilot</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        The Copilot analyzes only records currently available to your role. It
        provides review-only guidance and cannot change operational records.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {suggestedQuestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setQuestion(suggestion)}
            disabled={!enabled || pending}
            className="rounded-full border border-purple-400/20 px-3 py-1.5 text-left text-xs text-purple-200 transition hover:border-purple-300/50 disabled:opacity-40"
          >
            {suggestion}
          </button>
        ))}
      </div>
      <form action={action} className="mt-5">
        <label className="text-sm font-medium text-slate-200">
          Management question
          <textarea
            name="question"
            required
            minLength={5}
            maxLength={AI_COPILOT_MAX_QUESTION_LENGTH}
            rows={5}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={!enabled || pending}
            placeholder="Ask about current risks, controls, overdue exposure, assurance findings, or leadership priorities…"
            className={field}
          />
        </label>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Do not enter confidential medical details or information outside
            your authorized business purpose.
          </p>
          <button disabled={!enabled || pending} className={primary}>
            <Send size={16} />
            {pending ? "Analyzing…" : "Start conversation"}
          </button>
        </div>
        {!enabled ? (
          <p className="mt-3 text-sm text-amber-200">
            EHS Copilot is disabled by your tenant administrator.
          </p>
        ) : null}
        <Feedback state={state} />
      </form>
    </section>
  );
}

export function CopilotQuestionForm({
  conversationId,
  disabled,
}: {
  conversationId: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    askAiCopilot,
    initialAiCopilotActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-purple-400/20 bg-purple-400/[.04] p-5"
    >
      <input type="hidden" name="conversationId" value={conversationId} />
      <label className="text-sm font-medium text-slate-200">
        Ask a follow-up question
        <textarea
          name="question"
          required
          minLength={5}
          maxLength={AI_COPILOT_MAX_QUESTION_LENGTH}
          rows={4}
          disabled={disabled || pending}
          className={field}
        />
      </label>
      <div className="mt-3 flex justify-end">
        <button disabled={disabled || pending} className={primary}>
          <Send size={16} />
          {pending ? "Analyzing…" : "Send question"}
        </button>
      </div>
      {disabled ? (
        <p className="mt-3 text-sm text-amber-200">
          This conversation is read-only. Start a new conversation to continue.
        </p>
      ) : null}
      <Feedback state={state} />
    </form>
  );
}

export function CopilotFeedbackForm({
  conversationId,
  messageId,
  currentRating,
}: {
  conversationId: string;
  messageId: string;
  currentRating: string | null;
}) {
  const [state, action, pending] = useActionState(
    recordAiCopilotFeedback,
    initialAiCopilotActionState,
  );
  return (
    <details className="mt-4 rounded-xl border border-white/10 p-3">
      <summary className="cursor-pointer text-xs text-slate-400">
        {currentRating
          ? `Your feedback: ${currentRating.replaceAll("_", " ").toLowerCase()}`
          : "Rate this response"}
      </summary>
      <form action={action} className="mt-3">
        <input type="hidden" name="conversationId" value={conversationId} />
        <input type="hidden" name="messageId" value={messageId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-400">
            Rating
            <select
              name="rating"
              required
              defaultValue={currentRating ?? ""}
              className={field}
            >
              <option value="" disabled>
                Select rating
              </option>
              {Object.values(AiIntelligenceFeedbackRating).map((rating) => (
                <option key={rating} value={rating}>
                  {rating.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Comment (optional)
            <input name="comment" maxLength={1_000} className={field} />
          </label>
        </div>
        <button disabled={pending} className={`mt-3 ${secondary}`}>
          {pending ? "Saving…" : "Save feedback"}
        </button>
        <Feedback state={state} />
      </form>
    </details>
  );
}

export function CopilotArchiveForm({
  conversationId,
}: {
  conversationId: string;
}) {
  const [state, action, pending] = useActionState(
    archiveAiCopilotConversation,
    initialAiCopilotActionState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="conversationId" value={conversationId} />
      <button disabled={pending} className={secondary}>
        <Archive size={15} />
        {pending ? "Archiving…" : "Archive conversation"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function CopilotPolicyForm({
  policy,
}: {
  policy: {
    enabled: boolean;
    retentionDays: number;
    maxTurnsPerConversation: number;
    includeConversationHistory: boolean;
  };
}) {
  const [state, action, pending] = useActionState(
    updateAiCopilotPolicy,
    initialAiCopilotActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-white/10 bg-white/[.04] p-6"
    >
      <p className="flex items-center gap-2 text-sm text-purple-300">
        <Settings2 size={17} />
        Tenant AI governance
      </p>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <label className="rounded-2xl border border-white/10 p-4 text-sm text-slate-300">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={policy.enabled}
            className="mr-3"
          />
          Enable EHS Copilot for entitled users
        </label>
        <label className="rounded-2xl border border-white/10 p-4 text-sm text-slate-300">
          <input
            type="checkbox"
            name="includeConversationHistory"
            defaultChecked={policy.includeConversationHistory}
            className="mr-3"
          />
          Use prior turns as conversational context
        </label>
        <label className="text-sm text-slate-300">
          Conversation retention (days)
          <input
            name="retentionDays"
            type="number"
            required
            min={AI_COPILOT_MIN_RETENTION_DAYS}
            max={AI_COPILOT_MAX_RETENTION_DAYS}
            defaultValue={policy.retentionDays}
            className={field}
          />
          <span className="mt-2 block text-xs text-slate-500">
            Content and frozen citations are redacted after expiry.
          </span>
        </label>
        <label className="text-sm text-slate-300">
          Maximum turns per conversation
          <input
            name="maxTurnsPerConversation"
            type="number"
            required
            min={AI_COPILOT_MIN_TURNS}
            max={AI_COPILOT_MAX_TURNS}
            defaultValue={policy.maxTurnsPerConversation}
            className={field}
          />
          <span className="mt-2 block text-xs text-slate-500">
            A turn consists of one user question and one Copilot response.
          </span>
        </label>
      </div>
      <button disabled={pending} className={`mt-5 ${primary}`}>
        <Settings2 size={16} />
        {pending ? "Saving…" : "Save tenant policy"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
