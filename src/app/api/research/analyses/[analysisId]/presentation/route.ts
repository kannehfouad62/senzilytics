import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { createResearchPresentation, type SlideElement } from "@/modules/research/research-presentation";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{analysisId:string}>}){
  await requirePermission(PermissionKey.EXPORT_RESEARCH_OUTPUTS);
  const [{analysisId},{organizationId}]=await Promise.all([params,getCurrentUserTenant()]);
  const analysis=await prisma.researchAnalysis.findFirst({where:{id:analysisId,organizationId},include:{collection:{include:{project:true}},datasetVersion:{include:{dataset:{include:{project:true}}}},analyst:{select:{name:true}},approvedBy:{select:{name:true}}}});
  if(!analysis)return new Response("Analysis not found.",{status:404});
  const project=analysis.collection?.project??analysis.datasetVersion?.dataset.project;
  if(!project)return new Response("Analysis source not found.",{status:404});
  const source=analysis.collection?`Collection: ${analysis.collection.name}`:`Imported dataset: ${analysis.datasetVersion?.dataset.name} v${analysis.datasetVersion?.version}`;
  const title:SlideElement[]=[{x:.7,y:.7,w:10,h:.4,text:"SENZILYTICS GOVERNED MODEL",size:13,color:"67E8F9",bold:true},{x:.7,y:1.5,w:11.5,h:.8,text:analysis.title,size:30,bold:true},{x:.7,y:2.6,w:11,h:.4,text:`${project.reference} · ${analysis.method.replaceAll("_"," ")} · v${analysis.version}`,size:16,color:"94A3B8"},{x:.7,y:3.3,w:11,h:.4,text:source,size:14,color:"94A3B8"},{x:.7,y:4,w:10,h:.4,text:`Analytical population: ${analysis.datasetResponseCount}`,size:16,color:"CBD5E1"},{x:.7,y:4.6,w:10,h:.4,text:`Governance status: ${analysis.status}`,size:16,color:"CBD5E1"}];
  const results:SlideElement[]=[{x:.7,y:.5,w:11,h:.5,text:"Model Results & Diagnostics",size:26,bold:true},...lines(analysis.resultSnapshot).slice(0,14).map((text,index)=>({x:.8+(index%2)*6,y:1.4+Math.floor(index/2)*.68,w:5.5,h:.38,text,size:12,color:"CBD5E1"}))];
  const governance:SlideElement[]=[{x:.7,y:.5,w:11,h:.5,text:"Governance & Interpretation",size:26,bold:true},{x:.8,y:1.3,w:11,h:.5,text:`Source: ${source}`,size:15,color:"CBD5E1"},{x:.8,y:1.9,w:11,h:.5,text:`Sampling design: ${analysis.samplingDesignId??"Not specified"}`,size:13,color:"94A3B8"},{x:.8,y:2.5,w:11,h:.5,text:`Analyst: ${analysis.analyst.name??"Assigned analyst"}`,size:16,color:"CBD5E1"},{x:.8,y:3.1,w:11,h:.5,text:`Approved by: ${analysis.approvedBy?.name??"Pending independent approval"}`,size:16,color:"CBD5E1"},{x:.8,y:3.7,w:11,h:.8,text:`Hypothesis: ${analysis.hypothesis??"Not recorded"}`,size:14,color:"CBD5E1"},{x:.8,y:4.7,w:11,h:1.1,text:`Methodology: ${analysis.methodologyNotes??"Not recorded"}`,size:14,color:"CBD5E1"},{x:.8,y:6.2,w:11,h:.4,text:"Model outputs require qualified review of assumptions, diagnostics, bias and practical significance.",size:10,color:"64748B"}];
  const output=await createResearchPresentation([title,results,governance]);return new Response(new Uint8Array(output),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.presentationml.presentation","Content-Disposition":`attachment; filename="${project.reference}-model-v${analysis.version}.pptx"`,"Cache-Control":"private, no-store"}})
}
function lines(value:unknown,path="result"):string[]{if(value===null||value===undefined)return[];if(typeof value!=="object")return[`${path.replaceAll("."," › ")}: ${typeof value==="number"?Number(value.toFixed(4)):value}`];return(Array.isArray(value)?value.map((item,index)=>[String(index),item]as const):Object.entries(value)).flatMap(([key,item])=>lines(item,`${path}.${key}`))}
