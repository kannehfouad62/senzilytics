import { ObservationCreateForm } from "@/features/observations/observation-create-form";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey, RiskLevel, SafetyObservationType } from "@prisma/client";
import { ConfigurableFormModule } from "@prisma/client";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";

export default async function NewObservationPage(){await requirePermission(PermissionKey.CREATE_OBSERVATION);const{organizationId}=await getCurrentUserTenant();const[sites,forms]=await Promise.all([prisma.site.findMany({where:{organizationId},select:{id:true,name:true},orderBy:{name:"asc"}}),getPublishedRuntimeForms(organizationId,ConfigurableFormModule.OBSERVATION)]);return <div className="mx-auto max-w-4xl"><p className="text-sm text-cyan-300">Proactive Safety</p><h1 className="mt-2 text-4xl font-bold">Report an Observation</h1><p className="mt-2 text-slate-400">Capture positive practices, unsafe acts, unsafe conditions, and environmental concerns before they become incidents.</p><ObservationCreateForm sites={sites} types={Object.values(SafetyObservationType)} riskLevels={Object.values(RiskLevel)} forms={forms}/></div>}
