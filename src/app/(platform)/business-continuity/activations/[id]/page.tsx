import {
  ContinuityActivationLifecycleForm,
  ContinuityImprovementCapaForm,
  ContinuityImprovementForm,
  ContinuityImprovementLifecycleForm,
  ContinuitySituationForm,
} from "@/features/continuity/continuity-forms";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  ContinuityActivationStatus,
  ContinuityImprovementStatus,
  PermissionKey,
} from "@prisma/client";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ContinuityActivationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PermissionKey.VIEW_BUSINESS_CONTINUITY);
  const [{ id }, { organizationId }, permissions] = await Promise.all([params, getCurrentUserTenant(), getCurrentUserPermissions()]);
  const canManage = permissions.includes(PermissionKey.MANAGE_BUSINESS_CONTINUITY);
  const canRecord = permissions.includes(PermissionKey.RECORD_CONTINUITY_EVENT);
  const canCapa = permissions.includes(PermissionKey.CREATE_CAPA);
  const [activation, users] = await Promise.all([
    prisma.continuityActivation.findFirst({ where: { id, organizationId }, include: { plan: true, emergencyActivation: true, declaredBy: true, coordinator: true, restoredBy: true, closedBy: true, improvements: { include: { owner: true, correctiveAction: true }, orderBy: { dueAt: "asc" } } } }),
    prisma.user.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!activation) notFound();
  const improvements = activation.improvements.filter((item) => item.status !== ContinuityImprovementStatus.VERIFIED && item.status !== ContinuityImprovementStatus.CANCELLED);
  const operational = activation.status === ContinuityActivationStatus.ACTIVE || activation.status === ContinuityActivationStatus.RECOVERING;
  return <div>
    <Link href="/business-continuity" className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16} />Back to Business Resilience</Link>
    <div className="mt-6 flex flex-wrap justify-between gap-5"><div><p className="text-sm text-cyan-300">{activation.reference} · {pretty(activation.category)} · {pretty(activation.severity)}</p><h1 className="mt-2 text-4xl font-bold">{activation.title}</h1><Link href={`/business-continuity/plans/${activation.planId}`} className="mt-2 inline-block text-slate-400 hover:text-cyan-300">{activation.plan.title}</Link></div><span className={`rounded-full border px-4 py-2 text-sm ${operational ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-white/10"}`}>{pretty(activation.status)}</span></div>
    <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Declared" value={activation.declaredAt.toLocaleString()} /><Metric label="Coordinator" value={activation.coordinator.name} /><Metric label="Expected recovery" value={activation.expectedRecoveryAt.toLocaleString()} danger={operational && activation.expectedRecoveryAt < new Date()} /><Metric label="Downtime" value={`${activation.actualDowntimeHours ?? activation.estimatedDowntimeHours ?? "—"} hours`} /><Metric label="After action due" value={activation.afterActionDueAt.toLocaleDateString()} danger={activation.status === ContinuityActivationStatus.RESTORED && activation.afterActionDueAt < new Date()} /></div>
    {activation.emergencyActivation ? <Link href={`/emergency/activations/${activation.emergencyActivation.id}`} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-cyan-300"><ExternalLink size={16} />Linked emergency record {activation.emergencyActivation.reference}</Link> : null}
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">Recovery situation</h2><div className="grid gap-5 md:grid-cols-2"><Detail label="Disruption summary" value={activation.disruptionSummary} /><Detail label="Impacted processes" value={activation.impactedProcesses} /><Detail label="Activation rationale" value={activation.activationRationale} /><Detail label="Recovery actions" value={activation.recoveryActions} /><Detail label="Stakeholder communication" value={activation.stakeholderCommunication} /><Detail label="Workaround status" value={activation.workaroundStatus} /><Detail label="Restoration evidence" value={activation.restorationEvidence} /><Detail label="Closure summary" value={activation.closureSummary} /><Detail label="Lessons learned" value={activation.lessonsLearned} /></div></section>
    {canRecord && operational ? <div className="mt-8"><ContinuitySituationForm activation={{ id: activation.id, disruptionSummary: activation.disruptionSummary, impactedProcesses: activation.impactedProcesses, recoveryActions: activation.recoveryActions, stakeholderCommunication: activation.stakeholderCommunication, workaroundStatus: activation.workaroundStatus, expectedRecoveryAt: localInput(activation.expectedRecoveryAt), estimatedDowntimeHours: activation.estimatedDowntimeHours }} /></div> : null}
    {canRecord ? <div className="mt-8"><ContinuityActivationLifecycleForm activationId={activation.id} status={activation.status} /></div> : null}
    <section className="mt-8"><h2 className="text-2xl font-semibold">Recovery improvements</h2><div className="mt-4 space-y-4">{improvements.map((item) => <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-6"><div className="flex justify-between gap-3"><div><p className="text-sm text-amber-300">{pretty(item.priority)} · {pretty(item.status)}</p><h3 className="mt-1 font-semibold">{item.title}</h3></div><span className={item.dueAt < new Date() ? "text-red-300" : "text-slate-400"}>Due {item.dueAt.toLocaleDateString()}</span></div><p className="mt-3 text-sm text-slate-300">{item.description}</p><div className="mt-4 grid gap-4 xl:grid-cols-2">{canRecord ? <ContinuityImprovementLifecycleForm improvement={item} canManage={canManage} /> : null}{canManage && canCapa && !item.correctiveAction ? <ContinuityImprovementCapaForm improvement={item} users={users} /> : item.correctiveAction ? <Link href={`/actions/${item.correctiveAction.id}`} className="text-sm text-cyan-300">View linked CAPA</Link> : null}</div></article>)}{!improvements.length ? <p className="rounded-2xl border border-white/10 p-5 text-sm text-slate-400">No open recovery improvements.</p> : null}</div>{canRecord ? <ContinuityImprovementForm planId={activation.planId} activationId={activation.id} users={users} /> : null}</section>
  </div>;
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) { return <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 font-semibold ${danger ? "text-red-300" : ""}`}>{value}</p></div>; }
function Detail({ label, value }: { label: string; value?: string | null }) { return <div className="mt-4"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-200">{value || "Not recorded"}</p></div>; }
function localInput(value: Date) { const offset = value.getTimezoneOffset() * 60_000; return new Date(value.getTime() - offset).toISOString().slice(0, 16); }
function pretty(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
