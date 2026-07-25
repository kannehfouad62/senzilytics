import { ContinuityActivationForm } from "@/features/continuity/continuity-forms";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { ContinuityPlanStatus, EmergencyActivationStatus, PermissionKey } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NewContinuityActivationPage() {
  await requirePermission(PermissionKey.RECORD_CONTINUITY_EVENT);
  const { organizationId } = await getCurrentUserTenant();
  const [plans, users, emergencies] = await Promise.all([
    prisma.businessContinuityPlan.findMany({ where: { organizationId, status: ContinuityPlanStatus.ACTIVE }, select: { id: true, reference: true, version: true, title: true }, orderBy: { title: "asc" } }),
    prisma.user.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.emergencyActivation.findMany({ where: { organizationId, status: { not: EmergencyActivationStatus.REVIEWED } }, select: { id: true, reference: true, location: true }, orderBy: { declaredAt: "desc" }, take: 50 }),
  ]);
  const options = plans.map((plan) => ({ id: plan.id, name: `${plan.reference} v${plan.version} — ${plan.title}` }));
  return <div className="mx-auto max-w-5xl"><Link href="/business-continuity" className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16} />Back to Business Resilience</Link><h1 className="mt-6 text-4xl font-bold">Record Continuity Activation</h1><p className="mt-2 text-slate-400">Open a governed recovery record for a disruption affecting critical products, services, facilities, technology, people or suppliers.</p>{options.length ? <ContinuityActivationForm plans={options} users={users} emergencyActivations={emergencies.map((item) => ({ id: item.id, name: `${item.reference} — ${item.location}` }))} /> : <p className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5 text-amber-100">An active business continuity plan is required before a disruption can be recorded.</p>}</div>;
}
