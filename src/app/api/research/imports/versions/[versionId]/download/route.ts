import { get } from "@vercel/blob";
import { PermissionKey, ResearchDatasetVersionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(_request:Request,{params}:{params:Promise<{versionId:string}>}){
  await requirePermission(PermissionKey.EXPORT_RESEARCH_OUTPUTS);
  const [{versionId},{organizationId}]=await Promise.all([params,getCurrentUserTenant()]);
  const version=await prisma.researchDatasetVersion.findFirst({where:{id:versionId,organizationId,status:{in:[ResearchDatasetVersionStatus.APPROVED,ResearchDatasetVersionStatus.SUPERSEDED]}},include:{dataset:{select:{name:true}}}});
  if(!version)return NextResponse.json({error:"Approved dataset version not found."},{status:404});
  const stored=await get(version.storagePath,{access:"private"});
  if(!stored||stored.statusCode!==200||!stored.stream)return NextResponse.json({error:"The stored dataset version is unavailable."},{status:404});
  const name=version.dataset.name.replace(/[\r\n"]/g,"").replace(/[^\w.\- ()]/g,"_").slice(0,140);
  return new NextResponse(stored.stream,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${name}-v${version.version}.csv"`,"X-Content-Type-Options":"nosniff","Cache-Control":"private, no-store"}});
}
