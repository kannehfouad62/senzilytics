import { RegisterPagination } from "@/components/register/register-pagination";
import { RegisterSearch } from "@/components/register/register-search";
import { normalizeRegisterQuery, registerPageCount } from "@/core/register/register-query";
import { ExposureGroupForm, HygieneAgentForm } from "@/features/industrial-hygiene/foundation-forms";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { ExposureAssessmentStatus, ExposureResultClassification, PermissionKey, Prisma } from "@prisma/client";
import { FlaskConical, Plus, Users } from "lucide-react";
import Link from "next/link";

export default async function IndustrialHygienePage({ searchParams }: { searchParams: Promise<{ search?: string; page?: string }> }) {
  await requirePermission(PermissionKey.VIEW_INDUSTRIAL_HYGIENE);
  const [{ organizationId }, permissions, params] = await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions(), searchParams]);
  const query = normalizeRegisterQuery(params);
  const assessmentWhere: Prisma.ExposureAssessmentWhereInput = { organizationId, ...(query.search ? { OR: [
    { reference: { contains: query.search, mode: "insensitive" } }, { title: { contains: query.search, mode: "insensitive" } },
    { description: { contains: query.search, mode: "insensitive" } }, { group: { name: { contains: query.search, mode: "insensitive" } } },
    { site: { name: { contains: query.search, mode: "insensitive" } } }, { assessor: { name: { contains: query.search, mode: "insensitive" } } },
  ] } : {}) };
  const canManage=permissions.includes(PermissionKey.MANAGE_INDUSTRIAL_HYGIENE);
  const [assessments,total,open,exceedances,groups,agents,sites,departments,users]=await Promise.all([
    prisma.exposureAssessment.findMany({where:assessmentWhere,include:{group:true,site:true,assessor:true,_count:{select:{samples:true}}},orderBy:{updatedAt:"desc"},skip:query.skip,take:query.take}),
    prisma.exposureAssessment.count({where:assessmentWhere}),
    prisma.exposureAssessment.count({where:{organizationId,status:{notIn:[ExposureAssessmentStatus.COMPLETED,ExposureAssessmentStatus.CANCELLED]}}}),
    prisma.exposureSample.count({where:{assessment:{organizationId},classification:ExposureResultClassification.ABOVE_LIMIT}}),
    prisma.similarExposureGroup.findMany({where:{organizationId},include:{site:true,owner:true,agents:{include:{agent:true}}},orderBy:{name:"asc"}}),
    prisma.hygieneAgent.findMany({where:{organizationId},orderBy:{name:"asc"}}),
    prisma.site.findMany({where:{organizationId},select:{id:true,name:true},orderBy:{name:"asc"}}),
    prisma.department.findMany({where:{site:{organizationId}},include:{site:true},orderBy:{name:"asc"}}),
    prisma.user.findMany({where:{organizationId,isActive:true},select:{id:true,name:true},orderBy:{name:"asc"}}),
  ]);
  const headcount=groups.reduce((sum,x)=>sum+(x.exposedHeadcount||0),0);
  return <div>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm text-cyan-300"><FlaskConical size={17}/>Exposure Science & Control</p><h1 className="mt-2 text-4xl font-bold">Industrial Hygiene</h1><p className="mt-2 max-w-3xl text-slate-400">Define exposure agents and Similar Exposure Groups, plan assessments, classify sampling results, and identify control priorities.</p></div>{canManage&&<Link href="/industrial-hygiene/new" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950"><Plus size={17}/>New Assessment</Link>}</div>
    <div className="mt-7 grid gap-4 sm:grid-cols-4"><Metric label="Exposure agents" value={agents.length}/><Metric label="Similar Exposure Groups" value={groups.length}/><Metric label="Open assessments" value={open}/><Metric label="Results above limit" value={exceedances} danger={exceedances>0}/></div>
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6"><div><h2 className="text-xl font-semibold">Exposure assessments</h2><p className="mt-1 text-sm text-slate-400">{headcount} workers represented by active group headcounts.</p></div><div className="mt-5"><RegisterSearch action="/industrial-hygiene" value={query.search} placeholder="Search reference, assessment, exposure group, site, or assessor"/><p className="mt-3 text-sm text-slate-500">{total} matching assessment{total===1?"":"s"}</p></div><div className="mt-4 space-y-3">{assessments.map(x=><Link key={x.id} href={`/industrial-hygiene/${x.id}`} className="block rounded-xl bg-slate-950/50 p-4"><div className="flex flex-wrap justify-between gap-3"><span><strong>{x.reference}</strong> — {x.title}<span className="mt-1 block text-xs text-slate-500">{x.group.name} · {x.site.name} · {x._count.samples} sample(s)</span></span><span className="text-xs text-cyan-300">{x.status.replaceAll("_"," ")}</span></div></Link>)}{!assessments.length&&<p className="text-sm text-slate-500">{query.search?"No exposure assessments match this search.":"No exposure assessments have been created."}</p>}</div><RegisterPagination action="/industrial-hygiene" search={query.search} page={query.page} pages={registerPageCount(total)}/></section>
    <div className="mt-8 grid gap-6 xl:grid-cols-3"><section className="rounded-3xl border border-white/10 bg-white/5 p-6 xl:col-span-2"><h2 className="flex items-center gap-2 text-xl font-semibold"><Users size={20} className="text-cyan-300"/>Similar Exposure Groups</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{groups.map(x=><div key={x.id} className="rounded-xl bg-slate-950/50 p-4"><p className="font-medium">{x.name}</p><p className="mt-1 text-xs text-slate-500">{x.site.name} · {x.exposedHeadcount??0} people · {x.agents.map(a=>a.agent.name).join(", ")}</p><p className="mt-2 text-sm text-slate-400">Owner: {x.owner?.name||"Unassigned"} · Review {x.reviewDueDate?.toLocaleDateString()||"not scheduled"}</p></div>)}</div></section><section className="rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">Agent library</h2><div className="mt-4 space-y-3">{agents.map(x=><div key={x.id} className="rounded-xl bg-slate-950/50 p-3"><p className="font-medium">{x.name}</p><p className="mt-1 text-xs text-slate-500">{x.category.replaceAll("_"," ")} · OEL {x.occupationalLimit??"—"} {x.unit||""}</p></div>)}</div></section></div>
    {canManage&&<div className="mt-8 grid gap-6 xl:grid-cols-3"><HygieneAgentForm/><ExposureGroupForm sites={sites} departments={departments} users={users} agents={agents}/></div>}
  </div>;
}
function Metric({label,value,danger=false}:{label:string;value:number;danger?:boolean}){return <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 text-3xl font-bold ${danger?"text-red-300":"text-white"}`}>{value}</p></div>}
