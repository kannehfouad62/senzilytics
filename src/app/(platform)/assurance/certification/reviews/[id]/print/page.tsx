import { PrintReportButton } from "@/features/reports/print-report-button";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { CertificationManagementReviewStatus, PermissionKey } from "@prisma/client";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function CertificationManagementReviewPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PermissionKey.VIEW_CERTIFICATION_READINESS);
  const [{ id }, { organizationId, organization }] = await Promise.all([params, getCurrentUserTenant()]);
  const review = await prisma.certificationManagementReview.findFirst({
    where: { id, organizationId, status: { in: [CertificationManagementReviewStatus.COMPLETED, CertificationManagementReviewStatus.APPROVED] } },
    include: { program: true, chair: true, createdBy: true, completedBy: true, approvedBy: true, actions: { include: { correctiveAction: { include: { assignedTo: true } } }, orderBy: { createdAt: "asc" } } },
  });
  if (!review) notFound();
  const rows = [
    ["Audit results", review.auditResultsSummary], ["Compliance status", review.complianceStatusSummary],
    ["Objectives and performance", review.objectivesPerformance], ["Stakeholder feedback", review.stakeholderFeedback],
    ["Changes in context", review.changesInContext], ["Risks and opportunities", review.risksAndOpportunities],
    ["Resource adequacy", review.resourceAdequacy], ["Leadership decisions", review.decisions],
    ["Improvement opportunities", review.improvementOpportunities], ["Conclusion", review.conclusion?.replaceAll("_", " ")],
  ] as const;
  return <article className="mx-auto max-w-5xl print:max-w-none print:text-black">
    <div className="mb-8 flex items-center justify-between print:hidden"><Link href={`/assurance/certification/reviews/${review.id}`} className="inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16}/>Review workspace</Link><PrintReportButton/></div>
    <header className="border-b border-white/15 pb-6 print:border-black"><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-cyan-300 print:text-slate-700"><ShieldCheck size={17}/>Controlled management review report</p><h1 className="mt-3 text-4xl font-bold">{review.title}</h1><p className="mt-2 text-slate-400 print:text-slate-700">{organization?.name ?? "Senzilytics tenant"} · {review.reference} · {review.program.name}</p></header>
    <section className="grid grid-cols-2 gap-5 py-6 md:grid-cols-4"><Fact label="Status" value={review.status.replaceAll("_", " ")}/><Fact label="Review period" value={`${review.periodStart.toLocaleDateString()} – ${review.periodEnd.toLocaleDateString()}`}/><Fact label="Meeting" value={review.scheduledAt.toLocaleDateString()}/><Fact label="Chair" value={review.chair.name}/><Fact label="Readiness" value={`${review.readinessScore}%`}/><Fact label="Created by" value={review.createdBy.name}/><Fact label="Completed by" value={review.completedBy?.name ?? "Not recorded"}/><Fact label="Approved by" value={review.approvedBy?.name ?? "Not approved"}/></section>
    <section className="border-t border-white/15 py-6 print:border-slate-400"><h2 className="mb-5 text-2xl font-bold">Recorded review outputs</h2><div className="grid gap-6 md:grid-cols-2">{rows.map(([label, value]) => <Text key={label} label={label} value={value}/>)}</div></section>
    <section className="border-t border-white/15 py-6 print:border-slate-400"><h2 className="mb-5 text-2xl font-bold">Decision actions</h2>{review.actions.length ? <div className="space-y-4">{review.actions.map(link => <div key={link.id} className="break-inside-avoid rounded-xl border border-white/10 p-4 print:border-slate-400"><p className="font-semibold">{link.correctiveAction.title}</p><p className="mt-1 text-sm text-slate-400 print:text-slate-700">{link.agendaTopic || "Management-review decision"} · Owner {link.correctiveAction.assignedTo.name} · Due {link.correctiveAction.dueDate.toLocaleDateString()}</p><p className="mt-2 text-sm">{link.decision}</p></div>)}</div> : <p className="text-sm text-slate-500">No decision actions recorded.</p>}</section>
    <footer className="border-t border-white/15 py-5 text-xs text-slate-500 print:border-black">Generated {new Date().toLocaleString()} from the tenant-controlled Senzilytics record.</footer>
  </article>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>; }
function Text({ label, value }: { label: string; value: string | null | undefined }) { return <div className="break-inside-avoid"><h3 className="text-xs font-semibold uppercase text-slate-500">{label}</h3><p className="mt-1 whitespace-pre-wrap text-sm">{value || "Not recorded"}</p></div>; }
