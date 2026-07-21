import { PermitCreateForm } from "@/features/permits-to-work/permit-create-form";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import { ConfigurableFormModule, ContractorStatus, ContractorWorkerStatus, PermissionKey, PermitToWorkType } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const input = "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3";
export default async function NewPermitToWorkPage({ searchParams }: { searchParams: Promise<{ contractorId?: string }> }) {
  await requirePermission(PermissionKey.MANAGE_PERMITS_TO_WORK); const [{ organizationId }, query] = await Promise.all([getCurrentUserTenant(), searchParams]);
  const [sites, departments, contractors, forms] = await Promise.all([
    prisma.site.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { site: { organizationId } }, include: { site: true }, orderBy: { name: "asc" } }),
    prisma.contractor.findMany({ where: { organizationId, status: ContractorStatus.APPROVED }, select: { id: true, name: true, workers: { where: { status: ContractorWorkerStatus.ACTIVE }, select: { id: true, firstName: true, lastName: true, jobTitle: true }, orderBy: { lastName: "asc" } } }, orderBy: { name: "asc" } }),
    getPublishedRuntimeForms(organizationId, ConfigurableFormModule.PERMIT_TO_WORK),
  ]);
  return <div className="mx-auto max-w-5xl"><Link href="/permits-to-work" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16}/>Back to permits</Link><h1 className="mt-5 text-4xl font-bold">Create Permit to Work</h1><p className="mt-2 text-slate-400">Define work boundaries, hazards, controls, authorized workers, and activation evidence.</p>
    <PermitCreateForm forms={forms} contractors={contractors} defaultContractorId={contractors.some(item => item.id === query.contractorId) ? query.contractorId : undefined}><div className="grid gap-5 md:grid-cols-2"><Field name="title" label="Work title" required/><label className="block text-sm">Permit type<select name="type" className={input}>{Object.values(PermitToWorkType).map(type => <option key={type}>{type}</option>)}</select></label><label className="block text-sm">Site<select name="siteId" required className={input}><option value="">Select site</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label><label className="block text-sm">Department<select name="departmentId" className={input}><option value="">No department</option>{departments.map(department => <option key={department.id} value={department.id}>{department.site.name} — {department.name}</option>)}</select></label><Field name="responsiblePerson" label="Responsible person" required/><Field name="exactLocation" label="Exact work location" required/><Field name="workOrderReference" label="Work order reference"/><Field name="plannedStartAt" label="Planned start" type="datetime-local" required/><Field name="plannedEndAt" label="Planned end" type="datetime-local" required/></div><Area name="description" label="Work description"/><Area name="hazardsSummary" label="Hazards summary" required/><Area name="controlsSummary" label="Control strategy summary" required/><label className="block text-sm">Individual controls (one per line) <span className="text-red-300">*</span><textarea name="controls" rows={6} required placeholder={"Energy sources isolated and locked out\nWork area barricaded\nFire watch assigned"} className={input}/></label><div className="grid gap-5 md:grid-cols-2"><Area name="requiredPpe" label="Required PPE"/><Area name="isolationDetails" label="Isolation details"/><Area name="emergencyPlan" label="Emergency / rescue plan"/></div><label className="flex items-center gap-3 rounded-xl border border-white/10 p-4 text-sm"><input type="checkbox" name="gasTestingRequired"/>Atmospheric gas testing is required before activation</label></PermitCreateForm>
  </div>;
}
function Field({ name, label, type = "text", required = false, defaultValue }: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string }) { return <label className="block text-sm">{label}<input name={name} type={type} required={required} defaultValue={defaultValue} className={input}/></label>; }
function Area({ name, label, required = false }: { name: string; label: string; required?: boolean }) { return <label className="block text-sm">{label}<textarea name={name} rows={3} required={required} className={input}/></label>; }
