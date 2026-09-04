import { PermissionKey } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CollectionStatusForm,
  CollectionLocationPolicyForm,
  RespondentAssignmentForm,
} from "@/features/research/collection-forms";
import {
  PublicSurveyLinkCard,
  PublicSurveyLinkForm,
} from "@/features/research/public-survey-forms";
import { QuestionnaireLocalizationWorkspace } from "@/features/research/questionnaire-localization-forms";
import {
  CampaignReminderButton,
  CampaignStatusButton,
  SurveyCampaignForm,
} from "@/features/research/survey-campaign-forms";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getResearchCollection } from "@/modules/research/research-collection.service";
import { researchFieldTranslations } from "@/modules/research/research-localization";

export default async function ResearchCollectionPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_RESEARCH);
  const [{ collectionId }, { organizationId }, permissions] = await Promise.all(
    [params, getCurrentUserTenant(), getCurrentUserPermissions()],
  );
  const canManage = permissions.includes(
    PermissionKey.MANAGE_RESEARCH_DATASETS,
  );
  const canDesign = permissions.includes(
    PermissionKey.DESIGN_RESEARCH_QUESTIONNAIRES,
  );
  const canPublish = permissions.includes(
    PermissionKey.PUBLISH_RESEARCH_QUESTIONNAIRES,
  );
  const [collection, users] = await Promise.all([
    getResearchCollection(organizationId, collectionId),
    canManage
      ? prisma.user.findMany({
          where: { organizationId, isActive: true },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        })
      : [],
  ]);
  if (!collection) notFound();
  const assignedCompleted = collection.assignments.filter(
    (item) => item.status === "COMPLETED",
  ).length;
  const publicCompleted = collection.publicResponses.length;
  const completed = assignedCompleted + publicCompleted;
  const progress = collection.targetResponseCount
    ? `${Math.min(100, Math.round((completed / collection.targetResponseCount) * 100))}%`
    : "—";

  return (
    <div>
      <Link
        href={`/research/projects/${collection.projectId}/questionnaires/${collection.questionnaireId}/collections`}
        className="text-sm text-cyan-300"
      >
        ← Collection waves
      </Link>
      <div className="mt-5 flex flex-wrap justify-between gap-5">
        <div>
          <p className="text-sm text-cyan-300">
            {collection.project.reference} · {collection.questionnaire.name}
          </p>
          <h1 className="mt-2 text-4xl font-bold">{collection.name}</h1>
          <p className="mt-2 text-slate-400">
            Published version {collection.formVersion.version} ·{" "}
            {collection.status}
          </p>
        </div>
        {canManage && (
          <CollectionStatusForm
            collectionId={collection.id}
            status={collection.status}
          />
        )}
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-5">
        <Metric label="Assigned" value={collection.assignments.length} />
        <Metric label="Assigned responses" value={assignedCompleted} />
        <Metric label="Public responses" value={publicCompleted} />
        <Metric label="Progress" value={progress} />
        <Metric label="Target" value={collection.targetResponseCount ?? "—"} />
      </div>

      {canManage && (
        <div className="mt-8 grid gap-6 xl:grid-cols-[.7fr_1.3fr]">
          <RespondentAssignmentForm
            collectionId={collection.id}
            users={users}
          />
          <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
            <h2 className="text-xl font-semibold">Dataset controls</h2>
            <p className="mt-2 text-sm text-slate-400">
              Export assigned and public responses as one governed dataset with
              stable variable keys from the locked questionnaire version.
            </p>
            <a
              href={`/api/research/collections/${collection.id}/export`}
              className="mt-5 inline-block rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-200"
            >
              Export CSV for Excel
            </a>
          </section>
        </div>
      )}
      {canManage && <div className="mt-8"><CollectionLocationPolicyForm collection={{ id: collection.id, locationCapturePolicy: collection.locationCapturePolicy, maximumLocationAccuracyM: collection.maximumLocationAccuracyM, retainPreciseLocation: collection.retainPreciseLocation }} /></div>}

      {canManage && (
        <section className="mt-8 space-y-5">
          <PublicSurveyLinkForm
            collectionId={collection.id}
            fields={collection.formVersion.fields
              .filter((field) => field.fieldType !== "FILE")
              .map((field) => ({ id: field.id, label: field.label }))}
          />
          <div>
            <div className="mb-4">
              <p className="text-sm text-cyan-300">External collection</p>
              <h2 className="mt-1 text-2xl font-semibold">
                Public survey links
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Every visit can submit an independent response while the link
                and collection wave remain active.
              </p>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {collection.publicLinks.map((link) => (
                <PublicSurveyLinkCard
                  key={link.id}
                  link={{
                    id: link.id,
                    token: link.token,
                    label: link.label,
                    status: link.status,
                    maxResponses: link.maxResponses,
                    expiresAt: link.expiresAt,
                    responseCount: link._count.responses,
                    createdBy: link.createdBy.name,
                  }}
                />
              ))}
              {!collection.publicLinks.length && (
                <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                  No public survey links created.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      <QuestionnaireLocalizationWorkspace
        collectionId={collection.id}
        defaultLanguage={collection.questionnaire.defaultLanguage}
        base={{
          questionnaireName: collection.questionnaire.name,
          purpose: collection.questionnaire.purpose,
          consentStatement: collection.questionnaire.consentStatement,
          instructions: collection.instructions,
        }}
        fields={collection.formVersion.fields.map((field) => ({
          id: field.id,
          label: field.label,
          description: field.description,
          placeholder: field.placeholder,
          options: Array.isArray(field.options)
            ? field.options.filter(
                (item): item is string => typeof item === "string",
              )
            : [],
        }))}
        localizations={collection.formVersion.researchQuestionnaireLocalizations.map(
          (localization) => ({
            id: localization.id,
            locale: localization.locale,
            languageName: localization.languageName,
            status: localization.status,
            questionnaireName: localization.questionnaireName,
            purpose: localization.purpose,
            consentStatement: localization.consentStatement,
            instructions: localization.instructions,
            fields: researchFieldTranslations(localization.fieldTranslations),
          }),
        )}
        canDesign={canDesign}
        canPublish={canPublish}
      />

      {canManage && (
        <section className="mt-8 space-y-5">
          <SurveyCampaignForm
            collectionId={collection.id}
            links={collection.publicLinks
              .filter((link) => link.status === "ACTIVE")
              .map((link) => ({ id: link.id, label: link.label }))}
          />
          <div>
            <p className="text-sm text-violet-300">Distribution intelligence</p>
            <h2 className="mt-1 text-2xl font-semibold">
              Invitation campaigns
            </h2>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {collection.surveyCampaigns.map((campaign) => {
              const sent = campaign.invitations.filter(
                  (item) =>
                    item.status !== "PENDING" && item.status !== "FAILED",
                ).length,
                opened = campaign.invitations.filter(
                  (item) => item.openedAt,
                ).length,
                completed = campaign.invitations.filter(
                  (item) => item.completedAt,
                ).length,
                total = campaign._count.invitations,
                completionDurations = campaign.invitations
                  .filter((item) => item.openedAt && item.completedAt)
                  .map((item) =>
                    Math.max(
                      0,
                      item.completedAt!.getTime() - item.openedAt!.getTime(),
                    ),
                  ),
                averageMinutes = completionDurations.length
                  ? Math.round(
                      completionDurations.reduce((sum, item) => sum + item, 0) /
                        completionDurations.length /
                        60_000,
                    )
                  : null;
              return (
                <article
                  key={campaign.id}
                  className="rounded-2xl border border-white/10 bg-white/[.04] p-5"
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">{campaign.name}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {campaign.status} · {campaign.channel} · reminder limit{" "}
                        {campaign.reminderLimit}
                      </p>
                    </div>
                    {campaign.status === "ACTIVE" && (
                      <div className="flex gap-2">
                        <CampaignReminderButton campaignId={campaign.id} />
                        <CampaignStatusButton
                          campaignId={campaign.id}
                          status="PAUSED"
                          label="Pause"
                        />
                        <CampaignStatusButton
                          campaignId={campaign.id}
                          status="CLOSED"
                          label="Close"
                        />
                      </div>
                    )}
                    {campaign.status === "PAUSED" && (
                      <CampaignStatusButton
                        campaignId={campaign.id}
                        status="ACTIVE"
                        label="Resume"
                      />
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    <Metric label="Invited" value={total} />
                    <Metric label="Sent" value={sent} />
                    <Metric label="Opened" value={opened} />
                    <Metric label="Completed" value={completed} />
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-violet-400 to-cyan-300"
                      style={{
                        width: `${total ? Math.round((completed / total) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Completion funnel{" "}
                    {total ? Math.round((completed / total) * 100) : 0}% · Open
                    rate {sent ? Math.round((opened / sent) * 100) : 0}% ·{" "}
                    Average completion {averageMinutes ?? "—"} min ·{" "}
                    {campaign.invitations.reduce(
                      (sum, item) => sum + item.remindersSent,
                      0,
                    )}{" "}
                    reminders sent
                  </p>
                </article>
              );
            })}
            {!collection.surveyCampaigns.length && (
              <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                No invitation campaigns launched.
              </p>
            )}
          </div>
        </section>
      )}

      <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[.04]">
        <h2 className="border-b border-white/10 p-5 text-xl font-semibold">
          Assignment register
        </h2>
        {collection.assignments.map((item) => (
          <div
            key={item.id}
            className="grid gap-2 border-b border-white/5 p-5 md:grid-cols-[1fr_.5fr_.5fr]"
          >
            <div>
              <p className="font-medium">{item.respondent.name}</p>
              <p className="text-xs text-slate-500">{item.respondent.email}</p>
            </div>
            <p className="text-sm text-cyan-200">
              {item.status.replaceAll("_", " ")}
            </p>
            <p className="text-sm text-slate-400">
              {item.completedAt?.toLocaleString() ??
                (item.dueAt
                  ? `Due ${item.dueAt.toLocaleString()}`
                  : "No due date")}
            </p>
          </div>
        ))}
        {!collection.assignments.length && (
          <p className="p-8 text-center text-sm text-slate-500">
            No tenant respondents assigned. Public links can be used
            independently.
          </p>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
