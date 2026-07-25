import {
  BusinessImpactAnalysisForm,
  BusinessImpactAnalysisAvailabilityForm,
  ContinuityDependencyAvailabilityForm,
  ContinuityDependencyForm,
  ContinuityImprovementCapaForm,
  ContinuityImprovementForm,
  ContinuityImprovementLifecycleForm,
  ContinuityPlanForm,
  ContinuityPlanGovernanceForm,
} from "@/features/continuity/continuity-forms";
import { EntityCustomFormSubmissions } from "@/features/forms/entity-custom-form-submissions";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { hasSubscriptionFeature } from "@/lib/subscription";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  ConfigurableFormModule,
  ContinuityImprovementStatus,
  ContinuityPlanStatus,
  DocumentEntityType,
  PermissionKey,
} from "@prisma/client";
import { ArrowLeft, Network, RefreshCw } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

const editable = new Set<ContinuityPlanStatus>([ContinuityPlanStatus.DRAFT, ContinuityPlanStatus.REJECTED]);
const activeImprovements = new Set<ContinuityImprovementStatus>([
  ContinuityImprovementStatus.OPEN,
  ContinuityImprovementStatus.IN_PROGRESS,
  ContinuityImprovementStatus.COMPLETED,
]);

export default async function ContinuityPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PermissionKey.VIEW_BUSINESS_CONTINUITY);
  const [{ id }, { organizationId, user }, permissions] = await Promise.all([
    params,
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const canManage = permissions.includes(PermissionKey.MANAGE_BUSINESS_CONTINUITY);
  const canRecord = permissions.includes(PermissionKey.RECORD_CONTINUITY_EVENT);
  const canCapa = permissions.includes(PermissionKey.CREATE_CAPA);
  const [plan, sites, departments, users, uploadEnabled] = await Promise.all([
    prisma.businessContinuityPlan.findFirst({
      where: { id, organizationId },
      include: {
        site: true,
        department: true,
        owner: true,
        createdBy: true,
        submittedBy: true,
        approvedBy: true,
        previousVersion: { select: { id: true, version: true } },
        revisions: { select: { id: true, version: true, status: true }, orderBy: { version: "asc" } },
        businessImpactAnalyses: {
          include: { owner: true, dependencies: { orderBy: [{ isActive: "desc" }, { type: "asc" }, { name: "asc" }] } },
          orderBy: [{ criticality: "asc" }, { processName: "asc" }],
        },
        exercises: { include: { lead: true }, orderBy: { scheduledAt: "desc" } },
        activations: { include: { coordinator: true }, orderBy: { declaredAt: "desc" } },
        improvements: { include: { owner: true, correctiveAction: true }, orderBy: { dueAt: "asc" } },
      },
    }),
    prisma.site.findMany({ where: { organizationId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { site: { organizationId } }, select: { id: true, name: true, siteId: true, site: { select: { name: true } } }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    hasSubscriptionFeature(organizationId, "DOCUMENT_UPLOAD"),
  ]);
  if (!plan) notFound();
  const improvements = plan.improvements.filter((item) => activeImprovements.has(item.status));
  return <div>
    <Link href="/business-continuity" className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16} />Back to Business Resilience</Link>
    <div className="mt-6 flex flex-wrap items-start justify-between gap-5"><div>
      <p className="flex items-center gap-2 text-sm text-cyan-300"><RefreshCw size={17} />{plan.reference} · Version {plan.version}</p>
      <h1 className="mt-2 text-4xl font-bold">{plan.title}</h1>
      <p className="mt-2 text-slate-400">{pretty(plan.type)} · {plan.site?.name ?? "Organization-wide"}{plan.department ? ` · ${plan.department.name}` : ""}</p>
    </div><span className="rounded-full border border-white/10 px-4 py-2 text-sm">{pretty(plan.status)}</span></div>
    <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="Owner" value={plan.owner.name} /><Metric label="Review due" value={plan.reviewDueAt.toLocaleDateString()} danger={plan.reviewDueAt < new Date()} /><Metric label="Active BIAs" value={String(plan.businessImpactAnalyses.filter((item) => item.isActive).length)} /><Metric label="Exercises" value={String(plan.exercises.length)} /><Metric label="Open improvements" value={String(improvements.length)} />
    </div>
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">Controlled recovery strategy</h2><dl className="mt-5 grid gap-5 md:grid-cols-2">
      <Detail label="Scope" value={plan.scope} /><Detail label="Critical activities" value={plan.criticalActivitiesSummary} /><Detail label="Activation criteria" value={plan.activationCriteria} /><Detail label="Governance" value={plan.governanceStructure} /><Detail label="Communications" value={plan.communicationStrategy} /><Detail label="Alternate work" value={plan.alternateWorkStrategy} /><Detail label="Technology recovery" value={plan.technologyRecoveryStrategy} /><Detail label="Supplier continuity" value={plan.supplierContinuityStrategy} /><Detail label="Manual workarounds" value={plan.manualWorkarounds} /><Detail label="Recovery priorities" value={plan.recoveryPriorities} />
    </dl><div className="mt-5 border-t border-white/10 pt-4 text-xs text-slate-500">Created by {plan.createdBy.name}. {plan.submittedAt ? `Submitted ${plan.submittedAt.toLocaleString()} by ${plan.submittedBy?.name ?? "Unknown"}.` : ""} {plan.approvedAt ? `Approved ${plan.approvedAt.toLocaleString()} by ${plan.approvedBy?.name ?? "Unknown"}.` : ""}</div></section>
    {canManage && editable.has(plan.status) ? <ContinuityPlanForm sites={sites} departments={departments.map((item) => ({ id: item.id, name: item.name, siteId: item.siteId, siteName: item.site.name }))} users={users} plan={{ id: plan.id, reference: plan.reference, title: plan.title, type: plan.type, siteId: plan.siteId, departmentId: plan.departmentId, ownerId: plan.ownerId, scope: plan.scope, criticalActivitiesSummary: plan.criticalActivitiesSummary, activationCriteria: plan.activationCriteria, governanceStructure: plan.governanceStructure, communicationStrategy: plan.communicationStrategy, alternateWorkStrategy: plan.alternateWorkStrategy, technologyRecoveryStrategy: plan.technologyRecoveryStrategy, supplierContinuityStrategy: plan.supplierContinuityStrategy, manualWorkarounds: plan.manualWorkarounds, recoveryPriorities: plan.recoveryPriorities, reviewDueAt: dateInput(plan.reviewDueAt) }} /> : null}
    {canManage ? <div className="mt-8"><ContinuityPlanGovernanceForm planId={plan.id} status={plan.status} /></div> : null}
    <section className="mt-8"><div className="flex items-center gap-2"><Network size={19} className="text-cyan-300" /><h2 className="text-2xl font-semibold">Business impact analyses and dependencies</h2></div><div className="mt-4 space-y-5">
      {plan.businessImpactAnalyses.map((analysis) => <article key={analysis.id} className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap justify-between gap-4"><div><p className="text-sm text-cyan-300">{analysis.reference} · {pretty(analysis.criticality)}</p><h3 className="mt-1 text-xl font-semibold">{analysis.processName}</h3></div><span className={analysis.isActive ? "text-emerald-300" : "text-slate-500"}>{analysis.isActive ? "Active" : "Inactive"}</span></div>
        <p className="mt-3 text-sm leading-6 text-slate-300">{analysis.description}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="MTPD" value={`${analysis.maximumTolerableDowntimeHours} h`} /><Metric label="RTO" value={`${analysis.recoveryTimeObjectiveHours} h`} /><Metric label="RPO" value={`${analysis.recoveryPointObjectiveHours} h`} /><Metric label="Minimum staff" value={String(analysis.minimumStaff)} /></div>
        <div className="mt-5 grid gap-5 md:grid-cols-2"><Detail label="Operational impact" value={analysis.operationalImpact} /><Detail label="Minimum resources" value={analysis.minimumResources} /><Detail label="Recovery strategy" value={analysis.recoveryStrategy} /><Detail label="Workaround" value={analysis.workaroundProcedure} /></div>
        {canManage && editable.has(plan.status) ? <details className="mt-6 rounded-2xl border border-white/10 p-4"><summary className="cursor-pointer font-semibold text-cyan-200">Edit or change BIA availability</summary><BusinessImpactAnalysisForm planId={plan.id} users={users} analysis={{ id: analysis.id, ownerId: analysis.ownerId, reference: analysis.reference, processName: analysis.processName, criticality: analysis.criticality, description: analysis.description, maximumTolerableDowntimeHours: analysis.maximumTolerableDowntimeHours, recoveryTimeObjectiveHours: analysis.recoveryTimeObjectiveHours, recoveryPointObjectiveHours: analysis.recoveryPointObjectiveHours, minimumStaff: analysis.minimumStaff, peakPeriods: analysis.peakPeriods, operationalImpact: analysis.operationalImpact, financialImpact: analysis.financialImpact, legalRegulatoryImpact: analysis.legalRegulatoryImpact, customerStakeholderImpact: analysis.customerStakeholderImpact, minimumResources: analysis.minimumResources, vitalRecords: analysis.vitalRecords, recoveryStrategy: analysis.recoveryStrategy, workaroundProcedure: analysis.workaroundProcedure, reviewDueAt: dateInput(analysis.reviewDueAt) }} /><BusinessImpactAnalysisAvailabilityForm planId={plan.id} analysisId={analysis.id} active={analysis.isActive} /></details> : null}
        <h4 className="mt-6 font-semibold">Dependencies</h4><div className="mt-3 grid gap-3 lg:grid-cols-2">{analysis.dependencies.map((dependency) => <div key={dependency.id} className="rounded-2xl border border-white/10 p-4"><div className="flex justify-between gap-3"><span className="font-semibold">{dependency.name}</span><span className={dependency.isSinglePointFailure ? "text-red-300" : "text-slate-500"}>{dependency.isSinglePointFailure ? "Single point" : pretty(dependency.type)}</span></div><p className="mt-2 text-sm text-slate-400">{dependency.fallbackArrangement}</p>{canManage && editable.has(plan.status) ? <ContinuityDependencyAvailabilityForm planId={plan.id} dependencyId={dependency.id} active={dependency.isActive} /> : null}</div>)}{!analysis.dependencies.length ? <p className="text-sm text-slate-400">No dependencies recorded.</p> : null}</div>
        {canManage && editable.has(plan.status) ? <ContinuityDependencyForm planId={plan.id} analysisId={analysis.id} /> : null}
      </article>)}
      {!plan.businessImpactAnalyses.length ? <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm text-amber-100">No BIA exists. The plan cannot be submitted until a critical or high-priority process has valid MTPD, RTO and RPO values.</p> : null}
    </div>{canManage && editable.has(plan.status) ? <BusinessImpactAnalysisForm planId={plan.id} users={users} /> : null}</section>
    <div className="mt-8 grid gap-6 xl:grid-cols-2"><RecordList title="Exercises" items={plan.exercises.map((item) => ({ id: item.id, href: `/business-continuity/exercises/${item.id}`, title: item.reference, meta: `${pretty(item.status)} · ${item.scheduledAt.toLocaleString()} · ${item.lead.name}` }))} action={canManage && plan.status === ContinuityPlanStatus.ACTIVE ? { href: "/business-continuity/exercises/new", label: "Schedule exercise" } : undefined} /><RecordList title="Activations" items={plan.activations.map((item) => ({ id: item.id, href: `/business-continuity/activations/${item.id}`, title: item.reference, meta: `${pretty(item.status)} · ${item.declaredAt.toLocaleString()} · ${item.coordinator.name}` }))} action={canRecord && plan.status === ContinuityPlanStatus.ACTIVE ? { href: "/business-continuity/activations/new", label: "Record disruption" } : undefined} /></div>
    <section className="mt-8"><h2 className="text-2xl font-semibold">Plan improvements</h2><div className="mt-4 space-y-4">{improvements.map((item) => <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-6"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-sm text-amber-300">{pretty(item.priority)} · {pretty(item.status)}</p><h3 className="mt-1 text-lg font-semibold">{item.title}</h3></div><span className={item.dueAt < new Date() ? "text-red-300" : "text-slate-400"}>Due {item.dueAt.toLocaleDateString()}</span></div><p className="mt-3 text-sm text-slate-300">{item.description}</p><div className="mt-4 grid gap-4 xl:grid-cols-2">{canRecord ? <ContinuityImprovementLifecycleForm improvement={item} canManage={canManage} /> : null}{canManage && canCapa && !item.correctiveAction ? <ContinuityImprovementCapaForm improvement={item} users={users} /> : item.correctiveAction ? <Link href={`/actions/${item.correctiveAction.id}`} className="text-sm text-cyan-300">View linked CAPA</Link> : null}</div></article>)}{!improvements.length ? <p className="rounded-2xl border border-white/10 p-5 text-sm text-slate-400">No open plan improvements.</p> : null}</div>{canRecord ? <ContinuityImprovementForm planId={plan.id} users={users} /> : null}</section>
    <EntityCustomFormSubmissions organizationId={organizationId} userId={user.id} module={ConfigurableFormModule.BUSINESS_CONTINUITY} entityType={DocumentEntityType.BUSINESS_CONTINUITY} entityId={plan.id} canUpload={canManage && uploadEnabled} className="mt-8 space-y-6" />
  </div>;
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) { return <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 font-semibold ${danger ? "text-red-300" : "text-white"}`}>{value}</p></div>; }
function Detail({ label, value }: { label: string; value?: string | null }) { return <div className="mt-4"><dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-200">{value || "Not recorded"}</dd></div>; }
function RecordList({ title, items, action }: { title: string; items: Array<{ id: string; href: string; title: string; meta: string }>; action?: { href: string; label: string } }) { return <section className="rounded-3xl border border-white/10 bg-white/5 p-6"><div className="flex justify-between gap-3"><h2 className="text-xl font-semibold">{title}</h2>{action ? <Link href={action.href} className="text-sm text-cyan-300">{action.label}</Link> : null}</div><div className="mt-4 space-y-3">{items.map((item) => <Link key={item.id} href={item.href} className="block rounded-xl border border-white/10 p-4 hover:bg-white/5"><span className="font-semibold text-cyan-200">{item.title}</span><p className="mt-1 text-xs text-slate-500">{item.meta}</p></Link>)}{!items.length ? <p className="text-sm text-slate-400">No records.</p> : null}</div></section>; }
function pretty(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function dateInput(value: Date) { return value.toISOString().slice(0, 10); }
