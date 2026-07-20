import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getOperationalAssuranceOverview } from "@/modules/assurance/operational-assurance.service";
import { PermissionKey } from "@prisma/client";
import { AlertTriangle, GitBranch, Network, ShieldCheck } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OperationalAssurancePage(){
  await requirePermission(PermissionKey.VIEW_DASHBOARD);
  const[{organizationId},permissions]=await Promise.all([getCurrentUserTenant(),getCurrentUserPermissions()]);
  const overview=await getOperationalAssuranceOverview({organizationId,permissions});
  return <div><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm text-cyan-300"><Network size={17}/>Connected Risk Intelligence</p><h1 className="mt-2 text-4xl font-bold">Operational Assurance</h1><p className="mt-2 max-w-3xl text-slate-400">See how warning signals, events, findings, actions, risks and operational changes connect across your organization.</p></div><p className="text-sm text-slate-500">Updated {overview.generatedAt.toLocaleString()}</p></div>
    <div className="mt-8 grid gap-4 md:grid-cols-3"><Metric icon={AlertTriangle} label="Open elevated signals" value={overview.signalCount}/><Metric icon={ShieldCheck} label="Critical signals" value={overview.criticalCount}/><Metric icon={GitBranch} label="Recorded connections" value={overview.connectionCount}/></div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_.65fr]"><section className="rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">Priority signals</h2><p className="mt-1 text-sm text-slate-400">Evidence-based attention items from modules you are permitted to view.</p><div className="mt-5 space-y-3">{overview.signals.map(signal=><Link key={signal.id} href={signal.href} className="block rounded-2xl border border-white/10 bg-slate-950/50 p-4 transition hover:border-cyan-400/30"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">{signal.source}{signal.site?` · ${signal.site}`:""}</p><p className="mt-1 font-medium text-white">{signal.title}</p><p className="mt-1 text-sm text-slate-400">{signal.detail}</p></div><span className={`rounded-full px-3 py-1 text-xs ${signal.severity==="CRITICAL"?"bg-red-400/15 text-red-300":signal.severity==="HIGH"?"bg-amber-400/15 text-amber-300":"bg-cyan-400/15 text-cyan-300"}`}>{signal.severity}</span></div></Link>)}{!overview.signals.length&&<p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-500">No elevated connected-risk signals are currently visible to your role.</p>}</div></section>
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">Relationship coverage</h2><p className="mt-1 text-sm text-slate-400">Existing traceable links between source records.</p><div className="mt-5 space-y-3">{overview.connections.map(row=><Link key={row.label} href={row.href} className="block rounded-2xl border border-white/10 bg-slate-950/50 p-4 hover:border-cyan-400/30"><div className="flex items-center justify-between gap-3"><p className="font-medium">{row.label}</p><strong className="text-2xl text-cyan-300">{row.count}</strong></div><p className="mt-1 text-xs text-slate-500">{row.detail}</p></Link>)}</div></section></div>
  </div>;
}

function Metric({icon:Icon,label,value}:{icon:typeof AlertTriangle;label:string;value:number}){return <div className="rounded-3xl border border-white/10 bg-white/5 p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div><Icon className="text-cyan-300"/></div></div>}
