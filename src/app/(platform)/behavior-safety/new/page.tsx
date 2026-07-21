import { BehaviorProgramCreateForm } from "@/features/behavior-safety/behavior-safety-forms";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NewBehaviorProgramPage() {
  await requirePermission(PermissionKey.MANAGE_BEHAVIOR_SAFETY); const { organizationId } = await getCurrentUserTenant();
  const [sites, departments, users] = await Promise.all([prisma.site.findMany({ where: { organizationId }, select: { id: true, name: true }, orderBy: { name: "asc" } }), prisma.department.findMany({ where: { site: { organizationId } }, include: { site: true }, orderBy: { name: "asc" } }), prisma.user.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })]);
  return <div><Link href="/behavior-safety" className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16} />Behavior-Based Safety</Link><h1 className="mt-6 text-4xl font-bold">Create Behavior-Safety Program</h1><p className="mt-2 text-slate-400">Define program ownership, operational scope, engagement targets, and review cadence before adding observable behaviors.</p><BehaviorProgramCreateForm sites={sites} departments={departments.map(department => ({ id: department.id, name: department.name, siteName: department.site.name }))} users={users} /></div>;
}
