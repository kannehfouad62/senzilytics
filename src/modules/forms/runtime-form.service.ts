import { prisma } from "@/lib/prisma";
import {
  ConfigurableFieldType,
  ConfigurableFormModule,
  ConfigurableFormVersionStatus,
  ConfigurableSubmissionStatus,
  DocumentEntityType,
  Prisma,
} from "@prisma/client";

type RuntimeRule={fieldKey:string;operator:"EQUALS";value:string};
type RuntimeField={id:string;key:string;label:string;fieldType:ConfigurableFieldType;isRequired:boolean;options:Prisma.JsonValue|null;visibilityRule:Prisma.JsonValue|null};
export type RuntimeForm={id:string;name:string;description:string|null;version:{id:string;version:number;instructions:string|null;fields:Array<RuntimeField&{description:string|null;placeholder:string|null;sequence:number}>}};
export type PreparedSubmission={definitionId:string;versionId:string;status:ConfigurableSubmissionStatus;answers:Array<{fieldId:string;value:Prisma.InputJsonValue}>};
export type CapturedRuntimeForm={definitionId:string;versionId:string;answers:Array<{fieldId:string;value:unknown}>};

const fieldName=(fieldId:string)=>`custom_${fieldId}`;
const asRule=(value:Prisma.JsonValue|null):RuntimeRule|null=>{if(!value||Array.isArray(value)||typeof value!=="object")return null;const rule=value as Record<string,unknown>;return typeof rule.fieldKey==="string"&&rule.operator==="EQUALS"&&typeof rule.value==="string"?rule as RuntimeRule:null};
export function isRuntimeFieldVisible(ruleValue:Prisma.JsonValue|null,answers:Map<string,unknown>){const rule=asRule(ruleValue);if(!rule)return true;const actual=answers.get(rule.fieldKey);return Array.isArray(actual)?actual.map(String).includes(rule.value):String(actual??"")===rule.value}
export function runtimeRequiredFileIds(fields:RuntimeField[],answers:Map<string,unknown>){return fields.filter(field=>field.fieldType===ConfigurableFieldType.FILE&&field.isRequired&&isRuntimeFieldVisible(field.visibilityRule,answers)).map(field=>field.id)}
export function runtimeSubmissionStatus(fields:RuntimeField[],answers:Map<string,unknown>){return runtimeRequiredFileIds(fields,answers).length?ConfigurableSubmissionStatus.DRAFT:ConfigurableSubmissionStatus.SUBMITTED}

export function configurableFormModuleForDocumentEntity(
  entityType: DocumentEntityType
): ConfigurableFormModule | null {
  switch (entityType) {
    case DocumentEntityType.SAFETY_OBSERVATION:
      return ConfigurableFormModule.OBSERVATION;
    case DocumentEntityType.INCIDENT:
      return ConfigurableFormModule.INCIDENT;
    case DocumentEntityType.INSPECTION:
      return ConfigurableFormModule.INSPECTION;
    case DocumentEntityType.RISK:
      return ConfigurableFormModule.RISK;
    case DocumentEntityType.MOC:
      return ConfigurableFormModule.MOC;
    case DocumentEntityType.CORRECTIVE_ACTION:
      return ConfigurableFormModule.CAPA;
    case DocumentEntityType.COMPLIANCE:
      return ConfigurableFormModule.COMPLIANCE;
    case DocumentEntityType.TRAINING:
      return ConfigurableFormModule.TRAINING;
    case DocumentEntityType.CHEMICAL:
      return ConfigurableFormModule.CHEMICAL;
    case DocumentEntityType.ENVIRONMENTAL:
      return ConfigurableFormModule.ENVIRONMENTAL;
    case DocumentEntityType.ESG:
      return ConfigurableFormModule.ESG;
    case DocumentEntityType.CONTRACTOR:
      return ConfigurableFormModule.CONTRACTOR;
    case DocumentEntityType.PERMIT_TO_WORK:
      return ConfigurableFormModule.PERMIT_TO_WORK;
    case DocumentEntityType.INDUSTRIAL_HYGIENE:
      return ConfigurableFormModule.INDUSTRIAL_HYGIENE;
    case DocumentEntityType.SIF_ASSURANCE:
      return ConfigurableFormModule.SIF_ASSURANCE;
    default:
      return null;
  }
}
const optionsOf=(value:Prisma.JsonValue|null)=>Array.isArray(value)?value.filter((item):item is string=>typeof item==="string"):[];
const empty=(value:unknown)=>value===null||value===undefined||value===""||(Array.isArray(value)&&value.length===0);

function readValue(field:RuntimeField,data:FormData):unknown{
  const name=fieldName(field.id);
  if(field.fieldType===ConfigurableFieldType.MULTI_SELECT)return data.getAll(name).map(String).map(x=>x.trim()).filter(Boolean);
  if(field.fieldType===ConfigurableFieldType.BOOLEAN)return data.get(name)==="on";
  const entry=data.get(name);if(entry instanceof File)return entry.size?entry:null;
  return String(entry??"").trim();
}

