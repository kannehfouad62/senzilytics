import { logActivity } from "@/core/activity-log/activity-log.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import { preparePublishedFormVersionSubmission } from "@/modules/forms/runtime-form.service";
import { ActivityAction, ConfigurableFormModule, ConfigurableFormVersionStatus, NotificationType, PermissionKey, ResearchAssignmentStatus, ResearchCollectionStatus, ResearchProjectStatus, UserRole } from "@prisma/client";
import { assertResearchCollectionTransition } from "@/modules/research/research-governance";

const activeProjectStatuses=[ResearchProjectStatus.ACTIVE,ResearchProjectStatus.DATA_COLLECTION] as const;

export async function createResearchCollection(input:{organizationId:string;userId:string;projectId:string;questionnaireId:string;name:string;opensAt:Date|null;closesAt:Date|null;dueAt:Date|null;targetResponseCount:number|null;instructions:string|null}){
  if(input.opensAt&&input.closesAt&&input.closesAt<=input.opensAt)throw new Error("Collection closing time must be after its opening time.");
  if(input.targetResponseCount!==null&&(!Number.isInteger(input.targetResponseCount)||input.targetResponseCount<1))throw new Error("Target responses must be a positive whole number.");
  const questionnaire=await prisma.researchQuestionnaire.findFirst({where:{id:input.questionnaireId,projectId:input.projectId,organizationId:input.organizationId,isActive:true,project:{status:{in:[...activeProjectStatuses]}},formDefinition:{isActive:true}},include:{project:true,formDefinition:{include:{versions:{where:{status:ConfigurableFormVersionStatus.PUBLISHED},orderBy:{version:"desc"},take:1}}}}});
  const version=questionnaire?.formDefinition.versions[0];
  if(!questionnaire||!version)throw new Error("An active project and published questionnaire version are required before launching collection.");
  const collection=await prisma.researchCollectionWave.create({data:{organizationId:input.organizationId,projectId:input.projectId,questionnaireId:input.questionnaireId,formVersionId:version.id,name:input.name.trim(),opensAt:input.opensAt,closesAt:input.closesAt,assignmentDueAt:input.dueAt,targetResponseCount:input.targetResponseCount,instructions:input.instructions,createdById:input.userId}});
  await logActivity({organizationId:input.organizationId,userId:input.userId,action:ActivityAction.CREATE,entityType:"ResearchCollectionWave",entityId:collection.id,title:"Research collection wave created",description:`${questionnaire.project.reference} — ${collection.name}`,metadata:{questionnaireId:questionnaire.id,formVersionId:version.id}});
  return collection;
}

export async function assignResearchRespondent(input:{organizationId:string;actorId:string;collectionId:string;respondentId:string;dueAt:Date|null}){
  const [collection,respondent]=await Promise.all([
    prisma.researchCollectionWave.findFirst({where:{id:input.collectionId,organizationId:input.organizationId,status:{in:[ResearchCollectionStatus.DRAFT,ResearchCollectionStatus.ACTIVE,ResearchCollectionStatus.PAUSED]}},include:{project:true,questionnaire:true}}),
    prisma.user.findFirst({where:{id:input.respondentId,organizationId:input.organizationId,isActive:true}}),
  ]);
  if(!collection)throw new Error("Editable collection wave not found.");if(!respondent)throw new Error("The selected respondent is invalid.");
  if(respondent.role!==UserRole.SUPER_ADMIN&&!await prisma.rolePermission.findUnique({where:{role_permission:{role:respondent.role,permission:PermissionKey.COLLECT_RESEARCH_DATA}}}))throw new Error("The selected user does not have research data-collection permission.");
  const existing=await prisma.researchQuestionnaireAssignment.findUnique({where:{collectionId_respondentId:{collectionId:collection.id,respondentId:respondent.id}}});
  if(existing?.status===ResearchAssignmentStatus.COMPLETED)throw new Error("A completed questionnaire assignment cannot be reassigned.");
  const assignment=await prisma.researchQuestionnaireAssignment.upsert({where:{collectionId_respondentId:{collectionId:collection.id,respondentId:respondent.id}},update:{dueAt:input.dueAt??collection.assignmentDueAt,status:ResearchAssignmentStatus.ASSIGNED,revokedAt:null},create:{organizationId:input.organizationId,collectionId:collection.id,respondentId:respondent.id,assignedById:input.actorId,dueAt:input.dueAt??collection.assignmentDueAt}});
  await createNotification({organizationId:input.organizationId,userId:respondent.id,type:NotificationType.ASSIGNMENT,title:"Research questionnaire assigned",message:`${collection.project.reference} — ${collection.questionnaire.name}`,link:`/research/my-questionnaires/${assignment.id}`});
  await logActivity({organizationId:input.organizationId,userId:input.actorId,action:ActivityAction.ASSIGN,entityType:"ResearchQuestionnaireAssignment",entityId:assignment.id,title:"Research respondent assigned",description:`${respondent.name} — ${collection.name}`});
  return assignment;
}

