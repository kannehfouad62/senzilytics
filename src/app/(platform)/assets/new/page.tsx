import { AssetCreateForm } from "@/features/assets/asset-forms";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NewAssetPage() {
  await requirePermission(PermissionKey.MANAGE_ASSETS); const { organizationId } = await getCurrentUserTenant();
  const [sites, departments, users] = await Promise.all([
    prisma.site.findMany({ where: { organizationId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { site: { organizationId } }, select: { id: true, name: true, siteId: true, site: { select: { name: true } } }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return <div><Link href="/assets" className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16} />Back to Asset Register</Link><h1 className="mt-6 text-4xl font-bold">Register an Asset</h1><p className="mt-2 text-slate-400">Define ownership, safety criticality, inspection frequency, and preventive-maintenance requirements.</p><AssetCreateForm sites={sites} departments={departments.map(department => ({ id: department.id, name: department.name, siteId: department.siteId, siteName: department.site.name }))} users={users} /></div>;
}
