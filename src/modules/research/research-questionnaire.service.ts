import { ActivityAction, ConfigurableFormModule, ConfigurableFormVersionStatus, Prisma, ResearchProjectStatus, ResearchResponseIdentityMode } from "@prisma/client";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { prisma } from "@/lib/prisma";
import { slugifyFormName } from "@/modules/forms/configurable-form.service";

export function listResearchQuestionnaires(
  organizationId: string,
  projectId: string,
) {
  return prisma.researchQuestionnaire.findMany({
    where: { organizationId, projectId },
    include: {
      formDefinition: {
        include: {
          versions: {
            select: { id: true, version: true, status: true, publishedAt: true },
            orderBy: { version: "desc" },
          },
          _count: { select: { submissions: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function listResearchQuestionnaireTemplates(organizationId:string){
  return prisma.configurableFormVersion.findMany({where:{status:ConfigurableFormVersionStatus.PUBLISHED,definition:{organizationId,module:ConfigurableFormModule.RESEARCH,researchQuestionnaire:{is:{isActive:true}}}},select:{id:true,version:true,definition:{select:{name:true,description:true,researchQuestionnaire:{select:{project:{select:{reference:true,title:true}}}}}},_count:{select:{fields:true}}},orderBy:{publishedAt:"desc"},take:100});
}

export async function createResearchQuestionnaireService(input:{organizationId:string;userId:string;projectId:string;name:string;purpose:string;targetAudience?:string|null;identityMode:ResearchResponseIdentityMode;defaultLanguage:string;consentStatement?:string|null;templateVersionId?:string|null}){
  const project=await prisma.researchProject.findFirst({where:{id:input.projectId,organizationId:input.organizationId,status:{notIn:[ResearchProjectStatus.COMPLETED,ResearchProjectStatus.CANCELLED,ResearchProjectStatus.ARCHIVED]}}});
  if(!project)throw new Error("Editable research project not found.");
  if(input.purpose.trim().length<10)throw new Error("Questionnaire purpose must contain at least 10 characters.");
  if(project.consentRequired&&!input.consentStatement?.trim())throw new Error("This research project requires a participant consent statement.");
  const base=slugifyFormName(`${project.reference}-${input.name}`);if(!base)throw new Error("Enter a questionnaire name containing letters or numbers.");
  const slug=`research-${base}`.slice(0,80);
  const duplicate=await prisma.configurableFormDefinition.findUnique({where:{organizationId_slug:{organizationId:input.organizationId,slug}},select:{id:true}});if(duplicate)throw new Error("A questionnaire with this project and name already exists.");
  const template=input.templateVersionId?await prisma.configurableFormVersion.findFirst({where:{id:input.templateVersionId,status:ConfigurableFormVersionStatus.PUBLISHED,definition:{organizationId:input.organizationId,module:ConfigurableFormModule.RESEARCH}},include:{fields:{orderBy:{sequence:"asc"}},definition:{select:{name:true}}}}):null;
  if(input.templateVersionId&&!template)throw new Error("The selected questionnaire template is unavailable for this organization.");
  const questionnaire=await prisma.$transaction(async tx=>{const form=await tx.configurableFormDefinition.create({data:{organizationId:input.organizationId,createdById:input.userId,name:input.name,slug,description:input.purpose,module:ConfigurableFormModule.RESEARCH,versions:{create:{version:1,createdById:input.userId,instructions:input.consentStatement,fields:template?{create:template.fields.map(field=>({key:field.key,label:field.label,description:field.description,placeholder:field.placeholder,fieldType:field.fieldType,sequence:field.sequence,isRequired:field.isRequired,options:field.options??Prisma.JsonNull,validation:field.validation??Prisma.JsonNull,visibilityRule:field.visibilityRule??Prisma.JsonNull}))}:undefined}}}});return tx.researchQuestionnaire.create({data:{organizationId:input.organizationId,projectId:input.projectId,formDefinitionId:form.id,name:input.name,purpose:input.purpose,targetAudience:input.targetAudience,identityMode:input.identityMode,defaultLanguage:input.defaultLanguage.toLowerCase().slice(0,12)||"en",consentStatement:input.consentStatement},include:{formDefinition:true}})});
  await logActivity({organizationId:input.organizationId,userId:input.userId,action:ActivityAction.CREATE,entityType:"ResearchQuestionnaire",entityId:questionnaire.id,title:template?"Research questionnaire created from template":"Research questionnaire created",description:`${project.reference} — ${questionnaire.name}`,metadata:{projectId:project.id,formDefinitionId:questionnaire.formDefinitionId,identityMode:questionnaire.identityMode,templateVersionId:template?.id??null,templateName:template?.definition.name??null}});
  return questionnaire;
}