function validateValue(field:RuntimeField,value:unknown):Prisma.InputJsonValue|undefined{
  if(field.fieldType===ConfigurableFieldType.FILE)return undefined;
  if(empty(value)){if(field.isRequired)throw new Error(`${field.label} is required.`);return undefined}
  if(field.fieldType===ConfigurableFieldType.BOOLEAN){if(field.isRequired&&value!==true)throw new Error(`${field.label} must be acknowledged.`);return Boolean(value)}
  if(field.fieldType===ConfigurableFieldType.NUMBER){const number=Number(value);if(!Number.isFinite(number))throw new Error(`${field.label} must be a valid number.`);return number}
  if(field.fieldType===ConfigurableFieldType.EMAIL&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)))throw new Error(`${field.label} must be a valid email address.`);
  if(field.fieldType===ConfigurableFieldType.DATE&&!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))throw new Error(`${field.label} must be a valid date.`);
  if(field.fieldType===ConfigurableFieldType.DATETIME&&Number.isNaN(new Date(String(value)).getTime()))throw new Error(`${field.label} must be a valid date and time.`);
  if(field.fieldType===ConfigurableFieldType.SINGLE_SELECT&&!optionsOf(field.options).includes(String(value)))throw new Error(`Select a valid option for ${field.label}.`);
  if(field.fieldType===ConfigurableFieldType.MULTI_SELECT){const selected=value as string[],options=optionsOf(field.options);if(selected.some(item=>!options.includes(item)))throw new Error(`Select valid options for ${field.label}.`);return selected}
  return String(value);
}

export async function getPublishedRuntimeForms(organizationId:string,module:ConfigurableFormModule):Promise<RuntimeForm[]>{
  const definitions=await prisma.configurableFormDefinition.findMany({where:{organizationId,module,isActive:true},include:{versions:{where:{status:ConfigurableFormVersionStatus.PUBLISHED},orderBy:{version:"desc"},take:1,include:{fields:{orderBy:{sequence:"asc"}}}}},orderBy:{name:"asc"}});
  return definitions.flatMap(definition=>definition.versions[0]?[{id:definition.id,name:definition.name,description:definition.description,version:definition.versions[0]}]:[]);
}

export async function preparePublishedFormSubmissions(input:{organizationId:string;module:ConfigurableFormModule;data:FormData}){
  const forms=await getPublishedRuntimeForms(input.organizationId,input.module);const prepared:PreparedSubmission[]=[];
  for(const form of forms){const raw=new Map<string,unknown>();for(const field of form.version.fields)raw.set(field.key,readValue(field,input.data));const answers:PreparedSubmission["answers"]=[];for(const field of form.version.fields){if(!isRuntimeFieldVisible(field.visibilityRule,raw))continue;const value=validateValue(field,raw.get(field.key));if(value!==undefined)answers.push({fieldId:field.id,value})}prepared.push({definitionId:form.id,versionId:form.version.id,status:runtimeSubmissionStatus(form.version.fields,raw),answers})}
  return prepared;
}

export async function prepareCapturedFormSubmissions(input:{organizationId:string;module:ConfigurableFormModule;capturedAt:Date;forms:CapturedRuntimeForm[]}){
  if(!input.forms.length)return [];
  if(new Set(input.forms.map(form=>form.definitionId)).size!==input.forms.length)throw new Error("A captured custom form is duplicated.");
  const versions=await prisma.configurableFormVersion.findMany({where:{id:{in:input.forms.map(form=>form.versionId)},definition:{organizationId:input.organizationId,module:input.module},status:{in:[ConfigurableFormVersionStatus.PUBLISHED,ConfigurableFormVersionStatus.ARCHIVED]},publishedAt:{lte:input.capturedAt}},include:{definition:true,fields:{orderBy:{sequence:"asc"}}}});
  if(versions.length!==input.forms.length)throw new Error("One or more captured form versions are not valid for this tenant.");
  const prepared:PreparedSubmission[]=[];
  for(const captured of input.forms){const version=versions.find(item=>item.id===captured.versionId&&item.definitionId===captured.definitionId);if(!version)throw new Error("A captured form does not match its published version.");const byId=new Map(captured.answers.map(answer=>[answer.fieldId,answer.value]));if(captured.answers.some(answer=>!version.fields.some(field=>field.id===answer.fieldId)))throw new Error("A captured answer does not belong to its form version.");const raw=new Map(version.fields.map(field=>[field.key,byId.get(field.id)]));const answers:PreparedSubmission["answers"]=[];for(const field of version.fields){if(!isRuntimeFieldVisible(field.visibilityRule,raw))continue;const value=validateValue(field,raw.get(field.key));if(value!==undefined)answers.push({fieldId:field.id,value})}prepared.push({definitionId:version.definitionId,versionId:version.id,status:runtimeSubmissionStatus(version.fields,raw),answers})}
  return prepared;
}

export async function createPreparedSubmissions(tx:Prisma.TransactionClient,input:{organizationId:string;userId:string;module:ConfigurableFormModule;entityId:string;submissions:PreparedSubmission[]}){
  for(const submission of input.submissions)await tx.configurableFormSubmission.create({data:{organizationId:input.organizationId,definitionId:submission.definitionId,versionId:submission.versionId,entityType:input.module,entityId:input.entityId,submittedById:input.userId,status:submission.status,answers:{create:submission.answers}}});
}

export const configurableFieldInputName=fieldName;
