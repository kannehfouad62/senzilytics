import { createAuditProgram } from "@/features/audits/governance.actions";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { EnterpriseAuditFrequency, EnterpriseAuditProtocolStatus, EnterpriseAuditRiskPriority, PermissionKey } from "@prisma/client";
import { ArrowLeft, Target } from "lucide-react";
import Link from "next/link";

export default async function NewAuditProgramPage() {
  await requirePermission(PermissionKey.MANAGE_AUDITS);
  const { organizationId } = await getCurrentUserTenant();
  const [users, sites, protocols] = await Promise.all([
    prisma.user.findMany({ where: { organizationId }, select: { id: true, name: true, jobTitle: true }, orderBy: { name: "asc" } }),
    prisma.site.findMany({ where: { organizationId }, include: { departments: { orderBy: { name: "asc" } } }, orderBy: { name: "asc" } }),
    prisma.auditProtocol.findMany({ where: { organizationId, status: EnterpriseAuditProtocolStatus.ACTIVE, isActive: true }, select: { id: true, name: true, version: true }, orderBy: { name: "asc" } }),
  ]);
  return <div className="mx-auto max-w-5xl"><Link href="/audits/programs" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Back to programs</Link><div className="mt-6"><p className="flex items-center gap-2 text-sm text-cyan-300"><Target size={16} /> Program Governance</p><h1 className="mt-2 text-4xl font-bold">Create Audit Program</h1></div>
    <form action={createAuditProgram} className="mt-8 space-y-7 rounded-3xl border border-white/10 bg-white/5 p-7">
      <div className="grid gap-5 md:grid-cols-2"><Field label="Program name"><input name="name" required className={inputClass} /></Field><Field label="Program code"><input name="code" className={inputClass} placeholder="EHS-INT-2026" /></Field></div>
      <Field label="Description"><textarea name="description" rows={3} className={inputClass} /></Field>
      <div className="grid gap-5 md:grid-cols-3"><Field label="Standard"><input name="standardName" className={inputClass} placeholder="ISO 45001" /></Field><Field label="Standard version"><input name="standardVersion" className={inputClass} /></Field><Field label="Framework"><input name="framework" className={inputClass} /></Field></div>
      <div className="grid gap-5 md:grid-cols-2"><Field label="Objectives"><textarea name="objectives" rows={4} className={inputClass} /></Field><Field label="Scope"><textarea name="scope" rows={4} className={inputClass} /></Field></div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4"><Field label="Frequency"><select name="frequency" defaultValue={EnterpriseAuditFrequency.ANNUAL} className={inputClass}>{Object.values(EnterpriseAuditFrequency).map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></Field><Field label="Risk priority"><select name="riskPriority" defaultValue={EnterpriseAuditRiskPriority.MEDIUM} className={inputClass}>{Object.values(EnterpriseAuditRiskPriority).map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></Field><Field label="Effective from"><input type="date" name="effectiveFrom" className={inputClass} /></Field><Field label="Effective to"><input type="date" name="effectiveTo" className={inputClass} /></Field></div>
      <div className="grid gap-5 md:grid-cols-2"><Field label="Program owner"><select name="ownerId" defaultValue="" className={inputClass}><option value="">Not assigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}{user.jobTitle ? ` — ${user.jobTitle}` : ""}</option>)}</select></Field><Field label="Default protocol"><select name="defaultProtocolId" defaultValue="" className={inputClass}><option value="">Not selected</option>{protocols.map((protocol) => <option key={protocol.id} value={protocol.id}>{protocol.name} v{protocol.version}</option>)}</select></Field></div>
      <div className="grid gap-6 md:grid-cols-2"><Checklist label="Site scope">{sites.map((site) => <label key={site.id} className="flex gap-3 text-sm"><input type="checkbox" name="siteIds" value={site.id} />{site.name}</label>)}</Checklist><Checklist label="Department scope">{sites.flatMap((site) => site.departments.map((department) => <label key={department.id} className="flex gap-3 text-sm"><input type="checkbox" name="departmentIds" value={department.id} />{site.name} — {department.name}</label>))}</Checklist></div>
      <div className="flex justify-end"><button className="rounded-2xl bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950">Create Program</button></div>
    </form></div>;
}
const inputClass = "mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-cyan-400/50";
function pretty(value: string) { return value.replaceAll("_", " "); }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-slate-300">{label}{children}</label>; }
function Checklist({ label, children }: { label: string; children: React.ReactNode }) { return <fieldset className="space-y-3 rounded-2xl border border-white/10 p-5"><legend className="px-2 text-sm font-medium text-slate-300">{label}</legend>{children}</fieldset>; }
