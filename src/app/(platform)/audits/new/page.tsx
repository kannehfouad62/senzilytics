import { createAudit } from "@/features/audits/actions";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { AuditType, EnterpriseAuditProtocolStatus, PermissionKey } from "@prisma/client";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default async function NewAuditPage() {
  await requirePermission(PermissionKey.MANAGE_AUDITS);
  const { organizationId } = await getCurrentUserTenant();
  const [sites, users, programs, protocols] = await Promise.all([
    prisma.site.findMany({ where: { organizationId }, include: { departments: { orderBy: { name: "asc" } } }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { organizationId }, select: { id: true, name: true, jobTitle: true }, orderBy: { name: "asc" } }),
    prisma.auditProgram.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.auditProtocol.findMany({ where: { organizationId, isActive: true, status: EnterpriseAuditProtocolStatus.ACTIVE }, select: { id: true, name: true, code: true, version: true, _count: { select: { sections: true } } }, orderBy: [{ name: "asc" }, { version: "desc" }] }),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/audits" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"><ArrowLeft size={16} /> Back to audits</Link>
      <div className="mt-6">
        <p className="flex items-center gap-2 text-sm text-cyan-300"><ShieldCheck size={16} /> Audit Planning</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Create Enterprise Audit</h1>
        <p className="mt-2 max-w-3xl text-slate-400">Define scope, ownership, schedule, and the controlled protocol that will be snapshotted for execution.</p>
      </div>

      <form action={createAudit} className="mt-8 space-y-7 rounded-3xl border border-white/10 bg-white/5 p-7 shadow-2xl backdrop-blur-xl">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Audit title"><input name="title" required placeholder="Example: 2026 Internal EHS Management System Audit" className={inputClass} /></Field>
          <Field label="Reference"><input name="reference" placeholder="Auto-generated when blank" className={inputClass} /></Field>
        </div>
        <Field label="Description"><textarea name="description" rows={3} className={inputClass} placeholder="Purpose and background of this audit." /></Field>
        <div className="grid gap-5 md:grid-cols-3">
          <Field label="Audit type"><select name="auditType" defaultValue={AuditType.INTERNAL} className={inputClass}>{Object.values(AuditType).map((type) => <option key={type} value={type}>{pretty(type)}</option>)}</select></Field>
          <Field label="Site"><select name="siteId" required defaultValue="" className={inputClass}><option value="" disabled>Select a site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></Field>
          <Field label="Department"><select name="departmentId" defaultValue="" className={inputClass}><option value="">All departments</option>{sites.flatMap((site) => site.departments.map((department) => <option key={department.id} value={department.id}>{site.name} — {department.name}</option>))}</select></Field>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Audit program"><select name="programId" defaultValue="" className={inputClass}><option value="">Standalone audit</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.code ? `${program.code} — ` : ""}{program.name}</option>)}</select></Field>
          <Field label="Execution protocol"><select name="protocolId" defaultValue="" className={inputClass}><option value="">No protocol yet</option>{protocols.map((protocol) => <option key={protocol.id} value={protocol.id}>{protocol.code ? `${protocol.code} — ` : ""}{protocol.name} v{protocol.version} ({protocol._count.sections} sections)</option>)}</select></Field>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Lead auditor"><select name="leadAuditorId" defaultValue="" className={inputClass}><option value="">Not assigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}{user.jobTitle ? ` — ${user.jobTitle}` : ""}</option>)}</select></Field>
          <Field label="Audit owner"><select name="ownerId" defaultValue="" className={inputClass}><option value="">Not assigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}{user.jobTitle ? ` — ${user.jobTitle}` : ""}</option>)}</select></Field>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Scheduled date"><input type="datetime-local" name="scheduledAt" className={inputClass} /></Field>
          <Field label="Due date"><input type="date" name="dueDate" className={inputClass} /></Field>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <Field label="Objectives"><textarea name="objectives" rows={4} className={inputClass} /></Field>
          <Field label="Scope"><textarea name="scope" rows={4} className={inputClass} /></Field>
          <Field label="Criteria"><textarea name="criteria" rows={4} className={inputClass} /></Field>
        </div>
        <div className="flex justify-end"><button type="submit" className="rounded-2xl bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">Create Audit</button></div>
      </form>
    </div>
  );
}

const inputClass = "mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50";
function pretty(value: string) { return value.replaceAll("_", " "); }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-slate-300">{label}{children}</label>; }
