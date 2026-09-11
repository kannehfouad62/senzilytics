import { ActivityAction, ConfigurableFormVersionStatus, NotificationType, ResearchClientReviewArtifactType, ResearchClientReviewStatus, ResearchDashboardStatus, ResearchReportStatus, ResearchSamplingDesignStatus } from "@prisma/client";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";

export async function listEligibleClientReviewArtifacts(organizationId:string,projectId:string){
  const project=await prisma.researchProject.findFirst({where:{id:projectId,organizationId,clientId:{not:null}}});
  if(!project)throw new Error("A commissioned research project is required for client review.");
  const[questionnaires,samplingDesigns,dashboards,reports]=await Promise.all([
    prisma.researchQuestionnaire.findMany({where:{organizationId,projectId,isActive:true,formDefinition:{versions:{some:{status:ConfigurableFormVersionStatus.PUBLISHED}}}},select:{id:true,name:true}}),
    prisma.researchSamplingDesign.findMany({where:{organizationId,projectId,status:ResearchSamplingDesignStatus.APPROVED},select:{id:true,name:true,version:true}}),
    prisma.researchVisualizationDashboard.findMany({where:{organizationId,projectId,status:ResearchDashboardStatus.APPROVED},select:{id:true,title:true}}),
    prisma.researchReport.findMany({where:{organizationId,projectId,status:{in:[ResearchReportStatus.APPROVED,ResearchReportStatus.PUBLISHED]}},select:{id:true,reference:true,title:true,version:true}}),
  ]);
  return[
    ...questionnaires.map(item=>({id:item.id,type:ResearchClientReviewArtifactType.QUESTIONNAIRE,title:item.name})),
    ...samplingDesigns.map(item=>({id:item.id,type:ResearchClientReviewArtifactType.SAMPLING_DESIGN,title:`${item.name} v${item.version}`})),
    ...dashboards.map(item=>({id:item.id,type:ResearchClientReviewArtifactType.DASHBOARD,title:item.title})),
    ...reports.map(item=>({id:item.id,type:ResearchClientReviewArtifactType.REPORT,title:`${item.reference} — ${item.title} v${item.version}`})),
  ];
}

export async function submitClientReviewRequestService(input:{organizationId:string;actorId:string;projectId:string;artifactType:ResearchClientReviewArtifactType;artifactId:string;instructions?:string|null;dueAt?:Date|null}){
  const artifacts=await listEligibleClientReviewArtifacts(input.organizationId,input.projectId),artifact=artifacts.find(item=>item.id===input.artifactId&&item.type===input.artifactType);
  if(!artifact)throw new Error("The selected artifact is not approved or published for client review.");
  if(input.dueAt&&input.dueAt<=new Date())throw new Error("Client review due date must be in the future.");
  const request=await prisma.researchClientReviewRequest.upsert({where:{projectId_artifactType_artifactId:{projectId:input.projectId,artifactType:input.artifactType,artifactId:input.artifactId}},update:{artifactTitle:artifact.title,status:ResearchClientReviewStatus.PENDING_REVIEW,instructions:input.instructions||null,dueAt:input.dueAt||null,requestedById:input.actorId,submittedAt:new Date(),decidedById:null,decidedAt:null,acceptedAt:null},create:{organizationId:input.organizationId,projectId:input.projectId,artifactType:input.artifactType,artifactId:input.artifactId,artifactTitle:artifact.title,instructions:input.instructions||null,dueAt:input.dueAt||null,requestedById:input.actorId}});
  const recipients=await prisma.researchClientPortalProjectAccess.findMany({where:{projectId:input.projectId,access:{organizationId:input.organizationId,status:"ACTIVE",OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]}},select:{access:{select:{userId:true}}}});
  await Promise.all(recipients.map(({access})=>createNotification({organizationId:input.organizationId,userId:access.userId,type:NotificationType.ASSIGNMENT,title:"Research deliverable ready for client review",message:artifact.title,link:`/research/client-portal/projects/${input.projectId}`})));
  await logActivity({organizationId:input.organizationId,userId:input.actorId,action:ActivityAction.CREATE,entityType:"ResearchClientReviewRequest",entityId:request.id,title:"Client review requested",description:artifact.title,metadata:{projectId:input.projectId,artifactType:input.artifactType,artifactId:input.artifactId}});
  return request;
}

