import { EmergencyDrillScheduleForm } from "@/features/emergency/emergency-forms";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { EmergencyPlanStatus, PermissionKey } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NewEmergencyDrillPage() {
  await requirePermission(PermissionKey.MANAGE_EMERGENCY_PREPAREDNESS);
  const { organizationId } = await getCurrentUserTenant();
  const [plans, users] = await Promise.all([
    prisma.emergencyPlan.findMany({ where: { organizationId, status: EmergencyPlanStatus.ACTIVE }, select: { id: true, reference: true, version: true, title: true, scenarios: { where: { isActive: true }, select: { id: true, title: true }, orderBy: { sequence: "asc" } } }, orderBy: { title: "asc" } }),
    prisma.user.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const options = plans.map((plan) => ({ id: plan.id, name: `${plan.reference} v${plan.version} — ${plan.title}`, scenarios: plan.scenarios.map((scenario) => ({ id: scenario.id, name: scenario.title })) }));
  return <div className="mx-auto max-w-5xl"><Link href="/emergency" className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16} />Back to Emergency Readiness</Link><h1 className="mt-6 text-4xl font-bold">Schedule Emergency Exercise</h1><p className="mt-2 text-slate-400">Exercise an approved plan and record measurable objectives, response timing, gaps, and after-action improvements.</p>{options.length ? <EmergencyDrillScheduleForm plans={options} users={users} /> : <p className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5 text-amber-100">An active emergency plan is required before an exercise can be scheduled.</p>}</div>;
}
