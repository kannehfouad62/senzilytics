import { prisma } from "@/lib/prisma";
import { PermissionKey, UserRole } from "@prisma/client";

export type UnifiedCalendarSource = "COMPLIANCE_CALENDAR"|"COMPLIANCE_OBLIGATION"|"OBSERVATION"|"AUDIT"|"AUDIT_FINDING"|"INSPECTION"|"CAPA"|"TRAINING"|"PERMIT"|"RISK_REVIEW"|"MOC"|"WORKFLOW";
export type UnifiedCalendarItem = { id:string; source:UnifiedCalendarSource; sourceLabel:string; title:string; detail:string; date:Date; status:string; href:string; assignee:string; site:string|null; completed:boolean; overdue:boolean };
type Input={organizationId:string;userId:string;userRole:UserRole;permissions:PermissionKey[];start:Date;end:Date;mineOnly:boolean};
const doneStatuses=new Set(["COMPLETED","CLOSED","CANCELLED","APPROVED","VERIFIED","RESOLVED"]);
export const isUnifiedCalendarStatusComplete=(status:string)=>doneStatuses.has(status);
const openStatus=(status:string)=>!isUnifiedCalendarStatusComplete(status);
const item=(data:Omit<UnifiedCalendarItem,"overdue">):UnifiedCalendarItem=>({...data,overdue:data.date<new Date()&&!data.completed});

