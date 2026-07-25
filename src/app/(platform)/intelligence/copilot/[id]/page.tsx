import {
  CopilotArchiveForm,
  CopilotFeedbackForm,
  CopilotQuestionForm,
} from "@/features/intelligence/enterprise-copilot-forms";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  getAiCopilotConversationService,
  getAiCopilotPolicyService,
} from "@/modules/intelligence/enterprise-copilot.service";
import type { AiCopilotDraft } from "@/modules/intelligence/enterprise-copilot.types";
import {
  AiCopilotConversationStatus,
  AiCopilotMessageRole,
  PermissionKey,
} from "@prisma/client";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  ExternalLink,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EnterpriseEhsCopilotConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_DASHBOARD);
  await requirePermission(PermissionKey.USE_AI);
  const [{ organizationId, user }, { id }] = await Promise.all([
    getCurrentUserTenant(),
    params,
  ]);
  const [conversation, policy] = await Promise.all([
    getAiCopilotConversationService(organizationId, user.id, id),
    getAiCopilotPolicyService(organizationId),
  ]);
  if (!conversation) notFound();

  const retainedTurns = conversation.messages.filter(
    (message) => message.role === AiCopilotMessageRole.USER,
  ).length;
  const readOnly =
    !policy.enabled ||
    conversation.status !== AiCopilotConversationStatus.ACTIVE ||
    Boolean(conversation.purgedAt) ||
    retainedTurns >= policy.maxTurnsPerConversation;

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/intelligence/copilot"
        className="inline-flex items-center gap-2 text-sm text-slate-400"
      >
        <ArrowLeft size={16} />
        Enterprise EHS Copilot
      </Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-purple-300">
            <LockKeyhole size={17} />
            Private conversation · {pretty(conversation.status)}
          </p>
          <h1 className="mt-2 max-w-4xl text-3xl font-bold">
            {conversation.title}
          </h1>
          <p className="mt-2 text-xs text-slate-500">
            {retainedTurns}/{policy.maxTurnsPerConversation} turns · retained
            until {conversation.retentionExpiresAt.toLocaleDateString()} ·
            policy {conversation.policyVersion}
          </p>
        </div>
        {conversation.status === AiCopilotConversationStatus.ACTIVE &&
        !conversation.purgedAt ? (
          <CopilotArchiveForm conversationId={conversation.id} />
        ) : null}
      </div>

      <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/[.05] p-4 text-sm text-amber-100">
        <ShieldCheck size={18} className="mr-2 inline" />
        Copilot responses are decision support, not findings, approvals, legal
        determinations, medical advice, or operational record changes. Verify
        every cited source before acting.
      </div>

      {conversation.purgedAt ? (
        <div className="mt-6 rounded-2xl border border-slate-400/20 bg-slate-400/[.04] p-5 text-sm text-slate-300">
          This conversation expired on {conversation.purgedAt.toLocaleString()}.
          Its content and frozen citations were removed under the tenant
          retention policy.
        </div>
      ) : null}

      <section className="mt-8 space-y-5">
        {conversation.messages.map((message) =>
          message.role === AiCopilotMessageRole.USER ? (
            <article
              key={message.id}
              className="ml-auto max-w-3xl rounded-3xl border border-cyan-400/20 bg-cyan-400/[.05] p-5"
            >
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">
                <UserRound size={14} />
                You · {message.createdAt.toLocaleString()}
              </p>
              <p className="mt-3 leading-7 text-slate-100">{message.content}</p>
            </article>
          ) : (
            <CopilotResponse
              key={message.id}
              conversationId={conversation.id}
              message={message}
            />
          ),
        )}
      </section>

      <div className="mt-8">
        <CopilotQuestionForm
          conversationId={conversation.id}
          disabled={readOnly}
        />
      </div>
    </div>
  );
}

type Conversation = NonNullable<
  Awaited<ReturnType<typeof getAiCopilotConversationService>>
