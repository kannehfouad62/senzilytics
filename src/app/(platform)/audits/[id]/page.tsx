import { addAuditTeamMember, removeAuditTeamMember } from "@/features/audits/schedule.actions";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { findTenantAuditById } from "@/modules/audit/audit.repository";
import { findTenantAuditUsers } from "@/modules/audit/audit-schedule.repository";
import { EnterpriseAuditStatus, EnterpriseAuditTeamRole, PermissionKey } from "@prisma/client";
import { ArrowLeft, CalendarDays, CircleAlert, ClipboardList, History, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

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
        <StatusBadge status={audit.status} />
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
              <div className="space-y-3">{audit.sections.map((section) => {
                const answered = section.questions.filter((question) => question.status === "ANSWERED" || question.status === "NOT_APPLICABLE").length;
                return <div key={section.id} className="rounded-2xl bg-slate-950/40 p-4"><div className="flex items-center justify-between gap-4"><div><p className="font-medium text-white">{section.sequence}. {section.title}</p><p className="mt-1 text-xs text-slate-500">{answered} of {section.questions.length} questions answered</p></div><span className="text-xs font-medium text-cyan-300">{pretty(section.status)}</span></div></div>;
              })}</div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
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
          <Panel title="Findings" icon={<CircleAlert size={18} />}>
            {audit.findings.length === 0 ? <Empty text="No findings recorded." /> : <div className="space-y-3">{audit.findings.map((finding) => <div key={finding.id} className="rounded-2xl bg-slate-950/40 p-4"><div className="flex justify-between gap-3"><p className="font-medium">{finding.title}</p><span className="text-xs text-cyan-300">{pretty(finding.severity)}</span></div><p className="mt-1 text-xs text-slate-500">{pretty(finding.status)} · Due {formatDate(finding.dueDate)}</p></div>)}</div>}
          </Panel>
          <Panel title="Recent history" icon={<History size={18} />}>
            {audit.history.length === 0 ? <Empty text="No history recorded." /> : <div className="space-y-4">{audit.history.map((entry) => <div key={entry.id} className="border-l border-cyan-400/30 pl-4"><p className="text-sm font-medium">{entry.title}</p><p className="mt-1 text-xs text-slate-500">{entry.user?.name || "System"} · {entry.createdAt.toLocaleString()}</p></div>)}</div>}
          </Panel>
        </div>
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
