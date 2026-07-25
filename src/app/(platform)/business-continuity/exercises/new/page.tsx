import { ContinuityExerciseScheduleForm } from "@/features/continuity/continuity-forms";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { ContinuityPlanStatus, PermissionKey } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NewContinuityExercisePage() {
  await requirePermission(PermissionKey.MANAGE_BUSINESS_CONTINUITY);
  const { organizationId } = await getCurrentUserTenant();
  const [plans, users] = await Promise.all([
    prisma.businessContinuityPlan.findMany({ where: { organizationId, status: ContinuityPlanStatus.ACTIVE }, select: { id: true, reference: true, version: true, title: true, businessImpactAnalyses: { where: { isActive: true }, select: { id: true, reference: true, processName: true }, orderBy: { processName: "asc" } } }, orderBy: { title: "asc" } }),
    prisma.user.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const options = plans.map((plan) => ({ id: plan.id, name: `${plan.reference} v${plan.version} — ${plan.title}`, analyses: plan.businessImpactAnalyses.map((analysis) => ({ id: analysis.id, name: `${analysis.reference} — ${analysis.processName}` })) }));
  return <div className="mx-auto max-w-5xl"><Link href="/business-continuity" className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16} />Back to Business Resilience</Link><h1 className="mt-6 text-4xl font-bold">Schedule Continuity Exercise</h1><p className="mt-2 text-slate-400">Test an approved plan and measure whether critical processes can recover within their objectives.</p>{options.length ? <ContinuityExerciseScheduleForm plans={options} users={users} /> : <p className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5 text-amber-100">An active continuity plan is required before an exercise can be scheduled.</p>}</div>;
}
