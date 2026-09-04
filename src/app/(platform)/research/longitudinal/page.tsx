import { PermissionKey } from "@prisma/client";
import { Activity, ArrowRight, Repeat2, Users } from "lucide-react";
import Link from "next/link";
import { LongitudinalStudyForm } from "@/features/research/research-longitudinal-forms";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export default async function LongitudinalStudiesPage() {
  await requirePermission(PermissionKey.VIEW_RESEARCH);
  const [{ organizationId }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const canManage = permissions.includes(
    PermissionKey.MANAGE_RESEARCH_DATASETS,
  );
  const [studies, projects, panels] = await Promise.all([
    prisma.researchLongitudinalStudy.findMany({
      where: { organizationId },
      include: {
        project: { select: { reference: true } },
        _count: { select: { waves: true, participants: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    canManage
      ? prisma.researchProject.findMany({
          where: {
            organizationId,
            status: { notIn: ["CANCELLED", "ARCHIVED"] },
          },
          select: {
            id: true,
            title: true,
            questionnaires: {
              where: { isActive: true },
              select: { id: true, name: true },
            },
          },
          orderBy: { title: "asc" },
        })
      : [],
    canManage
      ? prisma.researchPanel.findMany({
          where: { organizationId, status: "ACTIVE" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [],
  ]);
  return (
    <div>
      <Link href="/research" className="text-sm text-cyan-300">
        ← Research portfolio
      </Link>
      <div className="mt-5">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <Repeat2 size={17} />
          Repeated-measures governance
        </p>
        <h1 className="mt-2 text-4xl font-bold">Longitudinal Studies</h1>
        <p className="mt-2 max-w-3xl text-slate-400">
          Coordinate baseline, midline, endline and follow-up waves against one
          consented cohort with transparent retention and attrition evidence.
        </p>
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <Metric
          label="Studies"
          value={studies.length}
          icon={<Repeat2 size={17} />}
        />
        <Metric
          label="Tracked participants"
          value={studies.reduce((s, i) => s + i._count.participants, 0)}
          icon={<Users size={17} />}
        />
        <Metric
          label="Linked waves"
          value={studies.reduce((s, i) => s + i._count.waves, 0)}
          icon={<Activity size={17} />}
        />
      </div>
      {canManage && (
        <div className="mt-8">
          <LongitudinalStudyForm projects={projects} panels={panels} />
        </div>
      )}
      <section className="mt-8 grid gap-4 xl:grid-cols-2">
        {studies.map((study) => (
          <Link
            key={study.id}
            href={`/research/longitudinal/${study.id}`}
            className="rounded-2xl border border-white/10 bg-white/[.04] p-5 transition hover:border-cyan-400/30"
          >
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-xs text-cyan-300">
                  {study.project.reference} · {study.status}
                </p>
                <h2 className="mt-2 text-xl font-semibold">{study.title}</h2>
              </div>
              <ArrowRight size={18} />
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-slate-400">
              {study.purpose}
            </p>
            <p className="mt-4 text-xs text-slate-500">
              {study._count.participants} participants · {study._count.waves}/
              {study.plannedWaveCount} waves · target{" "}
              {study.retentionTargetPercent}% retention
            </p>
          </Link>
        ))}
        {!studies.length && (
          <p className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
            No longitudinal studies created.
          </p>
        )}
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
      <div className="flex justify-between text-cyan-300">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {label}
        </p>
        {icon}
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
}
