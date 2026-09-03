import { PermissionKey } from "@prisma/client";
import { ArrowLeft, DatabaseZap } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResearchImportUpload } from "@/features/research/research-import-upload";
import { FinalizeDictionary, ResearchVariableEditor } from "@/features/research/research-variable-editor";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";

export const dynamic="force-dynamic";
export default async function ResearchImportsPage({params}:{params:Promise<{id:string}>}) {
  await requirePermission(PermissionKey.VIEW_RESEARCH);
  const [{id},{organizationId},permissions]=await Promise.all([params,getCurrentUserTenant(),getCurrentUserPermissions()]);
  const project=await prisma.researchProject.findFirst({where:{id,organizationId},include:{importedDatasets:{include:{variables:{orderBy:{position:"asc"}},importedBy:{select:{name:true}}},orderBy:{createdAt:"desc"}}}});
  if(!project)notFound();
  return <div><Link href={`/research/projects/${id}`} className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16}/>{project.reference}</Link>
    <div className="mt-6"><p className="flex items-center gap-2 text-sm text-cyan-300"><DatabaseZap size={17}/>Governed Data Intake</p><h1 className="mt-2 text-4xl font-bold">Data Import & Dictionary</h1><p className="mt-2 max-w-3xl text-slate-400">Preserve source evidence, inspect a safe preview, and establish variable metadata for {project.title}.</p></div>
    {permissions.includes(PermissionKey.MANAGE_RESEARCH_DATASETS)&&<div className="mt-8"><ResearchImportUpload projectId={id}/></div>}
    <div className="mt-8 space-y-5">{project.importedDatasets.map(dataset=><details key={dataset.id} className="rounded-3xl border border-white/10 bg-white/[.04] p-6"><summary className="cursor-pointer"><span className="font-semibold">{dataset.name}</span><span className="ml-3 text-xs text-cyan-300">{dataset.status}</span><span className="mt-1 block text-xs text-slate-500">{dataset.rowCount.toLocaleString()} rows · {dataset.columnCount} columns · {dataset.sourceFileName} · {dataset.importedBy.name}</span></summary>
      {dataset.profileErrors.map(error=><p key={error} className="mt-4 text-sm text-red-300">{error}</p>)}
      {!!dataset.variables.length&&<div className="mt-5">{permissions.includes(PermissionKey.MANAGE_RESEARCH_DATASETS)?dataset.variables.map(variable=><ResearchVariableEditor key={variable.id} variable={variable}/>):<div className="grid gap-2">{dataset.variables.map(variable=><p key={variable.id} className="text-sm">{variable.label} · {variable.dataType} · {variable.measurementLevel}</p>)}</div>}{dataset.status==="PROFILED"&&permissions.includes(PermissionKey.MANAGE_RESEARCH_DATASETS)&&<FinalizeDictionary datasetId={dataset.id}/>}</div>}
    </details>)}{!project.importedDatasets.length&&<p className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-slate-500">No external datasets imported.</p>}</div>
  </div>;
}