export async function setResearchCollectionStatus(input:{organizationId:string;actorId:string;collectionId:string;status:ResearchCollectionStatus}){
  const collection=await prisma.researchCollectionWave.findFirst({where:{id:input.collectionId,organizationId:input.organizationId},include:{_count:{select:{assignments:true}}}});if(!collection)throw new Error("Collection wave not found.");
  assertResearchCollectionTransition(collection.status,input.status);
  if(input.status===ResearchCollectionStatus.ACTIVE&&collection._count.assignments===0)throw new Error("Assign at least one respondent before activating collection.");
  const now=new Date();const updated=await prisma.researchCollectionWave.update({where:{id:collection.id},data:{status:input.status,activatedAt:input.status===ResearchCollectionStatus.ACTIVE?collection.activatedAt??now:collection.activatedAt,closedAt:input.status===ResearchCollectionStatus.CLOSED?now:null}});
  await logActivity({organizationId:input.organizationId,userId:input.actorId,action:ActivityAction.UPDATE,entityType:"ResearchCollectionWave",entityId:collection.id,title:"Research collection status changed",description:`${collection.status} → ${updated.status}`});return updated;
}

export async function submitAssignedResearchQuestionnaire(input:{organizationId:string;userId:string;assignmentId:string;consent:boolean;data:FormData}){
  const assignment=await prisma.researchQuestionnaireAssignment.findFirst({where:{id:input.assignmentId,organizationId:input.organizationId,respondentId:input.userId,status:{in:[ResearchAssignmentStatus.ASSIGNED,ResearchAssignmentStatus.IN_PROGRESS]},collection:{status:ResearchCollectionStatus.ACTIVE}},include:{collection:{include:{questionnaire:true}}}});
  if(!assignment)throw new Error("This questionnaire assignment is not open for collection.");
  const now=new Date();if(assignment.collection.opensAt&&assignment.collection.opensAt>now)throw new Error("This collection wave has not opened yet.");if(assignment.collection.closesAt&&assignment.collection.closesAt<now)throw new Error("This collection wave has closed.");
  if(assignment.collection.questionnaire.consentStatement&&!input.consent)throw new Error("Participant consent is required.");
  const prepared=await preparePublishedFormVersionSubmission({organizationId:input.organizationId,definitionId:assignment.collection.questionnaire.formDefinitionId,versionId:assignment.collection.formVersionId,module:ConfigurableFormModule.RESEARCH,data:input.data});
  if(prepared.status!=="SUBMITTED")throw new Error("Research questionnaires with required file fields are not supported in this collection release.");
  const submission=await prisma.$transaction(async tx=>{const created=await tx.configurableFormSubmission.create({data:{organizationId:input.organizationId,definitionId:prepared.definitionId,versionId:prepared.versionId,entityType:ConfigurableFormModule.RESEARCH,entityId:assignment.id,submittedById:input.userId,status:prepared.status,answers:{create:prepared.answers}}});await tx.researchQuestionnaireAssignment.update({where:{id:assignment.id},data:{status:ResearchAssignmentStatus.COMPLETED,startedAt:assignment.startedAt??now,completedAt:now,submissionId:created.id}});return created});
  await logActivity({organizationId:input.organizationId,userId:input.userId,action:ActivityAction.CREATE,entityType:"ResearchResponse",entityId:submission.id,title:"Research questionnaire submitted",description:assignment.collection.questionnaire.name,metadata:{assignmentId:assignment.id,collectionId:assignment.collectionId}});return submission;
}

export function getMyResearchAssignments(organizationId:string,userId:string){return prisma.researchQuestionnaireAssignment.findMany({where:{organizationId,respondentId:userId},include:{collection:{include:{project:{select:{id:true,reference:true,title:true}},questionnaire:true}}},orderBy:[{status:"asc"},{dueAt:"asc"},{createdAt:"desc"}]});}

export function getResearchCollection(organizationId:string,collectionId:string){return prisma.researchCollectionWave.findFirst({where:{id:collectionId,organizationId},include:{project:{include:{client:true}},questionnaire:true,formVersion:{include:{fields:{orderBy:{sequence:"asc"}}}},assignments:{include:{respondent:{select:{id:true,name:true,email:true}},submission:{select:{id:true,submittedAt:true}}},orderBy:[{status:"asc"},{dueAt:"asc"}]}}});}
