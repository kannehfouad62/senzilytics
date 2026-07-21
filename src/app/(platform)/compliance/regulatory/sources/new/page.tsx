import { RegulatorySourceCreateForm } from "@/features/compliance/regulatory-intelligence-forms";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NewRegulatorySourcePage() {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE); const { organizationId } = await getCurrentUserTenant();
  const users = await prisma.user.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return <div className="mx-auto max-w-5xl"><Link href="/compliance/regulatory" className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16} />Regulatory Intelligence</Link><h1 className="mt-6 text-4xl font-bold">Register Regulatory Source</h1><p className="mt-2 text-slate-400">Register an authoritative publication endpoint and assign a recurring human monitoring review.</p><div className="mt-8"><RegulatorySourceCreateForm users={users} /></div></div>;
}
