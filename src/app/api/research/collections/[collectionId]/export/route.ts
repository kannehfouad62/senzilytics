import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";
export const runtime="nodejs";export const dynamic="force-dynamic";
const cell=(value:unknown)=>{let text=Array.isArray(value)?value.join(" | "):String(value??"");if(/^[=+\-@\t\r]/.test(text))text=`'${text}`;return `"${text.replaceAll('"','""')}"`};
export async function GET(_request:Request,{params}:{params:Promise<{collectionId:string}>}){
  await requirePermission(PermissionKey.EXPORT_RESEARCH_OUTPUTS);
  const[{collectionId},{organizationId}]=await Promise.all([params,getCurrentUserTenant()]);
  const collection=await prisma.researchCollectionWave.findFirst({where:{id:collectionId,organizationId},include:{project:{include:{client:true}},questionnaire:true,formVersion:{include:{fields:{orderBy:{sequence:"asc"}}}},assignments:{where:{status:"COMPLETED",submissionId:{not:null}},include:{respondent:{select:{name:true,email:true}},submission:{include:{answers:true}}},orderBy:{completedAt:"asc"}}}});
  if(!collection)return new Response("Collection not found.",{status:404});
  const headers=["response_id","project_reference","project_title","client","collection","questionnaire_version","respondent","respondent_email","submitted_at",...collection.formVersion.fields.map(f=>f.key)];
  const rows=collection.assignments.map(a=>{const answers=new Map(a.submission?.answers.map(x=>[x.fieldId,x.value])??[]),identified=collection.questionnaire.identityMode==="IDENTIFIED",pseudonymized=collection.questionnaire.identityMode==="PSEUDONYMIZED";return[a.submissionId,collection.project.reference,collection.project.title,collection.project.client?.name??"Internal",collection.name,collection.formVersion.version,identified?a.respondent.name:pseudonymized?`RESP-${a.id.slice(-8).toUpperCase()}`:"",identified?a.respondent.email:"",a.completedAt?.toISOString()??"",...collection.formVersion.fields.map(f=>answers.get(f.id)??"")]});
  const csv=[headers,...rows].map(row=>row.map(cell).join(",")).join("\n");
  return new Response(`\uFEFF${csv}`,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${collection.project.reference}-${collection.name.replace(/[^a-z0-9]+/gi,"-").toLowerCase()}-dataset.csv"`,"Cache-Control":"private, no-store"}});
}
