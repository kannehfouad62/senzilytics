import Link from "next/link";
import { notFound } from "next/navigation";
import { PermissionKey } from "@prisma/client";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getResearchDataGovernanceWorkspace } from "@/modules/research/research-data-governance.service";
import {
  DataLifecyclePlanForm,
  DataLifecycleStatusForm,
  DatasetAccessDecisionForm,
  DatasetAccessRequestForm,
  PrivacyReviewForm,
  PrivacyReviewStatusForm,
} from "@/features/research/data-governance-forms";

export const dynamic = "force-dynamic";

export default async function ResearchDataGovernancePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PermissionKey.VIEW_RESEARCH);
  const [{ id }, tenant, permissions] = await Promise.all([params, getCurrentUserTenant(), getCurrentUserPermissions()]);
  const canManage = permissions.includes(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const canApprove = permissions.includes(PermissionKey.APPROVE_RESEARCH_OUTPUTS);
  const workspace = await getResearchDataGovernanceWorkspace(tenant.organizationId, id, tenant.user.id, canManage || canApprove);
  if (!workspace) notFound();
  const { project, plan, reviews, requests, users } = workspace;

  return <div>
    <Link href={`/research/projects/${id}`} className="text-sm text-slate-400">← {project.reference}</Link>
    <p className="mt-6 text-sm text-cyan-300">Research Data Governance</p>
    <h1 className="mt-2 text-4xl font-bold">{project.title}</h1>
    <p className="mt-2 max-w-4xl text-slate-400">Control retention and disposal, assess re-identification and disclosure risk, and independently authorize time-bounded dataset access.</p>

    {canManage && (!plan || plan.status === "DRAFT") ? <div className="mt-8"><DataLifecyclePlanForm projectId={id} users={users} defaultRetentionDays={plan?.retentionDays ?? project.retentionDays}/></div> : null}
    {plan ? <section className="mt-8 rounded-3xl border border-white/10 bg-white/[.035] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-amber-300">{pretty(plan.status)}</p><h2 className="mt-1 text-xl font-semibold">Retention and disposal control</h2><p className="mt-2 text-sm text-slate-400">Owner {plan.owner.name} · retain {plan.retentionDays.toLocaleString()} days · {pretty(plan.disposalMethod)}</p></div><div className="text-right text-sm"><p>Disposal due</p><strong>{plan.scheduledDisposalAt.toLocaleDateString()}</strong></div></div>
      <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">{plan.retentionBasis}</p>
      {plan.legalHoldReason ? <p className="mt-3 text-sm text-amber-200">Legal hold: {plan.legalHoldReason}</p> : null}
      {plan.disposalEvidence ? <p className="mt-3 text-sm text-emerald-200">Disposal evidence: {plan.disposalEvidence}</p> : null}
      {canManage ? <DataLifecycleStatusForm projectId={id} planId={plan.id} status={plan.status} canApprove={canApprove}/> : null}
    </section> : null}

    {canManage ? <div className="mt-8"><PrivacyReviewForm projectId={id}/></div> : null}
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/[.035] p-6"><h2 className="text-xl font-semibold">Privacy and disclosure reviews</h2><div className="mt-5 space-y-4">{reviews.map(review => <article key={review.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-cyan-300">{pretty(review.type)} · {review.datasetReference} · v{review.version}</p><h3 className="mt-1 font-semibold">Residual risk: {pretty(review.residualRisk)}</h3><p className="mt-1 text-xs text-slate-500">Created by {review.createdBy.name}{review.reviewedBy ? ` · Reviewed by ${review.reviewedBy.name}` : ""}</p></div><div><span className="mb-3 block text-right text-xs">{pretty(review.status)}</span>{canManage ? <PrivacyReviewStatusForm projectId={id} reviewId={review.id} status={review.status} canApprove={canApprove}/> : null}</div></div><p className="mt-4 text-sm text-slate-300"><strong>Method:</strong> {review.method}</p><p className="mt-3 text-sm text-slate-300"><strong>Findings:</strong> {review.findings}</p>{review.mitigation ? <p className="mt-3 text-sm text-amber-100"><strong>Mitigation:</strong> {review.mitigation}</p> : null}<p className="mt-3 text-xs text-slate-500">Direct identifiers removed: {review.directIdentifiersRemoved ? "Yes" : "No"} · Evidence {review.evidenceReference}</p></article>)}{!reviews.length ? <p className="text-sm text-slate-500">No privacy reviews have been recorded.</p> : null}</div></section>

    <div className="mt-8"><DatasetAccessRequestForm projectId={id}/></div>
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/[.035] p-6"><h2 className="text-xl font-semibold">Dataset access register</h2><p className="mt-1 text-sm text-slate-500">Non-managers see only their own requests. Row-level and identifiable approvals require an approved disclosure-risk review.</p><div className="mt-5 space-y-4">{requests.map(request => <article key={request.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-cyan-300">{request.datasetReference} · {pretty(request.accessLevel)}</p><h3 className="mt-1 font-semibold">{request.requestedBy.name}</h3><p className="mt-1 text-xs text-slate-500">{request.requestedBy.email} · requested {request.createdAt.toLocaleDateString()}</p></div><span className="text-xs">{pretty(request.status)}</span></div><p className="mt-4 text-sm text-slate-300"><strong>Purpose:</strong> {request.purpose}</p><p className="mt-2 text-sm text-slate-300"><strong>Scope:</strong> {request.scope}</p><p className="mt-2 text-sm text-slate-300"><strong>Safeguards:</strong> {request.safeguards}</p>{request.decisionReason ? <p className="mt-2 text-sm text-amber-100"><strong>Decision:</strong> {request.decisionReason}</p> : null}{canManage || canApprove ? <DatasetAccessDecisionForm projectId={id} requestId={request.id} status={request.status} canApprove={canApprove}/> : null}</article>)}{!requests.length ? <p className="text-sm text-slate-500">No dataset access requests have been submitted.</p> : null}</div></section>
  </div>;
}

function pretty(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()); }
