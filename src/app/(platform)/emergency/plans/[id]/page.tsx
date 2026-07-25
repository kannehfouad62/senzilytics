import {
  EmergencyContactAvailabilityForm,
  EmergencyContactForm,
  EmergencyImprovementCapaForm,
  EmergencyImprovementForm,
  EmergencyImprovementLifecycleForm,
  EmergencyPlanForm,
  EmergencyPlanGovernanceForm,
  EmergencyScenarioAvailabilityForm,
  EmergencyScenarioForm,
} from "@/features/emergency/emergency-forms";
import { EntityCustomFormSubmissions } from "@/features/forms/entity-custom-form-submissions";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { hasSubscriptionFeature } from "@/lib/subscription";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  ConfigurableFormModule,
  DocumentEntityType,
  EmergencyImprovementStatus,
  EmergencyPlanStatus,
  PermissionKey,
} from "@prisma/client";
import { ArrowLeft, Phone, ShieldCheck, Siren } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

const editable = new Set<EmergencyPlanStatus>([EmergencyPlanStatus.DRAFT, EmergencyPlanStatus.REJECTED]);
const activeImprovements = new Set<EmergencyImprovementStatus>([EmergencyImprovementStatus.OPEN, EmergencyImprovementStatus.IN_PROGRESS, EmergencyImprovementStatus.COMPLETED]);

