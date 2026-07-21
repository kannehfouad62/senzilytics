import { RegulatoryChangeCreateForm } from "@/features/compliance/regulatory-intelligence-forms";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import { ConfigurableFormModule, PermissionKey, RegulatorySourceStatus } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NewRegulatoryChangePage() {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE); const { organizationId } = await getCurrentUserTenant();
  const [sources, users, forms] = await Promise.all([
    prisma.regulatorySource.findMany({ where: { organizationId, status: RegulatorySourceStatus.ACTIVE }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getPublishedRuntimeForms(organizationId, ConfigurableFormModule.REGULATORY_INTELLIGENCE),
  ]);
  return <div><Link href="/compliance/regulatory" className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16} />Regulatory Intelligence</Link><h1 className="mt-6 text-4xl font-bold">Record Regulatory Change</h1><p className="mt-2 max-w-3xl text-slate-400">Capture the official publication and source citation. Applicability remains unconfirmed until a human impact assessment is approved.</p><RegulatoryChangeCreateForm sources={sources.map(source => ({ id: source.id, name: `${source.code} — ${source.name}` }))} users={users} forms={forms} /></div>;
}
