import { OfflineObservationForm } from "@/features/offline/offline-observation-form";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";
import { hasSubscriptionFeature } from "@/lib/subscription";
import { redirect } from "next/navigation";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import { ConfigurableFormModule } from "@prisma/client";

export default async function FieldCollectionPage(){await requirePermission(PermissionKey.CREATE_OBSERVATION);const{organizationId}=await getCurrentUserTenant();if(!await hasSubscriptionFeature(organizationId,"OFFLINE_COLLECTION"))redirect("/subscription?feature=offline");const[sites,forms]=await Promise.all([prisma.site.findMany({where:{organizationId},select:{id:true,name:true},orderBy:{name:"asc"}}),getPublishedRuntimeForms(organizationId,ConfigurableFormModule.OBSERVATION)]);return <div className="mx-auto max-w-5xl"><p className="text-sm text-cyan-300">Online + Offline</p><h1 className="mt-2 text-4xl font-bold">Field Data Collection</h1><p className="mt-2 mb-8 max-w-3xl text-slate-400">Capture safety observations and published organization-specific fields with or without connectivity. Records synchronize automatically and use unique submission IDs to prevent duplicates.</p><OfflineObservationForm sites={sites} forms={forms}/></div>}
