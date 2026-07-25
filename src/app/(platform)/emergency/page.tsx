import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getEmergencyPreparednessDashboardService } from "@/modules/emergency/emergency.service";
import {
  EmergencyActivationStatus,
  EmergencyDrillStatus,
  EmergencyImprovementStatus,
  PermissionKey,
} from "@prisma/client";
import { Activity, CalendarPlus, ClipboardPlus, Plus, Siren } from "lucide-react";
import Link from "next/link";

export default async function EmergencyPreparednessPage() {
  await requirePermission(PermissionKey.VIEW_EMERGENCY_PREPAREDNESS);
  const [{ organizationId }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const dashboard = await getEmergencyPreparednessDashboardService(organizationId);
  const canManage = permissions.includes(PermissionKey.MANAGE_EMERGENCY_PREPAREDNESS);
  const canRecord = permissions.includes(PermissionKey.RECORD_EMERGENCY_RESPONSE);
  const metrics = [
    ["Active plans", dashboard.metrics.activePlans],
    ["Plan reviews overdue", dashboard.metrics.overduePlanReviews],
    ["Open responses", dashboard.metrics.openActivations],
    ["Exercises overdue", dashboard.metrics.overdueDrills],
    ["Drill effectiveness", `${dashboard.metrics.drillEffectiveness}%`],
    ["Open improvements", dashboard.metrics.openImprovements],
  ] as const;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300"><Siren size={17} />Emergency Preparedness & Response 2.0</p>
          <h1 className="mt-2 text-4xl font-bold">Emergency Readiness</h1>
          <p className="mt-2 max-w-3xl text-slate-400">Govern site plans, credible scenarios, contacts, drills, live response records, after-action reviews, and traceable improvements.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {canManage ? <Link href="/emergency/plans/new" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950"><Plus size={17} />New Plan</Link> : null}
          {canManage ? <Link href="/emergency/drills/new" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3"><CalendarPlus size={17} />Schedule Drill</Link> : null}
          {canRecord ? <Link href="/emergency/activations/new" className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-red-100"><Activity size={17} />Record Activation</Link> : null}
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {metrics.map(([label, value]) => <Metric key={label} label={label} value={value} />)}
      </div>

      <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        <div className="flex items-center justify-between border-b border-white/10 p-5"><div><h2 className="text-xl font-semibold">Controlled plans</h2><p className="mt-1 text-sm text-slate-400">Readiness is calculated from approval, review currency, scenarios, contacts, drills, and critical improvements.</p></div><ClipboardPlus className="text-cyan-300" size={20} /></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-white/10 text-slate-400"><tr><th className="p-4">Plan</th><th className="p-4">Site</th><th className="p-4">Status</th><th className="p-4">Review</th><th className="p-4">Readiness</th></tr></thead><tbody>
          {dashboard.plans.map((plan) => <tr key={plan.id} className="border-b border-white/5 hover:bg-white/5"><td className="p-4"><Link href={`/emergency/plans/${plan.id}`} className="font-semibold text-cyan-200 hover:underline">{plan.reference} v{plan.version}</Link><p className="mt-1 text-slate-300">{plan.title}</p></td><td className="p-4 text-slate-300">{plan.site.name}<p className="text-xs text-slate-500">{plan.owner.name}</p></td><td className="p-4">{pretty(plan.status)}</td><td className={`p-4 ${plan.reviewDueAt < new Date() ? "text-red-300" : "text-slate-300"}`}>{plan.reviewDueAt.toLocaleDateString()}</td><td className="p-4"><span className="font-semibold">{plan.readinessScore}%</span></td></tr>)}
          {!dashboard.plans.length ? <tr><td colSpan={5} className="p-10 text-center text-slate-400">No emergency plans have been created.</td></tr> : null}
        </tbody></table></div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">Exercises</h2><div className="mt-4 space-y-3">
          {dashboard.drills.map((drill) => <Link key={drill.id} href={`/emergency/drills/${drill.id}`} className="block rounded-2xl border border-white/10 p-4 hover:bg-white/5"><div className="flex justify-between gap-3"><span className="font-semibold text-cyan-200">{drill.reference}</span><span className={drill.status === EmergencyDrillStatus.PLANNED && drill.scheduledAt < new Date() ? "text-red-300" : "text-slate-400"}>{pretty(drill.status)}</span></div><p className="mt-1 text-sm">{drill.plan.title}</p><p className="mt-2 text-xs text-slate-500">{drill.scheduledAt.toLocaleString()} · {drill.lead.name}</p></Link>)}
          {!dashboard.drills.length ? <p className="text-sm text-slate-400">No planned or recent exercises.</p> : null}
        </div></section>
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">Response activations</h2><div className="mt-4 space-y-3">
          {dashboard.activations.map((activation) => <Link key={activation.id} href={`/emergency/activations/${activation.id}`} className="block rounded-2xl border border-white/10 p-4 hover:bg-white/5"><div className="flex justify-between gap-3"><span className="font-semibold text-cyan-200">{activation.reference}</span><span className={activation.status === EmergencyActivationStatus.ACTIVE ? "text-red-300" : "text-slate-400"}>{pretty(activation.status)}</span></div><p className="mt-1 text-sm">{activation.plan.title}</p><p className="mt-2 text-xs text-slate-500">{activation.declaredAt.toLocaleString()} · {activation.incidentCommander.name}</p></Link>)}
          {!dashboard.activations.length ? <p className="text-sm text-slate-400">No open or recent response activations.</p> : null}
        </div></section>
      </div>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">After-action improvements</h2><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {dashboard.improvements.map((item) => <article key={item.id} className="rounded-2xl border border-white/10 p-4"><div className="flex justify-between gap-3"><span className="font-semibold">{item.title}</span><span className={item.status === EmergencyImprovementStatus.COMPLETED ? "text-amber-300" : "text-slate-400"}>{pretty(item.status)}</span></div><p className="mt-2 text-sm text-slate-400">{item.plan.title}</p><p className={`mt-2 text-xs ${item.dueAt < new Date() ? "text-red-300" : "text-slate-500"}`}>Due {item.dueAt.toLocaleDateString()} · {item.owner.name}</p>{item.correctiveAction ? <Link href={`/actions/${item.correctiveAction.id}`} className="mt-2 inline-block text-xs text-cyan-300">View linked CAPA</Link> : null}</article>)}
        {!dashboard.improvements.length ? <p className="text-sm text-slate-400">No open after-action improvements.</p> : null}
      </div></section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>;
}
function pretty(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