>;
type AssistantMessage = Conversation["messages"][number];

function CopilotResponse({
  conversationId,
  message,
}: {
  conversationId: string;
  message: AssistantMessage;
}) {
  const draft = message.responsePayload as unknown as AiCopilotDraft | null;
  const sourceMap = new Map(
    message.citations.map((citation) => [citation.sourceKey, citation]),
  );
  const feedback = message.feedback[0] ?? null;

  return (
    <article className="mr-auto max-w-5xl rounded-3xl border border-purple-400/20 bg-purple-400/[.04] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-purple-300">
          <Bot size={15} />
          EHS Copilot · {message.createdAt.toLocaleString()}
        </p>
        {message.confidence ? (
          <span className="rounded-full bg-purple-400/10 px-3 py-1 text-xs text-purple-200">
            {pretty(message.confidence)} confidence
          </span>
        ) : null}
      </div>
      <p className="mt-4 leading-7 text-slate-100">{message.content}</p>
      {draft ? (
        <>
          <Citations keys={draft.answerSourceKeys} sourceMap={sourceMap} />
          {draft.keyPoints.length ? (
            <div className="mt-5 space-y-3">
              {draft.keyPoints.map((item, index) => (
                <div
                  key={`${message.id}-point-${index}`}
                  className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                >
                  <p className="text-sm leading-6 text-slate-300">{item.text}</p>
                  <Citations keys={item.sourceKeys} sourceMap={sourceMap} />
                </div>
              ))}
            </div>
          ) : null}
          {draft.escalation.required ? (
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[.05] p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                <AlertTriangle size={16} />
                Qualified management review recommended
              </p>
              <p className="mt-2 text-sm text-amber-100/80">
                {draft.escalation.reason}
              </p>
              <Citations
                keys={draft.escalation.sourceKeys}
                sourceMap={sourceMap}
              />
            </div>
          ) : null}
          {draft.followUpQuestions.length ? (
            <div className="mt-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Possible follow-up questions
              </p>
              <ul className="mt-2 space-y-2 text-sm text-slate-300">
                {draft.followUpQuestions.map((question) => (
                  <li key={question}>• {question}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Confidence rationale
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {draft.confidence.rationale}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Limitations
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {draft.limitations}
              </p>
            </div>
          </div>
        </>
      ) : null}
      {message.citations.length ? (
        <details className="mt-5 rounded-2xl border border-white/10 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-300">
            Frozen source register ({message.citations.length})
          </summary>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {message.citations.map((citation) => (
              <Link
                key={citation.id}
                href={citation.href}
                className="rounded-xl border border-white/10 bg-slate-950/50 p-4 transition hover:border-purple-400/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-purple-300">
                    {citation.sourceKey} · {citation.module}
                  </span>
                  <ExternalLink size={13} className="text-slate-500" />
                </div>
                <p className="mt-2 text-sm font-medium text-white">
                  {citation.title}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {citation.summary}
                </p>
              </Link>
            ))}
          </div>
        </details>
      ) : null}
      {draft ? (
        <CopilotFeedbackForm
          conversationId={conversationId}
          messageId={message.id}
          currentRating={feedback?.rating ?? null}
        />
      ) : null}
    </article>
  );
}

type Citation = AssistantMessage["citations"][number];

function Citations({
  keys,
  sourceMap,
}: {
  keys: string[];
  sourceMap: Map<string, Citation>;
}) {
  const citations = keys
    .map((key) => sourceMap.get(key))
    .filter((source): source is Citation => Boolean(source));
  if (!citations.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {citations.map((citation) => (
        <Link
          key={citation.sourceKey}
          href={citation.href}
          className="rounded-full border border-purple-400/20 px-3 py-1 text-xs text-purple-200"
        >
          {citation.sourceKey} · {citation.module}
        </Link>
      ))}
    </div>
  );
}

function pretty(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
