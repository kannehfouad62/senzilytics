import {
  PermissionKey,
  ResearchLongitudinalParticipantStatus,
} from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AttritionForm,
  EnrollPanelButton,
  LongitudinalWaveForm,
  StudyStatusForm,
  WaveInviteButton,
} from "@/features/research/research-longitudinal-forms";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  longitudinalTransitions,
  participantLongitudinalStatus,
  summarizeLongitudinalRetention,
} from "@/modules/research/research-longitudinal";

export const dynamic = "force-dynamic";
export default async function LongitudinalStudyPage({
  params,
}: {
  params: Promise<{ studyId: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_RESEARCH);
  const [{ studyId }, { organizationId }, permissions] = await Promise.all([
    params,
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const canManage = permissions.includes(
    PermissionKey.MANAGE_RESEARCH_DATASETS,
  );
  const study = await prisma.researchLongitudinalStudy.findFirst({
    where: { id: studyId, organizationId },
    include: {
      project: true,
      questionnaire: true,
      panel: true,
      waves: { include: { collection: true }, orderBy: { sequence: "asc" } },
      participants: {
        include: {
          panelMember: {
            include: {
              invitations: {
                where: {
                  campaign: { collection: { longitudinalWave: { studyId } } },
                },
                select: {
                  campaign: { select: { collectionId: true } },
                  completedAt: true,
                },
              },
            },
          },
        },
        orderBy: { enrolledAt: "asc" },
      },
    },
  });
  if (!study) notFound();
  const availableCollections = canManage
    ? await prisma.researchCollectionWave.findMany({
        where: {
          organizationId,
          projectId: study.projectId,
          questionnaireId: study.questionnaireId,
          longitudinalWave: null,
        },
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const completions = new Map(
    study.participants.map((p) => [
      p.id,
      new Set(
        p.panelMember.invitations
          .filter((i) => i.completedAt)
          .map((i) => i.campaign.collectionId),
      ),
    ]),
  );
  const baseline = study.waves[0];
  const current = study.waves.at(-1);
  const baselineCompleted = baseline
    ? [...completions.values()].filter((set) => set.has(baseline.collectionId))
        .length
    : 0;
  const currentCompleted = current
    ? [...completions.values()].filter((set) => set.has(current.collectionId))
        .length
    : 0;
  const retention = summarizeLongitudinalRetention({
    enrolled: study.participants.length,
    completedBaseline: baselineCompleted,
    completedCurrent: currentCompleted,
    withdrawn: study.participants.filter((p) => p.status === "WITHDRAWN")
      .length,
    lost: study.participants.filter((p) => p.status === "LOST_TO_FOLLOW_UP")
      .length,
    targetPercent: study.retentionTargetPercent,
  });
  return (
    <div>
      <Link href="/research/longitudinal" className="text-sm text-cyan-300">
        ← Longitudinal studies
      </Link>
      <div className="mt-5 flex flex-wrap justify-between gap-5">
        <div>
          <p className="text-sm text-cyan-300">
            {study.project.reference} · {study.status}
          </p>
          <h1 className="mt-2 text-4xl font-bold">{study.title}</h1>
          <p className="mt-2 max-w-3xl text-slate-400">{study.purpose}</p>
        </div>
        {canManage && (
          <StudyStatusForm
            studyId={study.id}
            options={longitudinalTransitions[study.status]}
          />
        )}
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-4">
        <Metric label="Cohort" value={study.participants.length} />
        <Metric label="Baseline complete" value={baselineCompleted} />
        <Metric label="Current complete" value={currentCompleted} />
        <Metric
          label="Retention"
          value={`${retention.retentionPercent}%`}
          alert={!retention.meetsTarget}
        />
      </div>
      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[.04] p-6">
        <h2 className="text-xl font-semibold">Governance plan</h2>
        <div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
          <p>
            <span className="text-slate-500">Questionnaire</span>
            <br />
            {study.questionnaire.name}
          </p>
          <p>
            <span className="text-slate-500">Source panel</span>
            <br />
            {study.panel.name}
          </p>
          <p>
            <span className="text-slate-500">Retention target</span>
            <br />
            {study.retentionTargetPercent}%
          </p>
        </div>
        <p className="mt-4 rounded-xl border border-white/10 p-4 text-sm text-slate-300">
          <strong>Recontact statement:</strong> {study.recontactStatement}
        </p>
      </section>
      {canManage && study.status === "DRAFT" && (
        <div className="mt-8 grid gap-5 xl:grid-cols-[1.4fr_.6fr]">
          <LongitudinalWaveForm
            studyId={study.id}
            collections={availableCollections}
          />
          <div className="rounded-2xl border border-white/10 p-5">
            <h3 className="font-semibold">Freeze cohort</h3>
            <p className="mt-2 text-sm text-slate-400">
              Enroll every currently eligible, consented member of{" "}
              {study.panel.name}. Later panel additions are not silently
              enrolled.
            </p>
            <div className="mt-4">
              <EnrollPanelButton studyId={study.id} />
            </div>
          </div>
        </div>
      )}
      <section className="mt-8">
        <h2 className="text-2xl font-semibold">Wave schedule and retention</h2>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {study.waves.map((wave) => {
            const completed = [...completions.values()].filter((set) =>
              set.has(wave.collectionId),
            ).length;
            const rate = study.participants.length
              ? Math.round((completed / study.participants.length) * 100)
              : 0;
            return (
              <article
                key={wave.id}
                className="rounded-2xl border border-white/10 bg-white/[.04] p-5"
              >
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="text-xs text-violet-300">
                      Wave {wave.sequence} · {wave.type.replaceAll("_", " ")}
                    </p>
                    <h3 className="mt-1 font-semibold">{wave.label}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {wave.collection.name} · {wave.collection.status} ·{" "}
                      {wave.scheduledAt?.toLocaleString() ?? "Unscheduled"}
                    </p>
                  </div>
                  {canManage &&
                    study.status === "ACTIVE" &&
                    wave.collection.status === "ACTIVE" && (
                      <WaveInviteButton studyId={study.id} waveId={wave.id} />
                    )}
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-violet-400 to-cyan-300"
                    style={{ width: `${rate}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {completed}/{study.participants.length} completed · {rate}%
                  cohort response
                </p>
              </article>
            );
          })}
        </div>
      </section>
      <section className="mt-8 overflow-x-auto rounded-3xl border border-white/10 bg-white/[.04] p-6">
        <h2 className="text-xl font-semibold">Cross-wave participant matrix</h2>
        <p className="mt-1 text-sm text-slate-400">
          Pseudonymous subject codes preserve linkage without exposing names in
          the comparison grid.
        </p>
        <table className="mt-5 w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="pb-3">Subject</th>
              <th className="pb-3">Status</th>
              {study.waves.map((w) => (
                <th key={w.id} className="pb-3">
                  {w.label}
                </th>
              ))}
              {canManage && <th className="pb-3">Attrition control</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {study.participants.map((p) => {
              const participantStatus = participantLongitudinalStatus(
                p.status,
                study.waves.filter((wave) =>
                  completions.get(p.id)?.has(wave.collectionId),
                ).length,
                study.waves.length,
              );
              return (
                <tr key={p.id}>
                  <td className="py-4 font-medium">{p.subjectCode}</td>
                  <td className="py-4 text-cyan-200">
                    {participantStatus.replaceAll("_", " ")}
                  </td>
                  {study.waves.map((w) => (
                    <td key={w.id} className="py-4">
                      {completions.get(p.id)?.has(w.collectionId) ? (
                        <span className="text-emerald-300">Complete</span>
                      ) : (
                        <span className="text-slate-500">Pending</span>
                      )}
                    </td>
                  ))}
                  {canManage && (
                    <td className="py-4">
                      {participantStatus ===
                      ResearchLongitudinalParticipantStatus.ENROLLED ? (
                        <AttritionForm participantId={p.id} />
                      ) : (
                        <span className="text-xs text-slate-500">
                          {p.attritionReason ?? "Recorded"}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
function Metric({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p
        className={`mt-3 text-3xl font-bold ${alert ? "text-amber-300" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}
