import { prisma } from "@/lib/prisma";
import { ConfigurableFieldType, ConfigurableFormModule, ConfigurableFormVersionStatus, Prisma } from "@prisma/client";

export const slugifyFormName=(value:string)=>value.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80);
export const parseOptionList=(value:string)=>[...new Set(value.split(/\r?\n|,/).map(item=>item.trim()).filter(Boolean))];
export const isOptionField=(type:ConfigurableFieldType)=>type===ConfigurableFieldType.SINGLE_SELECT||type===ConfigurableFieldType.MULTI_SELECT;

export async function createFormDefinition(input:{organizationId:string;userId:string;name:string;description:string|null;module:ConfigurableFormModule}){
  const slug=slugifyFormName(input.name);if(!slug)throw new Error("Enter a form name containing letters or numbers.");
  if(await prisma.configurableFormDefinition.findUnique({where:{organizationId_slug:{organizationId:input.organizationId,slug}},select:{id:true}}))throw new Error("A form with this name already exists.");
  return prisma.configurableFormDefinition.create({data:{organizationId:input.organizationId,createdById:input.userId,name:input.name,slug,description:input.description,module:input.module,versions:{create:{version:1,createdById:input.userId}}},include:{versions:true}});
}

export async function addDraftField(input:{organizationId:string;versionId:string;label:string;key:string;fieldType:ConfigurableFieldType;description:string|null;placeholder:string|null;required:boolean;options:string[];visibilityField:string|null;visibilityValue:string|null}){
  const version=await prisma.configurableFormVersion.findFirst({where:{id:input.versionId,definition:{organizationId:input.organizationId}},include:{fields:{orderBy:{sequence:"desc"}}}});
  if(!version)throw new Error("Form version not found.");if(version.status!==ConfigurableFormVersionStatus.DRAFT)throw new Error("Published versions are immutable. Create a new draft revision first.");
  const key=slugifyFormName(input.key||input.label).replaceAll("-","_");if(!key)throw new Error("Enter a valid field key.");
  if(isOptionField(input.fieldType)&&input.options.length<2)throw new Error("Select fields require at least two options.");
  if(input.visibilityField&&!version.fields.some(field=>field.key===input.visibilityField))throw new Error("The conditional field key must reference an existing field in this draft.");
  const visibilityRule=input.visibilityField&&input.visibilityValue?{fieldKey:input.visibilityField,operator:"EQUALS",value:input.visibilityValue}:Prisma.JsonNull;
  return prisma.configurableFormField.create({data:{versionId:version.id,label:input.label,key,fieldType:input.fieldType,description:input.description,placeholder:input.placeholder,isRequired:input.required,sequence:(version.fields[0]?.sequence??0)+1,options:isOptionField(input.fieldType)?input.options:Prisma.JsonNull,visibilityRule}});
}

export async function deleteDraftField(input:{organizationId:string;fieldId:string}){
  const field=await prisma.configurableFormField.findFirst({where:{id:input.fieldId,version:{definition:{organizationId:input.organizationId}}},include:{version:true}});
  if(!field)throw new Error("Field not found.");if(field.version.status!==ConfigurableFormVersionStatus.DRAFT)throw new Error("Published fields cannot be deleted.");
  await prisma.configurableFormField.delete({where:{id:field.id}});
  return field.version.definitionId;
}

export async function publishFormVersion(input:{organizationId:string;versionId:string;userId:string}){
  const version=await prisma.configurableFormVersion.findFirst({where:{id:input.versionId,definition:{organizationId:input.organizationId}},include:{fields:true}});
  if(!version)throw new Error("Form version not found.");if(version.status!==ConfigurableFormVersionStatus.DRAFT)throw new Error("Only a draft can be published.");if(!version.fields.length)throw new Error("Add at least one field before publishing.");
  await prisma.$transaction([prisma.configurableFormVersion.updateMany({where:{definitionId:version.definitionId,status:ConfigurableFormVersionStatus.PUBLISHED},data:{status:ConfigurableFormVersionStatus.ARCHIVED}}),prisma.configurableFormVersion.update({where:{id:version.id},data:{status:ConfigurableFormVersionStatus.PUBLISHED,publishedAt:new Date(),publishedById:input.userId}})]);
  return version.definitionId;
}

export async function createDraftRevision(input:{organizationId:string;definitionId:string;userId:string}){
  const definition=await prisma.configurableFormDefinition.findFirst({where:{id:input.definitionId,organizationId:input.organizationId},include:{versions:{include:{fields:true},orderBy:{version:"desc"}}}});
  if(!definition)throw new Error("Form not found.");const existingDraft=definition.versions.find(v=>v.status===ConfigurableFormVersionStatus.DRAFT);if(existingDraft)return existingDraft;
  const source=definition.versions[0];if(!source)throw new Error("No source version is available.");
  return prisma.configurableFormVersion.create({data:{definitionId:definition.id,version:source.version+1,createdById:input.userId,instructions:source.instructions,fields:{create:source.fields.map(field=>({key:field.key,label:field.label,description:field.description,placeholder:field.placeholder,fieldType:field.fieldType,sequence:field.sequence,isRequired:field.isRequired,options:field.options??Prisma.JsonNull,validation:field.validation??Prisma.JsonNull,visibilityRule:field.visibilityRule??Prisma.JsonNull}))}}});
}
