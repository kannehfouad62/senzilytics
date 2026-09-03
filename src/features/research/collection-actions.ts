"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { assignResearchRespondent, createResearchCollection, setResearchCollectionStatus, submitAssignedResearchQuestionnaire } from "@/modules/research/research-collection.service";
import { PermissionKey, ResearchCollectionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const text=(data:FormData,key:string)=>String(data.get(key)??"").trim();
const required=(data:FormData,key:string)=>{const value=text(data,key);if(!value)throw new Error(`${key} is required.`);return value};
const date=(data:FormData,key:string)=>{const value=text(data,key);if(!value)return null;const parsed=new Date(value);if(Number.isNaN(parsed.getTime()))throw new Error(`Enter a valid ${key}.`);return parsed};
const integer=(data:FormData,key:string)=>{const value=text(data,key);if(!value)return null;const parsed=Number(value);if(!Number.isInteger(parsed))throw new Error(`${key} must be a whole number.`);return parsed};
const failure=(cause:unknown,fallback:string):FormActionState=>({status:"ERROR",message:cause instanceof Error?cause.message:fallback});
const refreshResearch=()=>revalidatePath("/research","layout");

export async function createCollectionWave(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);const{organizationId,user}=await getCurrentUserTenant();const projectId=required(data,"projectId"),questionnaireId=required(data,"questionnaireId");let id="";
  try{const created=await createResearchCollection({organizationId,userId:user.id,projectId,questionnaireId,name:required(data,"name"),opensAt:date(data,"opensAt"),closesAt:date(data,"closesAt"),dueAt:date(data,"dueAt"),targetResponseCount:integer(data,"targetResponseCount"),instructions:text(data,"instructions")||null});id=created.id;refreshResearch()}catch(cause){return failure(cause,"Collection wave could not be created.")}
  redirect(`/research/collections/${id}`);
}

export async function assignQuestionnaireRespondent(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);const{organizationId,user}=await getCurrentUserTenant();const collectionId=required(data,"collectionId");
  try{await assignResearchRespondent({organizationId,actorId:user.id,collectionId,respondentId:required(data,"respondentId"),dueAt:date(data,"dueAt")});refreshResearch();return{status:"SUCCESS",message:"Respondent assigned and notified."}}catch(cause){return failure(cause,"Respondent could not be assigned.")}
}

export async function changeCollectionStatus(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);const{organizationId,user}=await getCurrentUserTenant();const collectionId=required(data,"collectionId");
  try{const raw=required(data,"status");if(!Object.values(ResearchCollectionStatus).includes(raw as ResearchCollectionStatus))throw new Error("Select a valid collection status.");await setResearchCollectionStatus({organizationId,actorId:user.id,collectionId,status:raw as ResearchCollectionStatus});refreshResearch();return{status:"SUCCESS",message:"Collection status updated."}}catch(cause){return failure(cause,"Collection status could not be updated.")}
}

export async function submitResearchResponse(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.COLLECT_RESEARCH_DATA);const{organizationId,user}=await getCurrentUserTenant();const assignmentId=required(data,"assignmentId");
  try{await submitAssignedResearchQuestionnaire({organizationId,userId:user.id,assignmentId,consent:data.get("participantConsent")==="on",data});refreshResearch()}catch(cause){return failure(cause,"Questionnaire response could not be submitted.")}
  redirect("/research/my-questionnaires?submitted=1");
}
