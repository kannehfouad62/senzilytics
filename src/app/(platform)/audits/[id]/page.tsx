import { addAuditTeamMember, removeAuditTeamMember } from "@/features/audits/schedule.actions";
import { AuditFindingManagement } from "@/features/audits/audit-finding-management";
import { AuditActionForm } from "@/features/audits/audit-action-form";
import { AuditAiAssistant } from "@/features/audits/audit-ai-assistant";
import { AuditEvidenceUpload } from "@/features/audits/audit-evidence-upload";
import { completeAudit, recordAuditResponse, saveAuditConclusion, startAuditExecution, submitAuditForReviewWithFeedback } from "@/features/audits/execution.actions";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { findTenantAuditById } from "@/modules/audit/audit.repository";
import { findTenantAuditUsers } from "@/modules/audit/audit-schedule.repository";
import { EnterpriseAuditResponseResult, EnterpriseAuditStatus, EnterpriseAuditTeamRole, PermissionKey } from "@prisma/client";
import { ArrowLeft, CalendarDays, CircleAlert, ClipboardList, FileText, History, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

const startableStatuses = new Set<EnterpriseAuditStatus>([
  EnterpriseAuditStatus.DRAFT,
  EnterpriseAuditStatus.PLANNED,
  EnterpriseAuditStatus.SCHEDULED,
]);

export default async function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PermissionKey.VIEW_AUDITS);
  const [{ id }, { organizationId }] = await Promise.all([params, getCurrentUserTenant()]);
  const [audit, users] = await Promise.all([
    findTenantAuditById(id, organizationId),
    findTenantAuditUsers(organizationId),
  ]);
  if (!audit) notFound();

  const progress = audit.totalQuestionCount > 0
    ? Math.round((audit.answeredQuestionCount / audit.totalQuestionCount) * 100)
    : 0;

  return (
    <div>
      <Link href="/audits" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"><ArrowLeft size={16} /> Back to audits</Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300"><ShieldCheck size={16} /> {audit.reference} · {pretty(audit.auditType)}</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">{audit.title}</h1>
          <p className="mt-2 max-w-3xl text-slate-400">{audit.description || "No audit description provided."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/audits/${audit.id}/report`} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold"><FileText size={16} /> Report</Link>
          <StatusBadge status={audit.status} />
          {startableStatuses.has(audit.status) && <form action={startAuditExecution}><input type="hidden" name="auditId" value={audit.id} /><button className="rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">Start Execution</button></form>}
          {audit.status === EnterpriseAuditStatus.IN_PROGRESS && <AuditActionForm action={submitAuditForReviewWithFeedback}><input type="hidden" name="auditId" value={audit.id} /><button className="rounded-2xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950">Submit for Review</button></AuditActionForm>}
          {audit.status === EnterpriseAuditStatus.PENDING_REVIEW && <form action={completeAudit}><input type="hidden" name="auditId" value={audit.id} /><button className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950">Complete Audit</button></form>}
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Metric label="Execution progress" value={`${progress}%`} icon={<ClipboardList size={19} />} />
        <Metric label="Questions answered" value={`${audit.answeredQuestionCount}/${audit.totalQuestionCount}`} icon={<ShieldCheck size={19} />} />
        <Metric label="Open findings" value={String(audit.openFindingCount)} icon={<CircleAlert size={19} />} />
        <Metric label="Team members" value={String(audit.teamMembers.length)} icon={<Users size={19} />} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel title="Audit plan" icon={<CalendarDays size={18} />}>
            <div className="grid gap-4 md:grid-cols-2">
              <Info label="Site" value={audit.site.name} />
              <Info label="Department" value={audit.department?.name || "All departments"} />
              <Info label="Lead auditor" value={audit.leadAuditor?.name || "Not assigned"} />
              <Info label="Owner" value={audit.owner?.name || "Not assigned"} />
              <Info label="Program" value={audit.program?.name || "Standalone audit"} />
              <Info label="Protocol" value={audit.protocol ? `${audit.protocol.name} v${audit.protocol.version}` : "Not selected"} />
              <Info label="Scheduled" value={formatDate(audit.scheduledAt)} />
              <Info label="Due" value={formatDate(audit.dueDate)} />
            </div>
          </Panel>

          <Panel title="Scope and criteria" icon={<ShieldCheck size={18} />}>
            <TextBlock label="Objectives" value={audit.objectives} />
            <TextBlock label="Scope" value={audit.scope} />
            <TextBlock label="Criteria" value={audit.criteria} />
          </Panel>

          <Panel title="Execution sections" icon={<ClipboardList size={18} />}>
            {audit.sections.length === 0 ? <Empty text="No protocol snapshot is attached to this audit." /> : (
              <div className="space-y-5">{audit.sections.map((section) => {
                const answered = section.questions.filter((question) => question.status === "ANSWERED" || question.status === "NOT_APPLICABLE").length;
                return <section key={section.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-5"><div className="flex items-center justify-between gap-4"><div><p className="font-medium text-white">{section.sequence}. {section.title}</p><p className="mt-1 text-xs text-slate-500">{answered} of {section.questions.length} questions answered</p></div><span className="text-xs font-medium text-cyan-300">{pretty(section.status)}</span></div>{section.guidance && <p className="mt-3 text-sm text-slate-400">{section.guidance}</p>}<div className="mt-5 space-y-4">{section.questions.map((question) => <div key={question.id} className="rounded-2xl bg-slate-950/60 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-sm font-medium">{question.sequence}. {question.questionText}</p>{question.guidance && <p className="mt-2 text-xs text-slate-500">{question.guidance}</p>}</div><span className="text-xs text-cyan-300">{pretty(question.status)}</span></div>{audit.status === EnterpriseAuditStatus.IN_PROGRESS ? <form action={recordAuditResponse} className="mt-4 space-y-4"><input type="hidden" name="auditId" value={audit.id} /><input type="hidden" name="questionId" value={question.id} /><div className="grid gap-4 md:grid-cols-2"><ExecutionField label="Assessment result"><select name="result" required defaultValue={question.response?.result ?? ""} className={executionInputClass}><option value="" disabled>Select result</option>{Object.values(EnterpriseAuditResponseResult).filter((result) => result !== EnterpriseAuditResponseResult.NOT_ASSESSED).map((result) => <option key={result} value={result}>{pretty(result)}</option>)}</select></ExecutionField><ExecutionField label="Numeric value"><input type="number" step="any" name="numericValue" defaultValue={question.response?.numericValue?.toString() ?? ""} className={executionInputClass} /></ExecutionField></div>{question.options.length > 0 && <fieldset className="rounded-xl border border-white/10 p-3"><legend className="px-2 text-xs text-slate-400">Response options</legend><div className="flex flex-wrap gap-4">{question.options.map((option) => <label key={option.id} className="flex gap-2 text-sm"><input type="checkbox" name="selectedOptionValues" value={option.value} defaultChecked={Array.isArray(question.response?.selectedOptionValues) && question.response.selectedOptionValues.includes(option.value)} />{option.label}</label>)}</div></fieldset>}<ExecutionField label="Response narrative"><textarea name="responseText" rows={2} defaultValue={question.response?.responseText ?? ""} className={executionInputClass} /></ExecutionField><ExecutionField label={`Comments${question.requireComment ? " (required)" : ""}`}><textarea name="comments" required={question.requireComment} rows={2} defaultValue={question.response?.comments ?? ""} className={executionInputClass} /></ExecutionField><div className="grid gap-4 md:grid-cols-2"><ExecutionField label={`Evidence note${question.requireEvidence ? " (required if no URL)" : ""}`}><input name="evidenceNote" className={executionInputClass} /></ExecutionField><ExecutionField label={`Evidence or photo URL${question.requirePhoto ? " (required)" : ""}`}><input type="url" name="evidenceUrl" required={question.requirePhoto} className={executionInputClass} /></ExecutionField></div>{question.evidence.length > 0 && <p className="text-xs text-emerald-300">{question.evidence.length} evidence record(s) attached</p>}<div className="flex justify-end"><button className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">Save Response</button></div></form> : question.response && <div className="mt-4 rounded-xl border border-white/5 p-3 text-sm"><p><span className="text-slate-500">Result:</span> {pretty(question.response.result)}</p>{question.response.comments && <p className="mt-2 text-slate-400">{question.response.comments}</p>}</div>}</div>)}</div></section>;
              })}</div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Audit evidence" icon={<FileText size={18} />}><AuditEvidenceUpload auditId={audit.id} />{audit.evidence.length > 0 && <div className="mt-4 space-y-2">{audit.evidence.map((evidence) => <a key={evidence.id} href={evidence.fileUrl ? `/api/audits/evidence/${evidence.id}` : evidence.externalUrl || "#"} target="_blank" rel="noreferrer" className="block rounded-xl bg-slate-950/40 p-3 text-sm text-cyan-300">{evidence.title}{evidence.fileName ? ` — ${evidence.fileName}` : ""}</a>)}</div>}</Panel>
          <Panel title="Executive conclusion" icon={<FileText size={18} />}>
            <form action={saveAuditConclusion} className="space-y-4"><input type="hidden" name="auditId" value={audit.id} /><ExecutionField label="Executive summary"><textarea name="executiveSummary" rows={3} defaultValue={audit.executiveSummary ?? ""} className={executionInputClass} /></ExecutionField><ExecutionField label="Overall opinion"><textarea name="overallOpinion" rows={2} defaultValue={audit.overallOpinion ?? ""} className={executionInputClass} /></ExecutionField><ExecutionField label="Positive practices"><textarea name="positivePractices" rows={2} defaultValue={audit.positivePractices ?? ""} className={executionInputClass} /></ExecutionField><ExecutionField label="Major concerns"><textarea name="majorConcerns" rows={2} defaultValue={audit.majorConcerns ?? ""} className={executionInputClass} /></ExecutionField><ExecutionField label="Recommendations"><textarea name="recommendations" rows={3} defaultValue={audit.recommendations ?? ""} className={executionInputClass} /></ExecutionField><button className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">Save Conclusion</button></form>
          </Panel>
          <Panel title="Audit team" icon={<Users size={18} />}>
            {audit.teamMembers.length === 0 ? <Empty text="No audit team members assigned." /> : <div className="space-y-3">{audit.teamMembers.map((member) => <div key={member.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-950/40 p-4"><div><p className="font-medium">{member.user.name}</p><p className="mt-1 text-xs text-slate-500">{pretty(member.role)}{member.user.jobTitle ? ` · ${member.user.jobTitle}` : ""}{member.canReview ? " · Reviewer" : ""}</p></div>{member.userId !== audit.leadAuditorId && <form action={removeAuditTeamMember}><input type="hidden" name="auditId" value={audit.id} /><input type="hidden" name="memberId" value={member.userId} /><button className="text-xs text-red-300">Remove</button></form>}</div>)}</div>}
            <form action={addAuditTeamMember} className="mt-5 space-y-4 rounded-2xl border border-white/10 p-4">
              <input type="hidden" name="auditId" value={audit.id} />
              <label className="block text-sm text-slate-300">Team member<select name="memberId" required defaultValue="" className={teamInputClass}><option value="" disabled>Select user</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}{user.jobTitle ? ` — ${user.jobTitle}` : ""}</option>)}</select></label>
              <label className="block text-sm text-slate-300">Role<select name="role" defaultValue={EnterpriseAuditTeamRole.AUDITOR} className={teamInputClass}>{Object.values(EnterpriseAuditTeamRole).map((role) => <option key={role} value={role}>{pretty(role)}</option>)}</select></label>
              <div className="flex flex-wrap gap-4 text-sm text-slate-300"><label className="flex gap-2"><input type="checkbox" name="canEdit" defaultChecked />Can edit</label><label className="flex gap-2"><input type="checkbox" name="canReview" />Can review</label></div>
              <button className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">Assign Team Member</button>
            </form>
          </Panel>
          <Panel title="Recent history" icon={<History size={18} />}>
            {audit.history.length === 0 ? <Empty text="No history recorded." /> : <div className="space-y-4">{audit.history.map((entry) => <div key={entry.id} className="border-l border-cyan-400/30 pl-4"><p className="text-sm font-medium">{entry.title}</p><p className="mt-1 text-xs text-slate-500">{entry.user?.name || "System"} · {entry.createdAt.toLocaleString()}</p></div>)}</div>}
          </Panel>
        </div>
      </div>
      <div className="mt-8">
        <AuditAiAssistant auditId={audit.id} reference={audit.reference} />
      </div>
      <div className="mt-8">
        <Panel title="Audit Findings, CAPA, and Risk" icon={<CircleAlert size={18} />}>
          <AuditFindingManagement audit={audit} users={users} />
        </Panel>
      </div>
    </div>
  );
}

function pretty(value: string) { return value.replaceAll("_", " "); }
function formatDate(value: Date | null) { return value ? value.toLocaleDateString() : "Not set"; }
function StatusBadge({ status }: { status: EnterpriseAuditStatus }) { return <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-200">{pretty(status)}</span>; }
function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="rounded-3xl border border-white/10 bg-white/5 p-5"><div className="flex items-center justify-between text-slate-400"><p className="text-sm">{label}</p><span className="text-cyan-300">{icon}</span></div><p className="mt-3 text-2xl font-bold">{value}</p></div>; }
function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="mb-5 flex items-center gap-2 text-lg font-semibold"><span className="text-cyan-300">{icon}</span>{title}</h2>{children}</section>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-slate-950/40 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-sm text-slate-200">{value}</p></div>; }
function TextBlock({ label, value }: { label: string; value: string | null }) { return <div className="mb-5 last:mb-0"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{value || "Not provided."}</p></div>; }
function Empty({ text }: { text: string }) { return <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-500">{text}</p>; }
const teamInputClass = "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm outline-none";
const executionInputClass = "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm outline-none focus:border-cyan-400/50";
function ExecutionField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-medium text-slate-400">{label}{children}</label>; }
