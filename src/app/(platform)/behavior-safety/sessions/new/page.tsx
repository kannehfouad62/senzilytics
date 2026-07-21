import { BehaviorSessionCreateForm } from "@/features/behavior-safety/behavior-safety-forms";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import { BehaviorProgramStatus, ConfigurableFormModule, PermissionKey } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function NewBehaviorSessionPage({ searchParams }: { searchParams: Promise<{ programId?: string }> }) {
  await requirePermission(PermissionKey.RECORD_BEHAVIOR_COACHING); const [{ organizationId }, query] = await Promise.all([getCurrentUserTenant(), searchParams]); const programId = String(query.programId || "");
  const [program, departments, users, forms] = await Promise.all([prisma.behaviorSafetyProgram.findFirst({ where: { id: programId, organizationId, status: BehaviorProgramStatus.ACTIVE }, include: { behaviors: { where: { isActive: true }, orderBy: [{ sequence: "asc" }, { title: "asc" }] } } }), prisma.department.findMany({ where: { site: { organizationId } }, include: { site: true }, orderBy: { name: "asc" } }), prisma.user.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }), getPublishedRuntimeForms(organizationId, ConfigurableFormModule.BEHAVIOR_SAFETY)]);
  if (!program) notFound(); const availableSites = program.siteId ? await prisma.site.findMany({ where: { id: program.siteId, organizationId }, select: { id: true, name: true } }) : await prisma.site.findMany({ where: { organizationId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return <div><Link href={`/behavior-safety/programs/${program.id}`} className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16} />{program.name}</Link><h1 className="mt-6 text-4xl font-bold">Record Coaching Session</h1><p className="mt-2 text-slate-400">Capture observable facts and constructive discussion. Participant identity is optional and can be withheld.</p><BehaviorSessionCreateForm programId={program.id} sites={availableSites} departments={departments.filter(department => !program.departmentId || department.id === program.departmentId).map(department => ({ id: department.id, name: department.name, siteName: department.site.name }))} users={users} behaviors={program.behaviors} forms={forms} /></div>;
}
