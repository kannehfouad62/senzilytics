import Link from "next/link";
import { Building2, FolderOpen } from "lucide-react";
import { getCurrentUserTenant } from "@/lib/tenant";
import { listClientPortalProjects } from "@/modules/research/research-client-portal.service";

export const dynamic = "force-dynamic";

export default async function ResearchClientPortalPage() {
  const { organizationId, user } = await getCurrentUserTenant();
  const assignments = await listClientPortalProjects(organizationId, user.id);
  return <div>
    <p className="flex items-center gap-2 text-sm text-cyan-300"><Building2 size={17}/>Secure Research Client Portal</p>
    <h1 className="mt-2 text-4xl font-bold">Assigned research projects</h1>
    <p className="mt-2 max-w-3xl text-slate-400">This controlled workspace exposes only projects explicitly assigned to your client portal account. Internal working data and unapproved outputs remain hidden.</p>
    <div className="mt-8 grid gap-5 xl:grid-cols-2">{assignments.map(({id,access,project})=><Link key={id} href={`/research/client-portal/projects/${project.id}`} className="group rounded-3xl border border-white/10 bg-white/[.04] p-6 transition hover:border-cyan-300/30 hover:bg-cyan-300/[.04]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.18em] text-cyan-300">{project.reference}</p><h2 className="mt-2 text-xl font-semibold group-hover:text-cyan-100">{project.title}</h2><p className="mt-2 text-sm text-slate-400">{access.client.name} · {pretty(project.status)}</p></div><FolderOpen className="text-cyan-300" size={20}/></div><p className="mt-5 line-clamp-3 text-sm text-slate-300">{project.purpose}</p><div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-400"><span>{project._count.questionnaires} questionnaires</span><span>·</span><span>{project._count.visualizationDashboards} dashboards</span><span>·</span><span>{project._count.reports} reports</span></div></Link>)}{!assignments.length?<div className="rounded-3xl border border-dashed border-white/15 p-12 text-center xl:col-span-2"><h2 className="font-semibold">No active project assignments</h2><p className="mt-2 text-sm text-slate-500">Ask your research delivery contact to grant or restore project-specific portal access.</p></div>:null}</div>
  </div>;
}

function pretty(value:string){return value.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,letter=>letter.toUpperCase());}
