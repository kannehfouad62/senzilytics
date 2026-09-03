import { get } from "@vercel/blob";
import { ResearchDatasetVersionStatus, ResearchVariableDataType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ResearchDataRow, ResearchValue, ResearchVariable } from "@/modules/research/research-analysis";
import { parseCsv } from "@/modules/research/research-import";

export async function getImportedAnalysisDataset(organizationId:string,versionId:string){
  const version=await prisma.researchDatasetVersion.findFirst({where:{id:versionId,organizationId,status:ResearchDatasetVersionStatus.APPROVED},include:{dataset:{include:{project:{include:{client:true}},variables:{orderBy:{position:"asc"}}}},analyses:{include:{analyst:{select:{name:true}},approvedBy:{select:{name:true}}},orderBy:{updatedAt:"desc"}}}});
  if(!version)return null;
  const stored=await get(version.storagePath,{access:"private"});
  if(!stored||stored.statusCode!==200||!stored.stream)throw new Error("The approved dataset version is unavailable.");
  const parsed=parseCsv(await new Response(stored.stream).text()),headers=parsed[0]??[],rawRows=parsed.slice(1);
  const dictionary=new Map(version.dataset.variables.map((item)=>[item.key,item]));
  const variables:ResearchVariable[]=headers.map((key,index)=>{const item=dictionary.get(key),values=rawRows.map((row)=>row[index]??"");return{id:item?.id??`${version.id}:${key}`,key,label:item?.label??key.replaceAll("_"," "),type:item?analysisType(item.dataType):inferType(values),required:false}});
  const rows:ResearchDataRow[]=rawRows.map((row,index)=>({assignmentId:`${version.id}:${index}`,responseId:`${version.id}:${index}`,submittedAt:version.createdAt.toISOString(),values:Object.fromEntries(variables.map((variable,column)=>[variable.key,coerce(row[column]??"",variable.type)]))}));
  return{version,variables,rows};
}

function analysisType(type:ResearchVariableDataType){return type===ResearchVariableDataType.NUMBER?"NUMBER":type===ResearchVariableDataType.BOOLEAN?"BOOLEAN":type===ResearchVariableDataType.DATE?"DATE":"TEXT"}
function inferType(values:string[]){const present=values.filter(Boolean);return present.length&&present.every((item)=>Number.isFinite(Number(item)))?"NUMBER":present.length&&present.every((item)=>/^(true|false)$/i.test(item))?"BOOLEAN":"TEXT"}
function coerce(raw:string,type:string):ResearchValue{if(raw==="")return null;if(type==="NUMBER"){const number=Number(raw);return Number.isFinite(number)?number:null}if(type==="BOOLEAN")return raw.toLowerCase()==="true";return raw}
