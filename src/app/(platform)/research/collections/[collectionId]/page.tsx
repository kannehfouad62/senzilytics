import { PermissionKey } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CollectionStatusForm,
  RespondentAssignmentForm,
} from "@/features/research/collection-forms";
import {
  PublicSurveyLinkCard,
  PublicSurveyLinkForm,
} from "@/features/research/public-survey-forms";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getResearchCollection } from "@/modules/research/research-collection.service";

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
        <Metric
          label="Progress"
          value={progress}
        />
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

      {canManage && (
        <section className="mt-8 space-y-5">
          <PublicSurveyLinkForm collectionId={collection.id} />
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
