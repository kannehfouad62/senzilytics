"use server";
import type{FormActionState}from"@/core/actions/action-state";
import{requirePermission}from"@/lib/permissions";
import{getCurrentUserTenant}from"@/lib/tenant";
import{recordClientReviewDecisionService,submitClientReviewRequestService}from"@/modules/research/research-client-review.service";
import{publishClientDeliveryService,withdrawClientDeliveryService}from"@/modules/research/research-client-delivery.service";
import{PermissionKey,ResearchClientDeliveryFormat,ResearchClientReviewArtifactType}from"@prisma/client";
import{revalidatePath}from"next/cache";
const value=(data:FormData,key:string,max=4000)=>String(data.get(key)??"").trim().slice(0,max);
const fail=(cause:unknown):FormActionState=>({status:"ERROR",message:cause instanceof Error?cause.message:"Client review could not be updated."});
const refresh=(projectId:string)=>{revalidatePath(`/research/projects/${projectId}/client-review`);revalidatePath(`/research/client-portal/projects/${projectId}`);revalidatePath("/notifications")};

export async function submitClientReviewRequest(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.MANAGE_RESEARCH_PROJECTS);const{organizationId,user}=await getCurrentUserTenant();
  try{const projectId=value(data,"projectId",100),artifactType=value(data,"artifactType",40)as ResearchClientReviewArtifactType;if(!Object.values(ResearchClientReviewArtifactType).includes(artifactType))throw new Error("Select a valid review artifact.");const rawDue=value(data,"dueAt",30),dueAt=rawDue?new Date(rawDue):null;if(dueAt&&Number.isNaN(dueAt.getTime()))throw new Error("Enter a valid review due date.");await submitClientReviewRequestService({organizationId,actorId:user.id,projectId,artifactType,artifactId:value(data,"artifactId",100),instructions:value(data,"instructions")||null,dueAt});refresh(projectId);return{status:"SUCCESS",message:"Artifact submitted for governed client review."}}catch(cause){return fail(cause)}
}

export async function recordClientReviewDecision(_state:FormActionState,data:FormData):Promise<FormActionState>{
  const{organizationId,user}=await getCurrentUserTenant();
  try{const projectId=value(data,"projectId",100),decision=value(data,"decision",30)as"COMMENT"|"REQUEST_REVISION"|"APPROVE"|"ACCEPT";if(!["COMMENT","REQUEST_REVISION","APPROVE","ACCEPT"].includes(decision))throw new Error("Select a valid client review decision.");await recordClientReviewDecisionService({organizationId,userId:user.id,projectId,requestId:value(data,"requestId",100),decision,comment:value(data,"comment")});refresh(projectId);return{status:"SUCCESS",message:"Client review response recorded."}}catch(cause){return fail(cause)}
}

export async function publishClientDelivery(_state:FormActionState,data:FormData):Promise<FormActionState>{await requirePermission(PermissionKey.MANAGE_RESEARCH_PROJECTS);const{organizationId,user}=await getCurrentUserTenant();try{const projectId=value(data,"projectId",100),format=value(data,"format",40)as ResearchClientDeliveryFormat;if(!Object.values(ResearchClientDeliveryFormat).includes(format))throw new Error("Select a valid delivery format.");await publishClientDeliveryService({organizationId,actorId:user.id,projectId,reviewId:value(data,"reviewId",100),format,releaseNotes:value(data,"releaseNotes")||null});refresh(projectId);return{status:"SUCCESS",message:"Accepted output released to the secure client delivery room."}}catch(cause){return fail(cause)}}

export async function withdrawClientDelivery(_state:FormActionState,data:FormData):Promise<FormActionState>{await requirePermission(PermissionKey.MANAGE_RESEARCH_PROJECTS);const{organizationId,user}=await getCurrentUserTenant();try{const projectId=value(data,"projectId",100);await withdrawClientDeliveryService({organizationId,actorId:user.id,deliveryId:value(data,"deliveryId",100)});refresh(projectId);return{status:"SUCCESS",message:"Client delivery withdrawn."}}catch(cause){return fail(cause)}}
