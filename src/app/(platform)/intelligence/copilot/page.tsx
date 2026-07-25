import { NewCopilotConversationForm } from "@/features/intelligence/enterprise-copilot-forms";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getAiCopilotWorkspaceService } from "@/modules/intelligence/enterprise-copilot.service";
import {
  AiCopilotConversationStatus,
  PermissionKey,
} from "@prisma/client";
import {
  Archive,
  BrainCircuit,
  Clock3,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  ThumbsUp,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EnterpriseEhsCopilotPage() {
  await requirePermission(PermissionKey.VIEW_DASHBOARD);
  await requirePermission(PermissionKey.USE_AI);
  const [{ organizationId, user }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const workspace = await getAiCopilotWorkspaceService(
    organizationId,
    user.id,
  );
  const canManagePolicy = permissions.includes(
    PermissionKey.MANAGE_ORGANIZATION,
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-purple-300">
            <BrainCircuit size={18} />
            Governed conversational intelligence
          </p>
          <h1 className="mt-2 text-4xl font-bold">Enterprise EHS Copilot</h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Ask evidence-grounded questions across the Senzilytics records
            available to your role. Every response preserves its citations,
            confidence, limitations, and governance context.
          </p>
        </div>
        {canManagePolicy ? (
          <Link
            href="/intelligence/copilot/settings"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm"
          >
            <Settings2 size={16} />
            Tenant Copilot policy
          </Link>
        ) : null}
      </div>

      <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/[.05] p-4 text-sm text-amber-100">
        <ShieldCheck size={18} className="mr-2 inline" />
        Decision support only. The Copilot cannot create, change, approve,
        assign, close, or verify any Senzilytics record. Qualified users remain
        accountable for reviewing sources and making decisions.
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          icon={MessageSquareText}
          label="Conversations"
          value={workspace.summary.total}
        />
        <Metric
          icon={Clock3}
          label="Active"
          value={workspace.summary.active}
        />
        <Metric
          icon={Archive}
          label="Archived"
          value={workspace.summary.archived}
        />
        <Metric
          icon={BrainCircuit}
          label="Retained turns"
          value={workspace.summary.retainedTurns}
        />
        <Metric
          icon={ThumbsUp}
          label="Helpful responses"
          value={workspace.summary.helpful}
        />
      </div>

      <div className="mt-8 grid gap-7 xl:grid-cols-[1.1fr_.9fr]">
        <NewCopilotConversationForm enabled={workspace.policy.enabled} />
        <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
          <h2 className="text-xl font-semibold">Your governance boundary</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <PolicyRow
              label="Availability"
              value={workspace.policy.enabled ? "Enabled" : "Disabled"}
            />
            <PolicyRow
              label="Retention"
              value={`${workspace.policy.retentionDays} days`}
            />
            <PolicyRow
              label="Conversation limit"
              value={`${workspace.policy.maxTurnsPerConversation} turns`}
            />
            <PolicyRow
              label="History context"
              value={
                workspace.policy.includeConversationHistory
                  ? "Enabled"
                  : "Disabled"
              }
            />
            <PolicyRow label="Visibility" value="Private to your user account" />
            <PolicyRow
              label="Source scope"
              value="Tenant and permission filtered at every turn"
            />
          </dl>
        </section>
      </div>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[.04] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-purple-300">Private conversation register</p>
            <h2 className="mt-1 text-2xl font-semibold">
              Your Copilot conversations
            </h2>
          </div>
          <span className="text-xs text-slate-500">Latest 100</span>
        </div>
        <div className="mt-5 space-y-3">
          {workspace.conversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/intelligence/copilot/${conversation.id}`}
              className="block rounded-2xl border border-white/10 bg-slate-950/40 p-4 transition hover:border-purple-400/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white">
                    {conversation.title}
                  </h3>
                  <p className="mt-2 text-xs text-slate-500">
                    Updated {conversation.lastMessageAt.toLocaleString()} ·{" "}
                    {conversation.purgedAt
                      ? 0
                      : Math.floor(conversation._count.messages / 2)} retained turn
                    {(conversation.purgedAt
                      ? 0
                      : Math.floor(conversation._count.messages / 2)) === 1
                      ? ""
                      : "s"}{" "}
                    · expires {conversation.retentionExpiresAt.toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs ${
                    conversation.status ===
                    AiCopilotConversationStatus.ACTIVE
                      ? "bg-emerald-400/10 text-emerald-200"
                      : "bg-slate-400/10 text-slate-300"
                  }`}
                >
                  {pretty(conversation.status)}
                </span>
              </div>
            </Link>
          ))}
          {!workspace.conversations.length ? (
            <p className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
              You have not started a Copilot conversation.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BrainCircuit;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[.04] p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
        </div>
        <Icon className="text-purple-300" />
      </div>
    </div>
  );
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-5 border-b border-white/5 pb-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-200">{value}</dd>
    </div>
  );
}

function pretty(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
