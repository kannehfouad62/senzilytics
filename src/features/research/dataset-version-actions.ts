"use server";

import { get, put } from "@vercel/blob";
import { ActivityAction, PermissionKey, ResearchDatasetVersionStatus, ResearchImportStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import type { FormActionState } from "@/core/actions/action-state";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { createDatasetQualitySnapshot, researchRowsToCsv } from "@/modules/research/research-dataset-version";
import { parseResearchFileRows } from "@/modules/research/research-import";
import { applyResearchTransformations } from "@/modules/research/research-transformations";

const value=(data:FormData,key:string)=>String(data.get(key)??"").trim().slice(0,100);
const failure=(cause:unknown):FormActionState=>({status:"ERROR",message:cause instanceof Error?cause.message:"Dataset version could not be updated."});
const refresh=()=>revalidatePath("/research","layout");

export async function materializeResearchDatasetVersion(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const {organizationId,user}=await getCurrentUserTenant();
  try{
    const datasetId=value(data,"datasetId");
    const dataset=await prisma.researchImportedDataset.findFirst({where:{id:datasetId,organizationId,status:ResearchImportStatus.MAPPED},include:{variables:{orderBy:{position:"asc"}},transformations:{orderBy:{position:"asc"}},versions:{select:{version:true},orderBy:{version:"desc"},take:1}}});
    if(!dataset)throw new Error("Mapped dataset not found.");
    const stored=await get(dataset.sourceBlobPath,{access:"private"});
    if(!stored||stored.statusCode!==200||!stored.stream)throw new Error("The private source file is unavailable.");
    const raw=await parseResearchFileRows(await new Response(stored.stream).arrayBuffer(),dataset.mimeType,dataset.sourceFileName);
    const headers=raw[0]??[];
    const sourceRows=raw.slice(1).filter((row)=>row.some(Boolean)).map((row)=>Object.fromEntries(dataset.variables.map((variable)=>[variable.key,row[headers.indexOf(variable.sourceColumn)]??""])));
    const recipes=dataset.transformations.map((recipe)=>({type:recipe.type,sourceVariableKey:recipe.sourceVariableKey,secondaryVariableKey:recipe.secondaryVariableKey,outputVariableKey:recipe.outputVariableKey,parameters:recipe.parameters}));
    const outputRows=applyResearchTransformations(sourceRows,recipes);
    const columns=[...new Set(outputRows.flatMap((row)=>Object.keys(row)))];
    const version=(dataset.versions[0]?.version??0)+1;
    const quality=createDatasetQualitySnapshot(sourceRows,outputRows,columns);
    const blob=await put(`research-versions/${dataset.id}/v${version}.csv`,researchRowsToCsv(outputRows,columns),{access:"private",addRandomSuffix:true,contentType:"text/csv"});
    const created=await prisma.researchDatasetVersion.create({data:{organizationId,datasetId,version,storagePath:blob.pathname,rowCount:outputRows.length,columnCount:columns.length,transformationSnapshot:JSON.parse(JSON.stringify(recipes)),qualitySnapshot:quality,createdById:user.id}});
    await logActivity({organizationId,userId:user.id,action:ActivityAction.CREATE,entityType:"ResearchDatasetVersion",entityId:created.id,title:"Analysis-ready dataset version generated",description:`${dataset.name} v${version}`,metadata:quality});
    refresh();return{status:"SUCCESS",message:`Version ${version} generated for review.`};
  }catch(cause){return failure(cause)}
}

export async function changeResearchDatasetVersionStatus(_state:FormActionState,data:FormData):Promise<FormActionState>{
  const [{organizationId,user},permissions]=await Promise.all([getCurrentUserTenant(),getCurrentUserPermissions()]);
  if(!permissions.includes(PermissionKey.MANAGE_RESEARCH_DATASETS)&&!permissions.includes(PermissionKey.APPROVE_RESEARCH_OUTPUTS))throw new Error("Dataset governance permission is required.");
  try{
    const id=value(data,"versionId"),target=value(data,"status") as ResearchDatasetVersionStatus;
    if(!Object.values(ResearchDatasetVersionStatus).includes(target))throw new Error("Select a valid dataset version status.");
    const version=await prisma.researchDatasetVersion.findFirst({where:{id,organizationId}});
    if(!version)throw new Error("Dataset version not found.");
    const allowed:Record<ResearchDatasetVersionStatus,ResearchDatasetVersionStatus[]>={DRAFT:[ResearchDatasetVersionStatus.UNDER_REVIEW],UNDER_REVIEW:[ResearchDatasetVersionStatus.DRAFT,ResearchDatasetVersionStatus.APPROVED],APPROVED:[],SUPERSEDED:[]};
    if(!allowed[version.status].includes(target))throw new Error(`Version cannot move from ${version.status} to ${target}.`);
    if(target!==ResearchDatasetVersionStatus.APPROVED&&!permissions.includes(PermissionKey.MANAGE_RESEARCH_DATASETS))throw new Error("Dataset management permission is required.");
    if(target===ResearchDatasetVersionStatus.APPROVED){
      if(!permissions.includes(PermissionKey.APPROVE_RESEARCH_OUTPUTS))throw new Error("Research output approval permission is required.");
      if(version.createdById===user.id)throw new Error("Independent approval is required.");
      const now=new Date();
      await prisma.$transaction([prisma.researchDatasetVersion.updateMany({where:{datasetId:version.datasetId,status:ResearchDatasetVersionStatus.APPROVED},data:{status:ResearchDatasetVersionStatus.SUPERSEDED}}),prisma.researchDatasetVersion.update({where:{id},data:{status:target,reviewerId:user.id,approvedById:user.id,reviewedAt:now,approvedAt:now}})]);
    }else await prisma.researchDatasetVersion.update({where:{id},data:{status:target,submittedAt:target===ResearchDatasetVersionStatus.UNDER_REVIEW?new Date():null}});
    await logActivity({organizationId,userId:user.id,action:ActivityAction.STATUS_CHANGE,entityType:"ResearchDatasetVersion",entityId:id,title:"Dataset version status changed",description:`${version.status} → ${target}`});
    refresh();return{status:"SUCCESS",message:"Dataset version status updated."};
  }catch(cause){return failure(cause)}
}
