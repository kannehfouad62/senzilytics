import { OfflineObservationForm } from "@/features/offline/offline-observation-form";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";

export default async function FieldCollectionPage(){await requirePermission(PermissionKey.CREATE_OBSERVATION);const{organizationId}=await getCurrentUserTenant();const sites=await prisma.site.findMany({where:{organizationId},select:{id:true,name:true},orderBy:{name:"asc"}});return <div className="mx-auto max-w-5xl"><p className="text-sm text-cyan-300">Online + Offline</p><h1 className="mt-2 text-4xl font-bold">Field Data Collection</h1><p className="mt-2 mb-8 max-w-3xl text-slate-400">Capture safety observations with or without connectivity. Records synchronize automatically and use unique submission IDs to prevent duplicates.</p><OfflineObservationForm sites={sites}/></div>}
