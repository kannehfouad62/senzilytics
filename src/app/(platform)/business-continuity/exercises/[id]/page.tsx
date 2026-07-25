import {
  ContinuityExerciseLifecycleForm,
  ContinuityImprovementCapaForm,
  ContinuityImprovementForm,
  ContinuityImprovementLifecycleForm,
} from "@/features/continuity/continuity-forms";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { ContinuityImprovementStatus, PermissionKey } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ContinuityExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PermissionKey.VIEW_BUSINESS_CONTINUITY);
  const [{ id }, { organizationId }, permissions] = await Promise.all([params, getCurrentUserTenant(), getCurrentUserPermissions()]);
  const canManage = permissions.includes(PermissionKey.MANAGE_BUSINESS_CONTINUITY);
  const canRecord = permissions.includes(PermissionKey.RECORD_CONTINUITY_EVENT);
  const canCapa = permissions.includes(PermissionKey.CREATE_CAPA);
  const [exercise, users] = await Promise.all([
    prisma.continuityExercise.findFirst({ where: { id, organizationId }, include: { plan: true, analysis: true, lead: true, createdBy: true, reviewedBy: true, improvements: { include: { owner: true, correctiveAction: true }, orderBy: { dueAt: "asc" } } } }),
    prisma.user.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!exercise) notFound();
  const improvements = exercise.improvements.filter((item) => item.status !== ContinuityImprovementStatus.VERIFIED && item.status !== ContinuityImprovementStatus.CANCELLED);
  return <div>
    <Link href="/business-continuity" className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16} />Back to Business Resilience</Link>
    <div className="mt-6 flex flex-wrap justify-between gap-5"><div><p className="text-sm text-cyan-300">{exercise.reference} · {pretty(exercise.type)}</p><h1 className="mt-2 text-4xl font-bold">Continuity Exercise</h1><Link href={`/business-continuity/plans/${exercise.planId}`} className="mt-2 inline-block text-slate-400 hover:text-cyan-300">{exercise.plan.title}</Link></div><span className="rounded-full border border-white/10 px-4 py-2 text-sm">{pretty(exercise.status)}</span></div>
    <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Scheduled" value={exercise.scheduledAt.toLocaleString()} /><Metric label="Lead" value={exercise.lead.name} /><Metric label="Participants" value={`${exercise.actualParticipants ?? 0} / ${exercise.expectedParticipants}`} /><Metric label="Result" value={exercise.result ? pretty(exercise.result) : "Pending"} /><Metric label="BIA focus" value={exercise.analysis?.processName ?? "Plan-wide"} /></div>
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">Exercise record</h2><Detail label="Objectives" value={exercise.objectives} /><Detail label="Scenario" value={exercise.scenario} /><div className="mt-5 grid gap-4 md:grid-cols-2"><Metric label="Recovery time" value={objective(exercise.actualRecoveryTimeHours, exercise.targetRecoveryTimeHours)} /><Metric label="Recovery point" value={objective(exercise.actualRecoveryPointHours, exercise.targetRecoveryPointHours)} /></div><Detail label="Strengths" value={exercise.strengths} /><Detail label="Gaps" value={exercise.gaps} /><Detail label="After-action summary" value={exercise.afterActionSummary} /></section>
    {canManage ? <div className="mt-8"><ContinuityExerciseLifecycleForm exerciseId={exercise.id} status={exercise.status} /></div> : null}
    <section className="mt-8"><h2 className="text-2xl font-semibold">After-action improvements</h2><div className="mt-4 space-y-4">{improvements.map((item) => <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-6"><div className="flex justify-between gap-3"><div><p className="text-sm text-amber-300">{pretty(item.priority)} · {pretty(item.status)}</p><h3 className="mt-1 font-semibold">{item.title}</h3></div><span className={item.dueAt < new Date() ? "text-red-300" : "text-slate-400"}>Due {item.dueAt.toLocaleDateString()}</span></div><p className="mt-3 text-sm text-slate-300">{item.description}</p><div className="mt-4 grid gap-4 xl:grid-cols-2">{canRecord ? <ContinuityImprovementLifecycleForm improvement={item} canManage={canManage} /> : null}{canManage && canCapa && !item.correctiveAction ? <ContinuityImprovementCapaForm improvement={item} users={users} /> : item.correctiveAction ? <Link href={`/actions/${item.correctiveAction.id}`} className="text-sm text-cyan-300">View linked CAPA</Link> : null}</div></article>)}{!improvements.length ? <p className="rounded-2xl border border-white/10 p-5 text-sm text-slate-400">No open improvements.</p> : null}</div>{canRecord ? <ContinuityImprovementForm planId={exercise.planId} exerciseId={exercise.id} users={users} /> : null}</section>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold">{value}</p></div>; }
function Detail({ label, value }: { label: string; value?: string | null }) { return <div className="mt-4"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-200">{value || "Not recorded"}</p></div>; }
function objective(actual: number | null, target: number | null) { return `${actual ?? "—"} actual / ${target ?? "—"} target hours`; }
function pretty(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
