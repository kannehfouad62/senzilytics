import {
  RegulatoryAssessmentReviewForm,
  RegulatoryCapaForm,
  RegulatoryCloseForm,
  RegulatoryImpactAssessmentForm,
  RegulatoryImplementationForm,
  RegulatoryObligationLinkForm,
  RegulatoryReviewStartForm,
} from "@/features/compliance/regulatory-intelligence-forms";
import { EntityCustomFormSubmissions } from "@/features/forms/entity-custom-form-submissions";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { hasSubscriptionFeature } from "@/lib/subscription";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  ConfigurableFormModule,
  DocumentEntityType,
  PermissionKey,
  RegulatoryAssessmentStatus,
  RegulatoryChangeStatus,
} from "@prisma/client";
import { ArrowLeft, ExternalLink, Scale } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function RegulatoryChangePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PermissionKey.VIEW_COMPLIANCE);
  const [{ id }, { organizationId, user }, permissions] = await Promise.all([params, getCurrentUserTenant(), getCurrentUserPermissions()]);
  const [change, users, obligations, uploadEnabled] = await Promise.all([
    prisma.regulatoryChange.findFirst({ where: { id, organizationId }, include: { source: true, owner: true, detectedBy: true, implementedBy: true, assessments: { include: { assessor: true, reviewedBy: true }, orderBy: { submittedAt: "desc" } }, obligationLinks: { include: { complianceItem: { include: { site: true } } }, orderBy: { createdAt: "desc" } }, actionLinks: { include: { correctiveAction: { include: { assignedTo: true } } }, orderBy: { createdAt: "desc" } } } }),
    prisma.user.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.complianceItem.findMany({ where: { site: { organizationId } }, include: { site: true }, orderBy: { title: "asc" } }),
    hasSubscriptionFeature(organizationId, "DOCUMENT_UPLOAD"),
  ]);
  if (!change) notFound();
  const canManage = permissions.includes(PermissionKey.MANAGE_COMPLIANCE);
  const canCreateCapa = permissions.includes(PermissionKey.CREATE_CAPA);
  const awaitingAssessment = change.assessments.find(assessment => assessment.status === RegulatoryAssessmentStatus.SUBMITTED);
  const assessmentPending = change.status === RegulatoryChangeStatus.DETECTED || change.status === RegulatoryChangeStatus.UNDER_REVIEW || change.status === RegulatoryChangeStatus.IMPACT_ASSESSMENT;
  const assessmentEntryAllowed = change.status === RegulatoryChangeStatus.DETECTED || change.status === RegulatoryChangeStatus.UNDER_REVIEW;
  const closeAllowed = change.status === RegulatoryChangeStatus.IMPLEMENTED || change.status === RegulatoryChangeStatus.NOT_APPLICABLE;
  const linkedObligationIds = new Set(change.obligationLinks.map(link => link.complianceItemId));
  const availableObligations = obligations.filter(item => !linkedObligationIds.has(item.id)).map(item => ({ id: item.id, name: `${item.reference || "No reference"} — ${item.title} (${item.site.name})` }));

  return <div>
    <Link href="/compliance/regulatory" className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16} />Regulatory Intelligence</Link>
    <div className="mt-6 flex flex-wrap items-start justify-between gap-5"><div><p className="flex items-center gap-2 text-sm text-cyan-300"><Scale size={17} />{change.reference}</p><h1 className="mt-2 text-4xl font-bold">{change.title}</h1><p className="mt-3 max-w-4xl whitespace-pre-wrap text-slate-400">{change.summary}</p></div><span className={`rounded-full border px-4 py-2 text-sm ${change.significance === "CRITICAL" ? "border-red-400/20 bg-red-400/10 text-red-200" : change.significance === "HIGH" ? "border-amber-400/20 bg-amber-400/10 text-amber-200" : "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"}`}>{change.status.replaceAll("_", " ")} · {change.significance}</span></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Source" value={change.source.code} /><Metric label="Type" value={change.type.replaceAll("_", " ")} /><Metric label="Assessment due" value={change.assessmentDueAt.toLocaleDateString()} danger={change.assessmentDueAt < new Date() && assessmentPending} /><Metric label="Effective" value={change.effectiveAt?.toLocaleDateString() || "Not stated"} /><Metric label="Owner" value={change.owner.name} /></div>
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-slate-500">Authoritative source</p><h2 className="mt-2 text-xl font-semibold">{change.source.authority} — {change.source.name}</h2><p className="mt-2 text-sm text-slate-400">{change.citation}</p></div><a href={change.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-cyan-300">Open publication <ExternalLink size={15} /></a></div><dl className="mt-5 grid gap-4 sm:grid-cols-4"><Detail label="Jurisdiction" value={change.source.jurisdiction} /><Detail label="Published" value={change.publishedAt?.toLocaleDateString()} /><Detail label="Detected" value={change.detectedAt.toLocaleDateString()} /><Detail label="Detected by" value={change.detectedBy.name} /></dl><p className="mt-5 rounded-xl border border-amber-400/15 bg-amber-400/[.05] p-4 text-sm text-amber-100">Senzilytics records and routes regulatory information; applicability and implementation decisions require documented human approval.</p></section>

    <EntityCustomFormSubmissions organizationId={organizationId} userId={user.id} module={ConfigurableFormModule.REGULATORY_INTELLIGENCE} entityType={DocumentEntityType.REGULATORY_CHANGE} entityId={change.id} canUpload={canManage && uploadEnabled} className="mt-8 space-y-6" />

    <div className="mt-8 grid gap-6 xl:grid-cols-2">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">Impact assessment history</h2><div className="mt-4 space-y-4">{change.assessments.map(assessment => <article key={assessment.id} className="rounded-2xl border border-white/10 p-4"><div className="flex flex-wrap justify-between gap-3"><span className="font-semibold">{assessment.decision.replaceAll("_", " ")}</span><span className={assessment.status === "APPROVED" ? "text-emerald-300" : assessment.status === "REJECTED" ? "text-red-300" : "text-amber-300"}>{assessment.status}</span></div><p className="mt-2 text-sm text-slate-300">{assessment.applicabilityRationale}</p>{assessment.impactSummary && <p className="mt-3 text-sm text-slate-400">Impact: {assessment.impactSummary}</p>}{assessment.gapSummary && <p className="mt-2 text-sm text-slate-400">Gaps: {assessment.gapSummary}</p>}{assessment.requiredActions && <p className="mt-2 text-sm text-slate-400">Actions: {assessment.requiredActions}</p>}<p className="mt-3 text-xs text-slate-500">Submitted by {assessment.assessor.name} on {assessment.submittedAt.toLocaleDateString()}{assessment.reviewedBy ? ` · Reviewed by ${assessment.reviewedBy.name}` : ""}</p>{assessment.reviewNotes && <p className="mt-2 text-xs text-slate-400">Review: {assessment.reviewNotes}</p>}</article>)}{!change.assessments.length && <p className="text-sm text-slate-400">No impact assessment has been submitted.</p>}</div></section>
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">Implementation traceability</h2><h3 className="mt-5 text-sm font-semibold text-cyan-200">Legal obligations</h3><div className="mt-3 space-y-3">{change.obligationLinks.map(link => <Link key={link.id} href={`/compliance/${link.complianceItemId}`} className="block rounded-xl border border-white/10 p-4"><p className="font-medium">{link.complianceItem.reference || "No reference"} — {link.complianceItem.title}</p><p className="mt-1 text-xs text-slate-500">{link.relationship} · {link.complianceItem.site.name}{link.notes ? ` · ${link.notes}` : ""}</p></Link>)}{!change.obligationLinks.length && <p className="text-sm text-slate-400">No legal-register obligation has been linked.</p>}</div><h3 className="mt-6 text-sm font-semibold text-cyan-200">Corrective actions</h3><div className="mt-3 space-y-3">{change.actionLinks.map(link => <Link key={link.id} href={`/actions/${link.correctiveActionId}`} className="block rounded-xl border border-white/10 p-4"><div className="flex justify-between gap-3"><span>{link.correctiveAction.title}</span><span className="text-xs">{link.correctiveAction.status}</span></div><p className="mt-1 text-xs text-slate-500">{link.correctiveAction.assignedTo.name} · Due {link.correctiveAction.dueDate.toLocaleDateString()}</p></Link>)}{!change.actionLinks.length && <p className="text-sm text-slate-400">No implementation CAPA has been linked.</p>}</div></section>
    </div>

    {canManage && <div className="mt-8 grid gap-6 xl:grid-cols-2">
      {change.status === RegulatoryChangeStatus.DETECTED && <RegulatoryReviewStartForm changeId={change.id} />}
      {assessmentEntryAllowed && <RegulatoryImpactAssessmentForm changeId={change.id} />}
      {change.status === RegulatoryChangeStatus.IMPACT_ASSESSMENT && awaitingAssessment && <RegulatoryAssessmentReviewForm changeId={change.id} assessmentId={awaitingAssessment.id} />}
      {change.status === RegulatoryChangeStatus.ACTION_REQUIRED && availableObligations.length > 0 && <RegulatoryObligationLinkForm changeId={change.id} obligations={availableObligations} />}
      {change.status === RegulatoryChangeStatus.ACTION_REQUIRED && canCreateCapa && <RegulatoryCapaForm changeId={change.id} reference={change.reference} users={users} />}
      {change.status === RegulatoryChangeStatus.ACTION_REQUIRED && <RegulatoryImplementationForm changeId={change.id} />}
      {closeAllowed && <RegulatoryCloseForm changeId={change.id} />}
    </div>}
    {(change.implementationSummary || change.closeRationale) && <section className="mt-8 rounded-3xl border border-emerald-400/15 bg-emerald-400/[.04] p-6"><p className="text-xs uppercase tracking-wide text-emerald-300">Implementation and closure record</p>{change.implementationSummary && <div className="mt-3"><p className="whitespace-pre-wrap text-sm text-slate-300">{change.implementationSummary}</p><p className="mt-2 text-xs text-slate-500">Implemented {change.implementedAt?.toLocaleDateString() || "date not recorded"}{change.implementedBy ? ` by ${change.implementedBy.name}` : ""}</p></div>}{change.closeRationale && <div className="mt-4 border-t border-white/10 pt-4"><p className="text-xs uppercase tracking-wide text-slate-500">Final closure rationale</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{change.closeRationale}</p>{change.closedAt && <p className="mt-2 text-xs text-slate-500">Closed {change.closedAt.toLocaleDateString()}</p>}</div>}</section>}
  </div>;
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) { return <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 font-semibold ${danger ? "text-red-300" : ""}`}>{value}</p></div>; }
function Detail({ label, value }: { label: string; value?: string | null }) { return <div><dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm">{value || "Not recorded"}</dd></div>; }