export function listProjectClientReviews(organizationId:string,projectId:string){return prisma.researchClientReviewRequest.findMany({where:{organizationId,projectId},include:{requestedBy:{select:{name:true}},decidedBy:{select:{name:true}},comments:{include:{user:{select:{name:true}}},orderBy:{createdAt:"asc"}}},orderBy:{updatedAt:"desc"}})}

export async function listClientAccessibleReviews(organizationId:string,userId:string,projectId:string){const access=await prisma.researchClientPortalProjectAccess.findFirst({where:{projectId,access:{organizationId,userId,status:"ACTIVE",OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]}}});if(!access)return[];return prisma.researchClientReviewRequest.findMany({where:{organizationId,projectId,status:{not:ResearchClientReviewStatus.WITHDRAWN}},include:{comments:{include:{user:{select:{name:true}}},orderBy:{createdAt:"asc"}}},orderBy:{updatedAt:"desc"}})}

export async function recordClientReviewDecisionService(input:{organizationId:string;userId:string;projectId:string;requestId:string;decision:"COMMENT"|"REQUEST_REVISION"|"APPROVE"|"ACCEPT";comment:string}){
  const access=await prisma.researchClientPortalProjectAccess.findFirst({where:{projectId:input.projectId,access:{organizationId:input.organizationId,userId:input.userId,status:"ACTIVE",OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]}}});
  if(!access)throw new Error("Active project-specific client access is required.");
  const request=await prisma.researchClientReviewRequest.findFirst({where:{id:input.requestId,organizationId:input.organizationId,projectId:input.projectId}});
  if(!request)throw new Error("Client review request not found.");
  if(input.comment.length<2||input.comment.length>4000)throw new Error("Enter a comment between 2 and 4,000 characters.");
  const transitions:Record<typeof input.decision,ResearchClientReviewStatus|null>={COMMENT:null,REQUEST_REVISION:ResearchClientReviewStatus.REVISION_REQUESTED,APPROVE:ResearchClientReviewStatus.APPROVED,ACCEPT:ResearchClientReviewStatus.ACCEPTED};
  const target=transitions[input.decision];
  if(input.decision==="REQUEST_REVISION"&&request.status!==ResearchClientReviewStatus.PENDING_REVIEW)throw new Error("Only a pending review can receive a revision request.");
  if(input.decision==="APPROVE"&&request.status!==ResearchClientReviewStatus.PENDING_REVIEW)throw new Error("Only a pending review can be approved.");
  if(input.decision==="ACCEPT"&&request.status!==ResearchClientReviewStatus.APPROVED)throw new Error("Client approval is required before final acceptance.");
  if(input.decision==="COMMENT"&&(request.status===ResearchClientReviewStatus.ACCEPTED||request.status===ResearchClientReviewStatus.WITHDRAWN))throw new Error("Closed client reviews cannot receive comments.");
  const now=new Date();
  await prisma.$transaction(async tx=>{await tx.researchClientReviewComment.create({data:{organizationId:input.organizationId,requestId:request.id,userId:input.userId,body:input.comment}});if(target)await tx.researchClientReviewRequest.update({where:{id:request.id},data:{status:target,decidedById:input.userId,decidedAt:now,acceptedAt:target===ResearchClientReviewStatus.ACCEPTED?now:null}})});
  await createNotification({organizationId:input.organizationId,userId:(await prisma.researchProject.findUniqueOrThrow({where:{id:input.projectId},select:{projectManagerId:true}})).projectManagerId,type:NotificationType.INFO,title:`Client review: ${input.decision.toLowerCase().replace("_"," ")}`,message:request.artifactTitle,link:`/research/projects/${input.projectId}/client-review`});
  await logActivity({organizationId:input.organizationId,userId:input.userId,action:target?ActivityAction.STATUS_CHANGE:ActivityAction.UPDATE,entityType:"ResearchClientReviewRequest",entityId:request.id,title:"Client review response recorded",description:`${request.artifactTitle} — ${input.decision}`,metadata:{projectId:input.projectId,decision:input.decision}});
}
