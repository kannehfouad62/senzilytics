import { ResearchProjectForm } from "@/features/research/research-forms";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey, ResearchClientStatus } from "@prisma/client";
import { ArrowLeft, FlaskConical } from "lucide-react";
import Link from "next/link";

export default async function NewResearchProjectPage(){await requirePermission(PermissionKey.CREATE_RESEARCH_PROJECT);const {organizationId}=await getCurrentUserTenant();const [users,clients]=await Promise.all([prisma.user.findMany({where:{organizationId,isActive:true},select:{id:true,name:true,jobTitle:true},orderBy:{name:"asc"}}),prisma.researchClient.findMany({where:{organizationId,status:ResearchClientStatus.ACTIVE},select:{id:true,name:true},orderBy:{name:"asc"}})]);return <div className="mx-auto max-w-6xl"><Link href="/research/projects" className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16}/>Research project register</Link><div className="mt-6"><p className="flex items-center gap-2 text-sm text-cyan-300"><FlaskConical size={17}/>Governed Research Planning</p><h1 className="mt-2 text-4xl font-bold">Create research project</h1><p className="mt-2 max-w-3xl text-slate-400">Define research purpose, commissioning client, legal data ownership, accountable leadership, methodology and privacy controls before collection begins.</p></div><div className="mt-8"><ResearchProjectForm users={users} clients={clients}/></div></div>}
