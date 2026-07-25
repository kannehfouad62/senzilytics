import { ContinuityPlanForm } from "@/features/continuity/continuity-forms";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import { ConfigurableFormModule, PermissionKey } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NewContinuityPlanPage() {
  await requirePermission(PermissionKey.MANAGE_BUSINESS_CONTINUITY);
  const { organizationId } = await getCurrentUserTenant();
  const [sites, departments, users, forms] = await Promise.all([
    prisma.site.findMany({ where: { organizationId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { site: { organizationId } }, select: { id: true, name: true, siteId: true, site: { select: { name: true } } }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getPublishedRuntimeForms(organizationId, ConfigurableFormModule.BUSINESS_CONTINUITY),
  ]);
  return <div className="mx-auto max-w-6xl"><Link href="/business-continuity" className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16} />Back to Business Resilience</Link><h1 className="mt-6 text-4xl font-bold">Create Continuity Plan</h1><p className="mt-2 text-slate-400">Create a controlled draft, then document at least one critical business impact analysis before approval.</p><ContinuityPlanForm sites={sites} departments={departments.map((item) => ({ id: item.id, name: item.name, siteId: item.siteId, siteName: item.site.name }))} users={users} forms={forms} /></div>;
}
