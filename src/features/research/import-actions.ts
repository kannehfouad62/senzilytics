"use server";
import { ActivityAction, PermissionKey, ResearchImportStatus, ResearchMeasurementLevel, ResearchVariableDataType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import type { FormActionState } from "@/core/actions/action-state";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";

const text=(data:FormData,key:string,max=500)=>String(data.get(key)??"").trim().slice(0,max);
const fail=(cause:unknown):FormActionState=>({status:"ERROR",message:cause instanceof Error?cause.message:"The data dictionary could not be updated."});
const refresh=(projectId:string)=>{revalidatePath("/research","layout");revalidatePath(`/research/projects/${projectId}/imports`)};

export async function updateResearchVariable(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);const{organizationId,user}=await getCurrentUserTenant();
  try{const variableId=text(data,"variableId",100),label=text(data,"label",160),unit=text(data,"unit",80)||null,dataType=text(data,"dataType",30)as ResearchVariableDataType,measurementLevel=text(data,"measurementLevel",30)as ResearchMeasurementLevel;
    if(!label||!Object.values(ResearchVariableDataType).includes(dataType)||!Object.values(ResearchMeasurementLevel).includes(measurementLevel))throw new Error("Complete the variable metadata.");
    const variable=await prisma.researchDataVariable.findFirst({where:{id:variableId,dataset:{organizationId,status:{in:[ResearchImportStatus.PROFILED,ResearchImportStatus.MAPPED]}}},include:{dataset:true}});
    if(!variable)throw new Error("Editable research variable not found.");
    const missingValues=[...new Set(text(data,"missingValues",1000).split(/[,\n]/).map(v=>v.trim()).filter(Boolean))].slice(0,30);
    await prisma.researchDataVariable.update({where:{id:variable.id},data:{label,dataType,measurementLevel,unit,missingValues}});
    await logActivity({organizationId,userId:user.id,action:ActivityAction.UPDATE,entityType:"ResearchDataVariable",entityId:variable.id,title:"Research data dictionary updated",description:label,metadata:{datasetId:variable.datasetId}});
    refresh(variable.dataset.projectId);return{status:"SUCCESS",message:"Variable metadata saved."};
  }catch(cause){return fail(cause)}
}

export async function finalizeResearchDictionary(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);const{organizationId,user}=await getCurrentUserTenant();
  try{const datasetId=text(data,"datasetId",100),dataset=await prisma.researchImportedDataset.findFirst({where:{id:datasetId,organizationId,status:ResearchImportStatus.PROFILED},include:{_count:{select:{variables:true}}}});
    if(!dataset||!dataset._count.variables)throw new Error("Profiled dataset not found.");
    await prisma.researchImportedDataset.update({where:{id:dataset.id},data:{status:ResearchImportStatus.MAPPED}});
    await logActivity({organizationId,userId:user.id,action:ActivityAction.STATUS_CHANGE,entityType:"ResearchImportedDataset",entityId:dataset.id,title:"Research data dictionary mapped",description:dataset.name,metadata:{variableCount:dataset._count.variables}});
    refresh(dataset.projectId);return{status:"SUCCESS",message:"Dictionary mapping completed."};
  }catch(cause){return fail(cause)}
}
