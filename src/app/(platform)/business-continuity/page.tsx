import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getBusinessContinuityDashboardService } from "@/modules/continuity/continuity.service";
import {
  ContinuityActivationStatus,
  ContinuityExerciseStatus,
  ContinuityImprovementStatus,
  PermissionKey,
} from "@prisma/client";
import { Activity, CalendarPlus, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";

export default async function BusinessContinuityPage() {
  await requirePermission(PermissionKey.VIEW_BUSINESS_CONTINUITY);
  const [{ organizationId }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const dashboard = await getBusinessContinuityDashboardService(organizationId);
  const canManage = permissions.includes(PermissionKey.MANAGE_BUSINESS_CONTINUITY);
  const canRecord = permissions.includes(PermissionKey.RECORD_CONTINUITY_EVENT);
  const metrics = [
    ["Active plans", dashboard.metrics.activePlans],
    ["Overdue reviews", dashboard.metrics.overduePlanReviews],
    ["Critical processes", dashboard.metrics.criticalProcesses],
    ["Open disruptions", dashboard.metrics.openActivations],
    ["Exercise effectiveness", `${dashboard.metrics.exerciseEffectiveness}%`],
    ["Overdue improvements", dashboard.metrics.overdueImprovements],
  ] as const;
  return <div>
    <div className="flex flex-wrap items-end justify-between gap-4"><div>
      <p className="flex items-center gap-2 text-sm text-cyan-300"><RefreshCw size={17} />Business Continuity Management 2.0</p>
      <h1 className="mt-2 text-4xl font-bold">Business Resilience</h1>
      <p className="mt-2 max-w-3xl text-slate-400">Govern continuity plans, business-impact analyses, recovery objectives, dependencies, exercises, disruption activations, restoration evidence, and traceable improvements.</p>
    </div><div className="flex flex-wrap gap-3">
      {canManage ? <Link href="/business-continuity/plans/new" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950"><Plus size={17} />New Plan</Link> : null}
      {canManage ? <Link href="/business-continuity/exercises/new" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3"><CalendarPlus size={17} />Schedule Exercise</Link> : null}
      {canRecord ? <Link href="/business-continuity/activations/new" className="inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-amber-100"><Activity size={17} />Record Disruption</Link> : null}
    </div></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{metrics.map(([label, value]) => <Metric key={label} label={label} value={value} />)}</div>
    <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
      <div className="border-b border-white/10 p-5"><h2 className="text-xl font-semibold">Controlled continuity plans</h2><p className="mt-1 text-sm text-slate-400">Readiness reflects approval, review currency, BIA quality, dependencies, testing and overdue critical improvements.</p></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-white/10 text-slate-400"><tr><th className="p-4">Plan</th><th className="p-4">Scope</th><th className="p-4">Status</th><th className="p-4">BIA</th><th className="p-4">Readiness</th></tr></thead><tbody>
        {dashboard.plans.map((plan) => <tr key={plan.id} className="border-b border-white/5 hover:bg-white/5"><td className="p-4"><Link href={`/business-continuity/plans/${plan.id}`} className="font-semibold text-cyan-200 hover:underline">{plan.reference} v{plan.version}</Link><p className="mt-1 text-slate-300">{plan.title}</p></td><td className="p-4 text-slate-300">{plan.site?.name ?? "Organization"}<p className="text-xs text-slate-500">{plan.department?.name ?? plan.owner.name}</p></td><td className="p-4">{pretty(plan.status)}</td><td className="p-4">{plan.businessImpactAnalyses.length}</td><td className="p-4 font-semibold">{plan.readinessScore}%</td></tr>)}
        {!dashboard.plans.length ? <tr><td colSpan={5} className="p-10 text-center text-slate-400">No business continuity plans have been created.</td></tr> : null}
      </tbody></table></div>
    </section>
    <div className="mt-8 grid gap-6 xl:grid-cols-2">
      <List title="Exercises">{dashboard.exercises.map((exercise) => <Link key={exercise.id} href={`/business-continuity/exercises/${exercise.id}`} className="block rounded-2xl border border-white/10 p-4 hover:bg-white/5"><div className="flex justify-between gap-3"><span className="font-semibold text-cyan-200">{exercise.reference}</span><span className={exercise.status === ContinuityExerciseStatus.PLANNED && exercise.scheduledAt < new Date() ? "text-red-300" : "text-slate-400"}>{pretty(exercise.status)}</span></div><p className="mt-1 text-sm">{exercise.plan.title}</p><p className="mt-2 text-xs text-slate-500">{exercise.scheduledAt.toLocaleString()} · {exercise.lead.name}</p></Link>)}</List>
      <List title="Disruption activations">{dashboard.activations.map((activation) => <Link key={activation.id} href={`/business-continuity/activations/${activation.id}`} className="block rounded-2xl border border-white/10 p-4 hover:bg-white/5"><div className="flex justify-between gap-3"><span className="font-semibold text-cyan-200">{activation.reference}</span><span className={activation.status === ContinuityActivationStatus.ACTIVE ? "text-red-300" : "text-slate-400"}>{pretty(activation.status)}</span></div><p className="mt-1 text-sm">{activation.title}</p><p className="mt-2 text-xs text-slate-500">{activation.declaredAt.toLocaleString()} · {activation.coordinator.name}</p></Link>)}</List>
    </div>
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">Recovery improvements</h2><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {dashboard.improvements.map((item) => <article key={item.id} className="rounded-2xl border border-white/10 p-4"><div className="flex justify-between gap-3"><span className="font-semibold">{item.title}</span><span className={item.status === ContinuityImprovementStatus.COMPLETED ? "text-amber-300" : "text-slate-400"}>{pretty(item.status)}</span></div><p className="mt-2 text-sm text-slate-400">{item.plan.title}</p><p className={`mt-2 text-xs ${item.dueAt < new Date() ? "text-red-300" : "text-slate-500"}`}>Due {item.dueAt.toLocaleDateString()} · {item.owner.name}</p>{item.correctiveAction ? <Link href={`/actions/${item.correctiveAction.id}`} className="mt-2 inline-block text-xs text-cyan-300">View linked CAPA</Link> : null}</article>)}
      {!dashboard.improvements.length ? <p className="text-sm text-slate-400">No open recovery improvements.</p> : null}
    </div></section>
  </div>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>; }
function List({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">{title}</h2><div className="mt-4 space-y-3">{children}</div></section>; }
function pretty(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
