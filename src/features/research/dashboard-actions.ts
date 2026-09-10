"use server";

import{ActivityAction,PermissionKey,ResearchDashboardStatus}from"@prisma/client";
import{revalidatePath}from"next/cache";
import type{FormActionState}from"@/core/actions/action-state";
import{logActivity}from"@/core/activity-log/activity-log.service";
import{getCurrentUserPermissions,requirePermission}from"@/lib/permissions";
import{prisma}from"@/lib/prisma";
import{getCurrentUserTenant}from"@/lib/tenant";
import{normalizeDashboardBranding,normalizeDashboardLayout}from"@/modules/research/research-dashboard";

const text=(data:FormData,key:string,maximum=2000)=>String(data.get(key)??"").trim().slice(0,maximum);
const failure=(cause:unknown):FormActionState=>({status:"ERROR",message:cause instanceof Error?cause.message:"The visualization dashboard could not be updated."});
const refresh=(projectId:string)=>{revalidatePath(`/research/projects/${projectId}`);revalidatePath(`/research/projects/${projectId}/dashboards`);revalidatePath("/research","layout")};

export async function createResearchDashboard(_state:FormActionState,data:FormData):Promise<FormActionState>{
  await requirePermission(PermissionKey.RUN_RESEARCH_ANALYSIS);const{organizationId,user}=await getCurrentUserTenant();
  try{const projectId=text(data,"projectId",100),title=text(data,"title",160),description=text(data,"description",1000),analysisIds=[...new Set(data.getAll("analysisIds").map(String).filter(Boolean))].slice(0,12);if(!title)throw new Error("Enter a dashboard title.");if(!analysisIds.length)throw new Error("Select at least one saved analysis.");
    const project=await prisma.researchProject.findFirst({where:{id:projectId,organizationId},include:{client:true}});if(!project)throw new Error("Research project not found.");
    const analyses=await prisma.researchAnalysis.findMany({where:{organizationId,id:{in:analysisIds},OR:[{collection:{projectId}},{datasetVersion:{dataset:{projectId}}}]},select:{id:true,title:true}});if(analyses.length!==analysisIds.length)throw new Error("One or more analyses are outside this governed research project.");
    const allowed=new Set(analyses.map(item=>item.id)),layout=normalizeDashboardLayout({columns:Number(text(data,"columns",1)),widgets:analyses.map(item=>({analysisId:item.id,title:item.title,width:text(data,"layout",10)==="FULL"?"FULL":"HALF",annotation:text(data,"annotation",1000),referenceLine:Number.isFinite(Number(text(data,"referenceLine",100)))&&text(data,"referenceLine",100)!==""?Number(text(data,"referenceLine",100)):undefined}))},allowed),branding=normalizeDashboardBranding({brandName:text(data,"brandName",120),primaryColor:text(data,"primaryColor",7),accentColor:text(data,"accentColor",7),footerText:text(data,"footerText",240)},project.client?.name??project.title);
    const dashboard=await prisma.researchVisualizationDashboard.create({data:{organizationId,projectId,title,description:description||null,layoutDefinition:JSON.parse(JSON.stringify(layout)),branding:JSON.parse(JSON.stringify(branding)),createdById:user.id}});
    await logActivity({organizationId,userId:user.id,action:ActivityAction.CREATE,entityType:"ResearchVisualizationDashboard",entityId:dashboard.id,title:"Research dashboard created",description:dashboard.title,metadata:{projectId,widgetCount:layout.widgets.length}});refresh(projectId);return{status:"SUCCESS",message:"Visualization dashboard saved as a governed draft."};
  }catch(cause){return failure(cause)}
}

export async function changeResearchDashboardStatus(_state:FormActionState,data:FormData):Promise<FormActionState>{
  const[{organizationId,user},permissions]=await Promise.all([getCurrentUserTenant(),getCurrentUserPermissions()]);if(!permissions.includes(PermissionKey.RUN_RESEARCH_ANALYSIS))throw new Error("Research analysis permission is required.");
  try{const dashboardId=text(data,"dashboardId",100),target=text(data,"status",40)as ResearchDashboardStatus,dashboard=await prisma.researchVisualizationDashboard.findFirst({where:{id:dashboardId,organizationId}});if(!dashboard)throw new Error("Visualization dashboard not found.");const allowed:Record<ResearchDashboardStatus,ResearchDashboardStatus[]>={DRAFT:[ResearchDashboardStatus.UNDER_REVIEW],UNDER_REVIEW:[ResearchDashboardStatus.DRAFT,ResearchDashboardStatus.APPROVED],APPROVED:[ResearchDashboardStatus.ARCHIVED],ARCHIVED:[]};if(!allowed[dashboard.status].includes(target))throw new Error(`Dashboard cannot move from ${dashboard.status} to ${target}.`);if(target===ResearchDashboardStatus.APPROVED){if(!permissions.includes(PermissionKey.APPROVE_RESEARCH_OUTPUTS))throw new Error("Research output approval permission is required.");if(dashboard.createdById===user.id)throw new Error("Independent approval is required; the dashboard creator cannot approve it.");}
    await prisma.researchVisualizationDashboard.update({where:{id:dashboard.id},data:{status:target,approvedById:target===ResearchDashboardStatus.APPROVED?user.id:dashboard.approvedById,approvedAt:target===ResearchDashboardStatus.APPROVED?new Date():dashboard.approvedAt}});await logActivity({organizationId,userId:user.id,action:ActivityAction.STATUS_CHANGE,entityType:"ResearchVisualizationDashboard",entityId:dashboard.id,title:"Research dashboard status changed",description:`${dashboard.status} → ${target}`,metadata:{projectId:dashboard.projectId}});refresh(dashboard.projectId);return{status:"SUCCESS",message:"Dashboard governance status updated."};
  }catch(cause){return failure(cause)}
}
