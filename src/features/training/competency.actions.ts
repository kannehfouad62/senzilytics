"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { createCompetencyRequirementService, createCompetencyService, decideCompetencyAssessmentService, linkCourseCompetencyService, submitCompetencyAssessmentService } from "@/modules/training/competency.service";
import { CompetencyCategory, CompetencyEvidenceType, CompetencyProficiency, PermissionKey, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

const text=(data:FormData,key:string)=>String(data.get(key)||"").trim();
const required=(data:FormData,key:string)=>{const value=text(data,key);if(!value)throw new Error(`${key} is required.`);return value};
const optional=(data:FormData,key:string)=>text(data,key)||null;
const number=(data:FormData,key:string)=>{const raw=optional(data,key);if(!raw)return null;const value=Number(raw);if(!Number.isFinite(value))throw new Error(`${key} must be a number.`);return value};
const integer=(data:FormData,key:string)=>{const value=Number(required(data,key));if(!Number.isInteger(value))throw new Error(`${key} must be a whole number.`);return value};
const date=(data:FormData,key:string)=>{const value=new Date(required(data,key));if(Number.isNaN(value.getTime()))throw new Error(`${key} must be a valid date.`);return value};
const error=(cause:unknown,fallback:string):FormActionState=>({status:"ERROR",message:cause instanceof Error?cause.message:fallback});

export async function createCompetency(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.MANAGE_TRAINING);const{organizationId,user}=await getCurrentUserTenant();
  try{const category=required(data,"category") as CompetencyCategory;if(!Object.values(CompetencyCategory).includes(category))throw new Error("Select a valid competency category.");await createCompetencyService({organizationId,userId:user.id,code:required(data,"code"),name:required(data,"name"),description:optional(data,"description"),category,validityMonths:number(data,"validityMonths"),isCritical:data.get("isCritical")==="on"})}catch(cause){return error(cause,"The competency could not be created.")}
  revalidatePath("/training/competencies");return{status:"SUCCESS",message:"Competency created."};
}

export async function linkCourseCompetency(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.MANAGE_TRAINING);const{organizationId,user}=await getCurrentUserTenant();
  try{const achievedLevel=required(data,"achievedLevel") as CompetencyProficiency;if(!Object.values(CompetencyProficiency).includes(achievedLevel))throw new Error("Select a valid achieved level.");await linkCourseCompetencyService({organizationId,userId:user.id,competencyId:required(data,"competencyId"),courseId:required(data,"courseId"),achievedLevel,minimumScore:number(data,"minimumScore"),isPrimary:data.get("isPrimary")==="on"})}catch(cause){return error(cause,"The course could not be mapped.")}
  revalidatePath("/training/competencies");return{status:"SUCCESS",message:"Course mapped to competency."};
}

export async function createCompetencyRequirement(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.MANAGE_TRAINING);const{organizationId,user}=await getCurrentUserTenant();
  try{const requiredLevel=required(data,"requiredLevel") as CompetencyProficiency;if(!Object.values(CompetencyProficiency).includes(requiredLevel))throw new Error("Select a valid required level.");const rawRole=optional(data,"role");const role=rawRole as UserRole|null;if(role&&!Object.values(UserRole).includes(role))throw new Error("Select a valid role.");await createCompetencyRequirementService({organizationId,userId:user.id,competencyId:required(data,"competencyId"),role,jobTitle:optional(data,"jobTitle"),siteId:optional(data,"siteId"),departmentId:optional(data,"departmentId"),requiredLevel,dueWithinDays:integer(data,"dueWithinDays"),isMandatory:data.get("isMandatory")==="on"})}catch(cause){return error(cause,"The competency requirement could not be created.")}
  revalidatePath("/training/competencies");revalidatePath("/training/competencies/matrix");return{status:"SUCCESS",message:"Competency requirement created."};
}

export async function submitCompetencyAssessment(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.MANAGE_TRAINING);const{organizationId,user}=await getCurrentUserTenant();
  try{const assessedLevel=required(data,"assessedLevel") as CompetencyProficiency,evidenceType=required(data,"evidenceType") as CompetencyEvidenceType;if(!Object.values(CompetencyProficiency).includes(assessedLevel)||!Object.values(CompetencyEvidenceType).includes(evidenceType))throw new Error("Select valid competency evidence values.");await submitCompetencyAssessmentService({organizationId,userId:user.id,learnerId:required(data,"learnerId"),competencyId:required(data,"competencyId"),assessedLevel,assessedAt:date(data,"assessedAt"),evidenceType,evidenceReference:optional(data,"evidenceReference"),notes:optional(data,"notes")})}catch(cause){return error(cause,"The competency evidence could not be submitted.")}
  revalidatePath("/training/competencies/matrix");return{status:"SUCCESS",message:"Competency evidence submitted for independent verification."};
}

export async function decideCompetencyAssessment(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.MANAGE_TRAINING);const{organizationId,user}=await getCurrentUserTenant();
  try{const decision=required(data,"decision");if(decision!=="VERIFIED"&&decision!=="REJECTED")throw new Error("Select a valid verification decision.");await decideCompetencyAssessmentService({organizationId,userId:user.id,assessmentId:required(data,"assessmentId"),decision,rejectionReason:optional(data,"rejectionReason")})}catch(cause){return error(cause,"The competency decision could not be recorded.")}
  revalidatePath("/training/competencies/matrix");revalidatePath("/training/dashboard");return{status:"SUCCESS",message:"Competency decision recorded."};
}