export default async function EmergencyPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PermissionKey.VIEW_EMERGENCY_PREPAREDNESS);
  const [{ id }, { organizationId, user }, permissions] = await Promise.all([params, getCurrentUserTenant(), getCurrentUserPermissions()]);
  const canManage = permissions.includes(PermissionKey.MANAGE_EMERGENCY_PREPAREDNESS);
  const canRecord = permissions.includes(PermissionKey.RECORD_EMERGENCY_RESPONSE);
  const canCapa = permissions.includes(PermissionKey.CREATE_CAPA);
  const [plan, sites, departments, users, uploadEnabled] = await Promise.all([
    prisma.emergencyPlan.findFirst({ where: { id, organizationId }, include: {
      site: true, department: true, owner: true, createdBy: true, submittedBy: true, approvedBy: true, previousVersion: { select: { id: true, version: true } }, revisions: { select: { id: true, version: true, status: true }, orderBy: { version: "asc" } },
      scenarios: { orderBy: [{ sequence: "asc" }, { title: "asc" }] }, contacts: { orderBy: [{ priority: "asc" }, { name: "asc" }] },
      drills: { include: { lead: true }, orderBy: { scheduledAt: "desc" } }, activations: { include: { incidentCommander: true }, orderBy: { declaredAt: "desc" } },
      improvements: { include: { owner: true, correctiveAction: true }, orderBy: { dueAt: "asc" } },
    } }),
    prisma.site.findMany({ where: { organizationId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { site: { organizationId } }, select: { id: true, name: true, siteId: true, site: { select: { name: true } } }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    hasSubscriptionFeature(organizationId, "DOCUMENT_UPLOAD"),
  ]);
  if (!plan) notFound();
  const improvements = plan.improvements.filter((item) => activeImprovements.has(item.status));
  return <div>
    <Link href="/emergency" className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16} />Back to Emergency Readiness</Link>
    <div className="mt-6 flex flex-wrap items-start justify-between gap-5"><div><p className="flex items-center gap-2 text-sm text-cyan-300"><Siren size={17} />{plan.reference} · Version {plan.version}</p><h1 className="mt-2 text-4xl font-bold">{plan.title}</h1><p className="mt-2 text-slate-400">{pretty(plan.type)} · {plan.site.name}{plan.department ? ` · ${plan.department.name}` : ""}</p></div><span className="rounded-full border border-white/10 px-4 py-2 text-sm">{pretty(plan.status)}</span></div>
    <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Owner" value={plan.owner.name} /><Metric label="Review due" value={plan.reviewDueAt.toLocaleDateString()} danger={plan.reviewDueAt < new Date()} /><Metric label="Scenarios" value={String(plan.scenarios.filter((item) => item.isActive).length)} /><Metric label="Contacts" value={String(plan.contacts.filter((item) => item.isActive).length)} /><Metric label="Open improvements" value={String(improvements.length)} /></div>

    <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">Controlled response framework</h2><dl className="mt-5 grid gap-5 md:grid-cols-2"><Detail label="Scope" value={plan.scope} /><Detail label="Purpose" value={plan.purpose} /><Detail label="Hazard profile" value={plan.hazardProfile} /><Detail label="Incident command" value={plan.commandStructure} /><Detail label="Alarm and communication" value={plan.communicationProcedure} /><Detail label="Evacuation" value={plan.evacuationProcedure} /><Detail label="Shelter in place" value={plan.shelterProcedure} /><Detail label="Personnel accountability" value={plan.accountabilityProcedure} /><Detail label="Medical response" value={plan.medicalProcedure} /><Detail label="External coordination" value={plan.externalCoordination} /><Detail label="Stand-down and recovery" value={plan.recoveryCriteria} /></dl><div className="mt-5 border-t border-white/10 pt-4 text-xs text-slate-500">Created by {plan.createdBy.name}. {plan.submittedAt ? `Submitted ${plan.submittedAt.toLocaleString()} by ${plan.submittedBy?.name ?? "Unknown"}.` : ""} {plan.approvedAt ? `Approved ${plan.approvedAt.toLocaleString()} by ${plan.approvedBy?.name ?? "Unknown"}.` : ""}</div></section>

    {canManage && editable.has(plan.status) ? <EmergencyPlanForm sites={sites} departments={departments.map((item) => ({ id: item.id, name: item.name, siteId: item.siteId, siteName: item.site.name }))} users={users} plan={{ id: plan.id, reference: plan.reference, title: plan.title, type: plan.type, siteId: plan.siteId, departmentId: plan.departmentId, ownerId: plan.ownerId, scope: plan.scope, purpose: plan.purpose, hazardProfile: plan.hazardProfile, commandStructure: plan.commandStructure, communicationProcedure: plan.communicationProcedure, evacuationProcedure: plan.evacuationProcedure, shelterProcedure: plan.shelterProcedure, accountabilityProcedure: plan.accountabilityProcedure, medicalProcedure: plan.medicalProcedure, externalCoordination: plan.externalCoordination, recoveryCriteria: plan.recoveryCriteria, reviewDueAt: dateInput(plan.reviewDueAt) }} /> : null}
    {canManage ? <div className="mt-8"><EmergencyPlanGovernanceForm planId={plan.id} status={plan.status} /></div> : null}

    <section className="mt-8"><div className="flex items-center gap-2"><ShieldCheck size={19} className="text-cyan-300" /><h2 className="text-2xl font-semibold">Credible scenarios</h2></div><div className="mt-4 grid gap-4 lg:grid-cols-2">{plan.scenarios.map((scenario) => <article key={scenario.id} className="rounded-3xl border border-white/10 bg-white/5 p-6"><div className="flex justify-between gap-3"><div><p className="text-sm text-cyan-300">{pretty(scenario.category)} · {pretty(scenario.riskLevel)}</p><h3 className="mt-1 text-lg font-semibold">{scenario.title}</h3></div><span className={scenario.isActive ? "text-emerald-300" : "text-slate-500"}>{scenario.isActive ? "Active" : "Inactive"}</span></div><Detail label="Activation triggers" value={scenario.triggerCriteria} /><Detail label="Immediate actions" value={scenario.immediateActions} /><Detail label="Protective actions" value={scenario.protectiveActions} />{canManage && editable.has(plan.status) ? <EmergencyScenarioAvailabilityForm planId={plan.id} scenarioId={scenario.id} active={scenario.isActive} /> : null}</article>)}{!plan.scenarios.length ? <p className="text-sm text-slate-400">No scenarios have been defined.</p> : null}</div>{canManage && editable.has(plan.status) ? <div className="mt-6"><EmergencyScenarioForm planId={plan.id} /></div> : null}</section>

    <section className="mt-8"><div className="flex items-center gap-2"><Phone size={19} className="text-cyan-300" /><h2 className="text-2xl font-semibold">Emergency contacts</h2></div><div className="mt-4 grid gap-4 lg:grid-cols-2">{plan.contacts.map((contact) => <article key={contact.id} className="rounded-3xl border border-white/10 bg-white/5 p-5"><div className="flex justify-between gap-3"><div><p className="text-sm text-cyan-300">{pretty(contact.type)}</p><h3 className="mt-1 font-semibold">{contact.name}</h3></div><span className={contact.isActive ? "text-emerald-300" : "text-slate-500"}>{contact.isActive ? "Active" : "Inactive"}</span></div><p className="mt-2 text-sm text-slate-300">{contact.organizationName ?? contact.role ?? "Internal contact"} · {contact.phone}</p>{canManage && editable.has(plan.status) ? <EmergencyContactAvailabilityForm planId={plan.id} contactId={contact.id} active={contact.isActive} /> : null}</article>)}{!plan.contacts.length ? <p className="text-sm text-slate-400">No emergency contacts have been defined.</p> : null}</div>{canManage && editable.has(plan.status) ? <div className="mt-6"><EmergencyContactForm planId={plan.id} /></div> : null}</section>

    <div className="mt-8 grid gap-6 xl:grid-cols-2"><section className="rounded-3xl border border-white/10 bg-white/5 p-6"><div className="flex justify-between gap-3"><h2 className="text-xl font-semibold">Exercises</h2>{canManage && plan.status === EmergencyPlanStatus.ACTIVE ? <Link href="/emergency/drills/new" className="text-sm text-cyan-300">Schedule drill</Link> : null}</div><div className="mt-4 space-y-3">{plan.drills.map((drill) => <Link key={drill.id} href={`/emergency/drills/${drill.id}`} className="block rounded-xl border border-white/10 p-4 hover:bg-white/5"><div className="flex justify-between"><span className="font-semibold text-cyan-200">{drill.reference}</span><span className="text-sm">{pretty(drill.status)}</span></div><p className="mt-1 text-xs text-slate-500">{drill.scheduledAt.toLocaleString()} · {drill.lead.name}</p></Link>)}{!plan.drills.length ? <p className="text-sm text-slate-400">No exercises recorded.</p> : null}</div></section><section className="rounded-3xl border border-white/10 bg-white/5 p-6"><div className="flex justify-between gap-3"><h2 className="text-xl font-semibold">Activations</h2></div><div className="mt-4 space-y-3">{plan.activations.map((activation) => <Link key={activation.id} href={`/emergency/activations/${activation.id}`} className="block rounded-xl border border-white/10 p-4 hover:bg-white/5"><div className="flex justify-between"><span className="font-semibold text-cyan-200">{activation.reference}</span><span className="text-sm">{pretty(activation.status)}</span></div><p className="mt-1 text-xs text-slate-500">{activation.declaredAt.toLocaleString()} · {activation.incidentCommander.name}</p></Link>)}{!plan.activations.length ? <p className="text-sm text-slate-400">No response activations recorded.</p> : null}</div></section></div>

    <section className="mt-8"><h2 className="text-2xl font-semibold">Plan improvements</h2><div className="mt-4 space-y-4">{improvements.map((item) => <Improvement key={item.id} item={item} users={users} canManage={canManage} canRecord={canRecord} canCapa={canCapa} />)}{!improvements.length ? <p className="rounded-2xl border border-white/10 p-5 text-sm text-slate-400">No open plan improvements.</p> : null}</div>{canRecord ? <div className="mt-6"><EmergencyImprovementForm planId={plan.id} users={users} /></div> : null}</section>
    <EntityCustomFormSubmissions organizationId={organizationId} userId={user.id} module={ConfigurableFormModule.EMERGENCY_PREPAREDNESS} entityType={DocumentEntityType.EMERGENCY_PREPAREDNESS} entityId={plan.id} canUpload={canManage && uploadEnabled} className="mt-8 space-y-6" />
  </div>;
}

function Improvement({ item, users, canManage, canRecord, canCapa }: { item: { id: string; planId: string; drillId: string | null; activationId: string | null; title: string; description: string; priority: string; status: EmergencyImprovementStatus; dueAt: Date; owner: { name: string }; correctiveAction: { id: string } | null }; users: Array<{ id: string; name: string }>; canManage: boolean; canRecord: boolean; canCapa: boolean }) {
  return <article className="rounded-3xl border border-white/10 bg-white/5 p-6"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-sm text-amber-300">{pretty(item.priority)} · {pretty(item.status)}</p><h3 className="mt-1 text-lg font-semibold">{item.title}</h3></div><span className={item.dueAt < new Date() ? "text-red-300" : "text-slate-400"}>Due {item.dueAt.toLocaleDateString()}</span></div><p className="mt-3 text-sm text-slate-300">{item.description}</p><p className="mt-2 text-xs text-slate-500">Owner: {item.owner.name}</p>{item.correctiveAction ? <Link href={`/actions/${item.correctiveAction.id}`} className="mt-3 inline-block text-sm text-cyan-300">View linked CAPA</Link> : null}<div className="mt-4 grid gap-4 xl:grid-cols-2">{canRecord ? <EmergencyImprovementLifecycleForm improvement={item} canManage={canManage} /> : null}{canManage && canCapa && !item.correctiveAction ? <EmergencyImprovementCapaForm improvement={item} users={users} /> : null}</div></article>;
}
function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) { return <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 font-semibold ${danger ? "text-red-300" : "text-white"}`}>{value}</p></div>; }
function Detail({ label, value }: { label: string; value?: string | null }) { return <div className="mt-4"><dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-200">{value || "Not recorded"}</dd></div>; }
function pretty(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function dateInput(value: Date) { return value.toISOString().slice(0, 10); }
