"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { createCapaFromCriticalControlService, createCriticalControlService, recordCriticalControlVerificationService, reviewSifSignalService } from "@/modules/assurance/critical-control.service";
import { preparePublishedFormSubmissions } from "@/modules/forms/runtime-form.service";
import { ConfigurableFormModule, CriticalControlVerificationResult, PermissionKey, RiskLevel, SifExposureCategory, SifSignalClassification, SifSignalSourceType } from "@prisma/client";
import { revalidatePath } from "next/cache";

const text=(data:FormData,key:string)=>String(data.get(key)||"").trim();
const required=(data:FormData,key:string)=>{const value=text(data,key);if(!value)throw new Error(`${key} is required.`);return value};
const optional=(data:FormData,key:string)=>text(data,key)||null;
const integer=(data:FormData,key:string)=>{const value=Number(required(data,key));if(!Number.isInteger(value))throw new Error(`${key} must be a whole number.`);return value};
const date=(data:FormData,key:string)=>{const value=new Date(required(data,key));if(Number.isNaN(value.getTime()))throw new Error(`${key} must be a valid date.`);return value};
const fail=(cause:unknown,fallback:string):FormActionState=>({status:"ERROR",message:cause instanceof Error?cause.message:fallback});

export async function createCriticalControl(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.MANAGE_CRITICAL_CONTROLS);const{organizationId,user}=await getCurrentUserTenant();
  try{const category=required(data,"category") as SifExposureCategory;if(!Object.values(SifExposureCategory).includes(category))throw new Error("Select a valid SIF exposure category.");await createCriticalControlService({organizationId,userId:user.id,code:required(data,"code"),name:required(data,"name"),category,description:optional(data,"description"),performanceStandard:required(data,"performanceStandard"),verificationPrompt:required(data,"verificationPrompt"),verificationFrequencyDays:integer(data,"verificationFrequencyDays"),siteId:optional(data,"siteId"),departmentId:optional(data,"departmentId"),ownerId:optional(data,"ownerId")})}catch(cause){return fail(cause,"The critical control could not be created.")}
  revalidatePath("/assurance/sif");revalidatePath("/assurance/sif/controls");return{status:"SUCCESS",message:"Critical control standard created."};
}

export async function recordCriticalControlVerification(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.MANAGE_CRITICAL_CONTROLS);const{organizationId,user}=await getCurrentUserTenant();const controlId=required(data,"controlId");
  try{const result=required(data,"result") as CriticalControlVerificationResult;if(!Object.values(CriticalControlVerificationResult).includes(result))throw new Error("Select a valid verification result.");const customSubmissions=await preparePublishedFormSubmissions({organizationId,module:ConfigurableFormModule.SIF_ASSURANCE,data});await recordCriticalControlVerificationService({organizationId,userId:user.id,controlId,verifiedAt:date(data,"verifiedAt"),result,evidenceReference:optional(data,"evidenceReference"),findings:optional(data,"findings"),immediateAction:optional(data,"immediateAction"),customSubmissions})}catch(cause){return fail(cause,"The critical-control verification could not be recorded.")}
  revalidatePath("/assurance/sif");revalidatePath("/assurance/sif/controls");revalidatePath(`/assurance/sif/controls/${controlId}`);return{status:"SUCCESS",message:"Critical-control verification recorded."};
}

export async function reviewSifSignal(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.MANAGE_CRITICAL_CONTROLS);const{organizationId,user}=await getCurrentUserTenant();
  try{const sourceType=required(data,"sourceType") as SifSignalSourceType,classification=required(data,"classification") as SifSignalClassification,exposureCategory=required(data,"exposureCategory") as SifExposureCategory,potentialSeverity=required(data,"potentialSeverity") as RiskLevel;if(!Object.values(SifSignalSourceType).includes(sourceType)||!Object.values(SifSignalClassification).includes(classification)||!Object.values(SifExposureCategory).includes(exposureCategory)||!Object.values(RiskLevel).includes(potentialSeverity))throw new Error("Select valid SIF review values.");const sourcePermission:Partial<Record<SifSignalSourceType,PermissionKey>>={[SifSignalSourceType.OBSERVATION]:PermissionKey.VIEW_OBSERVATIONS,[SifSignalSourceType.INCIDENT]:PermissionKey.VIEW_INCIDENT,[SifSignalSourceType.AUDIT_FINDING]:PermissionKey.VIEW_AUDITS,[SifSignalSourceType.INSPECTION_FINDING]:PermissionKey.VIEW_INSPECTIONS,[SifSignalSourceType.RISK]:PermissionKey.VIEW_RISKS,[SifSignalSourceType.PERMIT_TO_WORK]:PermissionKey.VIEW_PERMITS_TO_WORK};if(sourcePermission[sourceType])await requirePermission(sourcePermission[sourceType]!);await reviewSifSignalService({organizationId,userId:user.id,sourceType,sourceId:required(data,"sourceId"),classification,exposureCategory,potentialSeverity,rationale:required(data,"rationale"),controlFailureNotes:optional(data,"controlFailureNotes")})}catch(cause){return fail(cause,"The SIF review could not be recorded.")}
  revalidatePath("/assurance/sif");return{status:"SUCCESS",message:"SIF classification decision recorded."};
}

export async function createCriticalControlCapa(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.MANAGE_CRITICAL_CONTROLS);await requirePermission(PermissionKey.CREATE_CAPA);const{organizationId,user}=await getCurrentUserTenant();
  const controlId=required(data,"controlId");
  try{await createCapaFromCriticalControlService({organizationId,userId:user.id,verificationId:required(data,"verificationId"),title:required(data,"title"),description:optional(data,"description"),assignedToId:required(data,"assignedToId"),dueDate:date(data,"dueDate")})}catch(cause){return fail(cause,"The corrective action could not be created.")}
  revalidatePath("/assurance/sif");revalidatePath(`/assurance/sif/controls/${controlId}`);revalidatePath("/actions");return{status:"SUCCESS",message:"Corrective action created and linked to the verification."};
}
