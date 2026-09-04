import { PermissionKey, ResearchSurveyInvitationStatus } from "@prisma/client";
import { ShieldCheck, UserCheck, Users } from "lucide-react";
import Link from "next/link";

import {
  CampaignQuotaForm,
  PanelMemberForm,
  PanelMemberStatusForm,
  QuotaInvitationForm,
  ResearchPanelForm,
} from "@/features/research/research-panel-forms";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  calculatePanelQualityScore,
  isPanelMemberEligible,
  summarizeQuota,
} from "@/modules/research/research-panel-governance";

export const dynamic = "force-dynamic";

export default async function ResearchPanelsPage() {
  await requirePermission(PermissionKey.VIEW_RESEARCH);
  const [{ organizationId }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const canManage = permissions.includes(
    PermissionKey.MANAGE_RESEARCH_DATASETS,
  );
  const [panels, campaigns, quotas] = await Promise.all([
    prisma.researchPanel.findMany({
      where: { organizationId },
      include: {
        createdBy: { select: { name: true } },
        members: {
          include: {
            consentEvents: {
              orderBy: { effectiveAt: "desc" },
              take: 1,
            },
            invitations: {
              select: { status: true, openedAt: true, completedAt: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.researchSurveyCampaign.findMany({
      where: {
        organizationId,
        status: { in: ["ACTIVE", "PAUSED"] },
      },
      select: {
        id: true,
        name: true,
        collection: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.researchCampaignQuota.findMany({
      where: { organizationId },
      include: {
        campaign: {
          select: { name: true, collection: { select: { name: true } } },
        },
        invitations: {
          select: { status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const activeMembers = panels
    .flatMap((panel) => panel.members)
    .filter((item) =>
      isPanelMemberEligible(item.status, item.consentExpiresAt),
    ).length;
  const completedQuotaResponses = quotas.reduce(
    (sum, quota) =>
      sum +
      quota.invitations.filter(
        (item) => item.status === ResearchSurveyInvitationStatus.COMPLETED,
      ).length,
    0,
  );
  const panelOptions = panels
    .filter((panel) => panel.status === "ACTIVE")
    .map((panel) => ({ id: panel.id, name: panel.name }));

  return (
    <div>
      <Link href="/research" className="text-sm text-cyan-300">
        ← Research portfolio
      </Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <Users size={17} />
            Participant governance
          </p>
          <h1 className="mt-2 text-4xl font-bold">Research Panels & Quotas</h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Reuse consented participant cohorts, govern opt-outs, target
            documented segments and stop collection precisely when completion
            quotas are filled.
          </p>
        </div>
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <Metric
          label="Participant panels"
          value={panels.length}
          icon={<Users size={17} />}
        />
        <Metric
          label="Currently eligible"
          value={activeMembers}
          icon={<UserCheck size={17} />}
        />
        <Metric
          label="Quota completions"
          value={completedQuotaResponses}
          icon={<ShieldCheck size={17} />}
        />
      </div>

      {canManage && (
        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <ResearchPanelForm />
          <CampaignQuotaForm
            campaigns={campaigns.map((item) => ({
              id: item.id,
              name: `${item.name} — ${item.collection.name}`,
            }))}
          />
        </div>
      )}

      <section className="mt-8 space-y-4">
        <div>
          <p className="text-sm text-cyan-300">Reusable cohorts</p>
          <h2 className="mt-1 text-2xl font-semibold">
            Participant panel register
          </h2>
        </div>
        {panels.map((panel) => (
          <article
            key={panel.id}
            className="rounded-3xl border border-white/10 bg-white/[.04] p-6"
          >
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">{panel.name}</h3>
                <p className="mt-1 text-sm text-slate-400">
                  {panel.description || "No description"}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {panel.status} · steward {panel.createdBy.name} ·{" "}
                  {panel.members.length} participants
                </p>
              </div>
              <span className="h-fit rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
                Purpose governed
              </span>
            </div>
            <p className="mt-4 rounded-xl border border-white/10 bg-black/10 p-4 text-sm text-slate-300">
              <span className="font-semibold text-white">Lawful purpose:</span>{" "}
              {panel.lawfulPurpose}
            </p>
            {canManage && <PanelMemberForm panelId={panel.id} />}
            <div className="mt-5 space-y-3">
              {panel.members.map((member) => {
                const sent = member.invitations.filter(
                  (item) =>
                    item.status !== "PENDING" && item.status !== "FAILED",
                ).length;
                const quality = calculatePanelQualityScore({
                  sent,
                  opened: member.invitations.filter((item) => item.openedAt)
                    .length,
                  completed: member.invitations.filter(
                    (item) => item.completedAt,
                  ).length,
                  failed: member.invitations.filter(
                    (item) => item.status === "FAILED",
                  ).length,
                });
                const attributes = member.attributes as Record<string, unknown>;
                return (
                  <div
                    key={member.id}
                    className="rounded-2xl border border-white/10 p-4"
                  >
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {member.name || "Unnamed participant"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {member.email} ·{" "}
                          {member.externalRef || "No external reference"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm ${isPanelMemberEligible(member.status, member.consentExpiresAt) ? "text-emerald-300" : "text-amber-300"}`}
                        >
                          {member.status.replaceAll("_", " ")}
                        </p>
                        <p className="text-xs text-slate-500">
                          Quality {quality}/100
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(attributes).map(([key, value]) => (
                        <span
                          key={key}
                          className="rounded-full bg-violet-400/10 px-2.5 py-1 text-xs text-violet-200"
                        >
                          {key}: {String(value)}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      Latest consent: {member.consentEvents[0]?.type ?? "—"} ·
                      expires{" "}
                      {member.consentExpiresAt?.toLocaleDateString() ??
                        "not set"}
                    </p>
                    {canManage && (
                      <PanelMemberStatusForm memberId={member.id} />
                    )}
                  </div>
                );
              })}
              {!panel.members.length && (
                <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
                  No participants enrolled.
                </p>
              )}
            </div>
          </article>
        ))}
        {!panels.length && (
          <p className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
            No participant panels created.
          </p>
        )}
      </section>

      <section className="mt-8 space-y-4">
        <div>
          <p className="text-sm text-violet-300">Controlled representation</p>
          <h2 className="mt-1 text-2xl font-semibold">
            Campaign quota monitor
          </h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {quotas.map((quota) => {
            const completed = quota.invitations.filter(
              (item) => item.status === "COMPLETED",
            ).length;
            const summary = summarizeQuota(quota.target, completed);
            return (
              <article
                key={quota.id}
                className="rounded-2xl border border-white/10 bg-white/[.04] p-5"
              >
                <div className="flex justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">{quota.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {quota.campaign.name} · {quota.campaign.collection.name}
                    </p>
                  </div>
                  <span className="text-sm text-violet-200">
                    {quota.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  Segment:{" "}
                  <strong>
                    {quota.attributeKey} = {quota.attributeValue}
                  </strong>
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-violet-400 to-cyan-300"
                    style={{ width: `${summary.percentage}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {completed}/{quota.target} completed · {summary.remaining}{" "}
                  remaining · {quota.invitations.length} invitations allocated
                </p>
                {canManage && quota.status === "OPEN" && (
                  <QuotaInvitationForm
                    quotaId={quota.id}
                    panels={panelOptions}
                  />
                )}
              </article>
            );
          })}
          {!quotas.length && (
            <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
              No campaign quotas created.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <span className="text-cyan-300">{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
}
