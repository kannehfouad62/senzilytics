"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { approveCertificationManagementReviewService, completeCertificationManagementReviewService, createCapaFromCertificationReviewService, createCertificationManagementReviewService } from "@/modules/assurance/certification-readiness.service";
import { preparePublishedFormSubmissions } from "@/modules/forms/runtime-form.service";
import { ConfigurableFormModule, ManagementSystemConclusion, PermissionKey, RiskLevel } from "@prisma/client";
import { revalidatePath } from "next/cache";

const text=(data:FormData,key:string)=>String(data.get(key)||"").trim();
const required=(data:FormData,key:string)=>{const value=text(data,key);if(!value)throw new Error(`${key} is required.`);return value};
const optional=(data:FormData,key:string)=>text(data,key)||null;
const date=(data:FormData,key:string)=>{const value=new Date(required(data,key));if(Number.isNaN(value.getTime()))throw new Error(`${key} must be a valid date.`);return value};
const fail=(cause:unknown,fallback:string):FormActionState=>({status:"ERROR",message:cause instanceof Error?cause.message:fallback});

export async function scheduleCertificationManagementReview(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.MANAGE_CERTIFICATION_READINESS);const{organizationId,user}=await getCurrentUserTenant();const programId=required(data,"programId");
  try{await createCertificationManagementReviewService({organizationId,userId:user.id,programId,title:required(data,"title"),periodStart:date(data,"periodStart"),periodEnd:date(data,"periodEnd"),scheduledAt:date(data,"scheduledAt"),chairId:required(data,"chairId"),attendees:optional(data,"attendees")})}catch(cause){return fail(cause,"The management review could not be scheduled.")}
  revalidatePath("/assurance/certification");revalidatePath(`/assurance/certification/${programId}`);return{status:"SUCCESS",message:"Management review scheduled."};
}

export async function completeCertificationManagementReview(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.MANAGE_CERTIFICATION_READINESS);const{organizationId,user}=await getCurrentUserTenant();const reviewId=required(data,"reviewId"),programId=required(data,"programId");
  try{const conclusion=required(data,"conclusion") as ManagementSystemConclusion;if(!Object.values(ManagementSystemConclusion).includes(conclusion))throw new Error("Select a valid management-system conclusion.");const customSubmissions=await preparePublishedFormSubmissions({organizationId,module:ConfigurableFormModule.CERTIFICATION_READINESS,data});await completeCertificationManagementReviewService({organizationId,userId:user.id,reviewId,attendees:optional(data,"attendees"),auditResultsSummary:required(data,"auditResultsSummary"),complianceStatusSummary:required(data,"complianceStatusSummary"),objectivesPerformance:required(data,"objectivesPerformance"),stakeholderFeedback:optional(data,"stakeholderFeedback"),changesInContext:optional(data,"changesInContext"),risksAndOpportunities:required(data,"risksAndOpportunities"),resourceAdequacy:required(data,"resourceAdequacy"),decisions:required(data,"decisions"),improvementOpportunities:required(data,"improvementOpportunities"),conclusion,nextReviewAt:date(data,"nextReviewAt"),customSubmissions})}catch(cause){return fail(cause,"The management review could not be completed.")}
  revalidatePath("/assurance/certification");revalidatePath(`/assurance/certification/${programId}`);revalidatePath(`/assurance/certification/reviews/${reviewId}`);return{status:"SUCCESS",message:"Management-review inputs and readiness snapshot recorded."};
}

export async function approveCertificationManagementReview(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.MANAGE_CERTIFICATION_READINESS);const{organizationId,user}=await getCurrentUserTenant();const reviewId=required(data,"reviewId"),programId=required(data,"programId");
  try{await approveCertificationManagementReviewService({organizationId,userId:user.id,reviewId})}catch(cause){return fail(cause,"The management review could not be approved.")}
  revalidatePath("/assurance/certification");revalidatePath(`/assurance/certification/${programId}`);revalidatePath(`/assurance/certification/reviews/${reviewId}`);return{status:"SUCCESS",message:"Management review approved."};
}

export async function createCertificationReviewCapa(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.MANAGE_CERTIFICATION_READINESS);await requirePermission(PermissionKey.CREATE_CAPA);const{organizationId,user}=await getCurrentUserTenant();const reviewId=required(data,"reviewId");
  try{const riskLevel=required(data,"riskLevel") as RiskLevel;if(!Object.values(RiskLevel).includes(riskLevel))throw new Error("Select a valid CAPA risk level.");await createCapaFromCertificationReviewService({organizationId,userId:user.id,reviewId,agendaTopic:optional(data,"agendaTopic"),decision:required(data,"decision"),title:required(data,"title"),description:optional(data,"description"),assignedToId:required(data,"assignedToId"),riskLevel,dueDate:date(data,"dueDate")})}catch(cause){return fail(cause,"The management-review CAPA could not be created.")}
  revalidatePath(`/assurance/certification/reviews/${reviewId}`);revalidatePath("/actions");revalidatePath("/capa");return{status:"SUCCESS",message:"Corrective action created and linked to the management review."};
}