export async function getUnifiedCalendarItems(input:Input){
  const allowed=new Set(input.permissions), range={gte:input.start,lt:input.end}, mine=input.mineOnly;
  const canCapa=allowed.has(PermissionKey.CREATE_CAPA)||allowed.has(PermissionKey.UPDATE_CAPA)||allowed.has(PermissionKey.CLOSE_CAPA);
  const [calendar,obligations,observations,audits,findings,inspections,actions,training,permits,risks,mocTasks,workflowSteps]=await Promise.all([
    allowed.has(PermissionKey.VIEW_COMPLIANCE)?prisma.complianceCalendarOccurrence.findMany({where:{organizationId:input.organizationId,dueAt:range,...(mine?{assignedToId:input.userId}:{})},include:{task:true,site:true,assignedTo:true}}):[],
    allowed.has(PermissionKey.VIEW_COMPLIANCE)?prisma.complianceItem.findMany({where:{site:{organizationId:input.organizationId},dueDate:range,...(mine?{ownerId:input.userId}:{})},include:{site:true,owner:true}}):[],
    allowed.has(PermissionKey.VIEW_OBSERVATIONS)?prisma.safetyObservation.findMany({where:{organizationId:input.organizationId,followUpDueDate:range,...(mine?{assignedToId:input.userId}:{})},include:{site:true,assignedTo:true}}):[],
    allowed.has(PermissionKey.VIEW_AUDITS)?prisma.enterpriseAudit.findMany({where:{organizationId:input.organizationId,AND:[{OR:[{dueDate:range},{AND:[{dueDate:null},{scheduledAt:range}]}]},...(mine?[{OR:[{leadAuditorId:input.userId},{ownerId:input.userId},{teamMembers:{some:{userId:input.userId}}}]}]:[])]},include:{site:true,leadAuditor:true,owner:true}}):[],
    allowed.has(PermissionKey.VIEW_AUDITS)?prisma.enterpriseAuditFinding.findMany({where:{organizationId:input.organizationId,dueDate:range,...(mine?{ownerId:input.userId}:{})},include:{audit:true,owner:true}}):[],
    allowed.has(PermissionKey.VIEW_INSPECTIONS)?prisma.inspection.findMany({where:{site:{organizationId:input.organizationId},AND:[{OR:[{dueDate:range},{AND:[{dueDate:null},{scheduledAt:range}]}]},...(mine?[{OR:[{leadInspectorId:input.userId},{teamMembers:{some:{userId:input.userId}}}]}]:[])]},include:{site:true,leadInspector:true}}):[],
    canCapa?prisma.correctiveAction.findMany({where:{assignedTo:{organizationId:input.organizationId},dueDate:range,...(mine?{assignedToId:input.userId}:{})},include:{assignedTo:true}}):[],
    allowed.has(PermissionKey.VIEW_TRAINING)?prisma.trainingRecord.findMany({where:{user:{organizationId:input.organizationId},dueDate:range,...(mine?{userId:input.userId}:{})},include:{user:true}}):[],
    allowed.has(PermissionKey.VIEW_COMPLIANCE)?prisma.permit.findMany({where:{organizationId:input.organizationId,OR:[{renewalDueDate:range},{AND:[{renewalDueDate:null},{expirationDate:range}]}],...(mine?{ownerId:input.userId}:{})},include:{site:true,owner:true}}):[],
    allowed.has(PermissionKey.VIEW_RISKS)?prisma.risk.findMany({where:{organizationId:input.organizationId,nextReviewDate:range,...(mine?{ownerId:input.userId}:{})},include:{site:true,owner:true}}):[],
    allowed.has(PermissionKey.VIEW_MOC)?prisma.mocTask.findMany({where:{moc:{organizationId:input.organizationId},dueDate:range,...(mine?{assignedToId:input.userId}:{})},include:{moc:true,assignedTo:true}}):[],
    (mine||allowed.has(PermissionKey.MANAGE_WORKFLOWS))?prisma.workflowInstanceStep.findMany({where:{instance:{organizationId:input.organizationId},dueAt:range,...(mine?{OR:[{assignedUserId:input.userId},{assignedRole:input.userRole},{assignedUserId:null,assignedRole:null}]}:{})},include:{instance:{include:{template:true}},assignedUser:true}}):[],
  ]);
  const items:UnifiedCalendarItem[]=[];
items.push(...calendar.map(x=>item({id:`calendar:${x.id}`,source:"COMPLIANCE_CALENDAR",sourceLabel:"Compliance Calendar",title:x.task.title,detail:x.task.category.replaceAll("_"," "),date:x.dueAt,status:x.status,href:`/compliance/calendar/${x.id}`,assignee:x.assignedTo.name,site:x.site.name,completed:isUnifiedCalendarStatusComplete(x.status)})));
  items.push(...obligations.map(x=>item({id:`obligation:${x.id}`,source:"COMPLIANCE_OBLIGATION",sourceLabel:"Compliance Obligation",title:x.title,detail:x.reference||x.obligationType.replaceAll("_"," "),date:x.dueDate,status:x.status,href:`/compliance/${x.id}`,assignee:x.owner?.name||"Unassigned",site:x.site.name,completed:!openStatus(x.status)})));
  items.push(...observations.map(x=>item({id:`observation:${x.id}`,source:"OBSERVATION",sourceLabel:"Safety Observation",title:`${x.reference} — ${x.title}`,detail:`${x.riskLevel} follow-up`,date:x.followUpDueDate!,status:x.status,href:`/observations/${x.id}`,assignee:x.assignedTo?.name||"Unassigned",site:x.site.name,completed:!openStatus(x.status)})));
  items.push(...audits.map(x=>item({id:`audit:${x.id}`,source:"AUDIT",sourceLabel:"Audit",title:`${x.reference} — ${x.title}`,detail:"Audit execution milestone",date:x.dueDate??x.scheduledAt!,status:x.status,href:`/audits/${x.id}`,assignee:x.leadAuditor?.name||x.owner?.name||"Unassigned",site:x.site.name,completed:!openStatus(x.status)})));
  items.push(...findings.map(x=>item({id:`audit-finding:${x.id}`,source:"AUDIT_FINDING",sourceLabel:"Audit Finding",title:`${x.reference} — ${x.title}`,detail:`${x.severity} finding`,date:x.dueDate!,status:x.status,href:`/audits/${x.auditId}`,assignee:x.owner?.name||"Unassigned",site:null,completed:!openStatus(x.status)})));
  items.push(...inspections.map(x=>item({id:`inspection:${x.id}`,source:"INSPECTION",sourceLabel:"Inspection",title:`${x.reference?`${x.reference} — `:""}${x.title}`,detail:x.type.replaceAll("_"," "),date:x.dueDate??x.scheduledAt!,status:x.status,href:`/inspections/${x.id}`,assignee:x.leadInspector?.name||"Unassigned",site:x.site.name,completed:!openStatus(x.status)})));
  items.push(...actions.map(x=>item({id:`capa:${x.id}`,source:"CAPA",sourceLabel:"Corrective Action",title:x.title,detail:`${x.riskLevel} priority`,date:x.dueDate,status:x.status,href:"/capa",assignee:x.assignedTo.name,site:null,completed:!openStatus(x.status)})));
  items.push(...training.map(x=>item({id:`training:${x.id}`,source:"TRAINING",sourceLabel:"Training",title:x.courseName,detail:"Training assignment",date:x.dueDate!,status:x.status,href:"/training",assignee:x.user.name,site:null,completed:!openStatus(x.status)})));
  items.push(...permits.map(x=>item({id:`permit:${x.id}`,source:"PERMIT",sourceLabel:"Permit",title:`${x.number} — ${x.name}`,detail:x.renewalDueDate?"Renewal deadline":"Expiration date",date:x.renewalDueDate??x.expirationDate!,status:x.status,href:"/compliance/permits",assignee:x.owner?.name||"Unassigned",site:x.site.name,completed:!openStatus(x.status)})));
  items.push(...risks.map(x=>item({id:`risk:${x.id}`,source:"RISK_REVIEW",sourceLabel:"Risk Review",title:`${x.reference} — ${x.title}`,detail:`${x.currentRiskLevel} risk`,date:x.nextReviewDate!,status:x.status,href:`/risks/${x.id}`,assignee:x.owner?.name||"Unassigned",site:x.site?.name||null,completed:false})));
  items.push(...mocTasks.map(x=>item({id:`moc:${x.id}`,source:"MOC",sourceLabel:"MOC Task",title:x.title,detail:`${x.moc.reference} — ${x.moc.title}`,date:x.dueDate!,status:x.status,href:`/moc/${x.mocId}`,assignee:x.assignedTo?.name||"Unassigned",site:null,completed:!openStatus(x.status)})));
  items.push(...workflowSteps.map(x=>item({id:`workflow:${x.id}`,source:"WORKFLOW",sourceLabel:"Workflow",title:x.name,detail:x.instance.template.name,date:x.dueAt!,status:x.status,href:"/tasks",assignee:x.assignedUser?.name||x.assignedRole?.replaceAll("_"," ")||"Available role task",site:null,completed:!openStatus(x.status)})));
  return items.sort((a,b)=>a.date.getTime()-b.date.getTime());
}
