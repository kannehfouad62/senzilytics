import { CompetencyCreateForm, CompetencyRequirementForm, CourseCompetencyForm } from "@/features/training/competency-forms";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";
import { Award, Grid3X3 } from "lucide-react";
import Link from "next/link";

export default async function CompetencyLibraryPage(){
  await requirePermission(PermissionKey.VIEW_TRAINING);
  const[{organizationId},permissions]=await Promise.all([getCurrentUserTenant(),getCurrentUserPermissions()]);
  const canManage=permissions.includes(PermissionKey.MANAGE_TRAINING);
  const[competencies,courses,sites,departments]=await Promise.all([
    prisma.competencyDefinition.findMany({where:{organizationId},include:{courseLinks:{include:{course:true}},requirements:{include:{site:true,department:true}}},orderBy:{name:"asc"}}),
    prisma.trainingCourse.findMany({where:{organizationId,isActive:true},select:{id:true,code:true,name:true},orderBy:{name:"asc"}}),
    prisma.site.findMany({where:{organizationId},select:{id:true,name:true},orderBy:{name:"asc"}}),
    prisma.department.findMany({where:{site:{organizationId}},include:{site:true},orderBy:{name:"asc"}}),
  ]);
  const compact=competencies.map(x=>({id:x.id,code:x.code,name:x.name}));
  return <div><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm text-cyan-300"><Award size={17}/>Skills Architecture</p><h1 className="mt-2 text-4xl font-bold">Competency Library</h1><p className="mt-2 max-w-3xl text-slate-400">Define proficiency standards, connect learning outcomes, and scope mandatory workforce capability by role, job title, site, and department.</p></div><Link href="/training/competencies/matrix" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950"><Grid3X3 size={17}/>Readiness Matrix</Link></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-3"><Metric label="Competencies" value={competencies.length}/><Metric label="Safety critical" value={competencies.filter(x=>x.isCritical).length}/><Metric label="Active requirements" value={competencies.flatMap(x=>x.requirements).filter(x=>x.isActive).length}/></div>
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">Governed competency standards</h2><div className="mt-5 grid gap-4 lg:grid-cols-2">{competencies.map(x=><article key={x.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">{x.code} · {x.category.replaceAll("_"," ")}</p><h3 className="mt-1 font-semibold">{x.name}</h3></div>{x.isCritical&&<span className="h-fit rounded-full bg-red-400/10 px-3 py-1 text-xs text-red-300">Safety critical</span>}</div>{x.description&&<p className="mt-3 text-sm text-slate-400">{x.description}</p>}<p className="mt-4 text-xs text-slate-500">Validity {x.validityMonths?`${x.validityMonths} months`:"does not expire"} · {x.requirements.length} requirement(s)</p><div className="mt-3 flex flex-wrap gap-2">{x.courseLinks.map(link=><span key={link.id} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300">{link.course.code} → {link.achievedLevel}</span>)}</div></article>)}{!competencies.length&&<p className="text-sm text-slate-500">No competencies have been defined.</p>}</div></section>
    {canManage&&<div className="mt-8 grid gap-6 xl:grid-cols-2"><CompetencyCreateForm/><CourseCompetencyForm competencies={compact} courses={courses}/><CompetencyRequirementForm competencies={compact} sites={sites} departments={departments}/></div>}
  </div>;
}
function Metric({label,value}:{label:string;value:number}){return <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>}
