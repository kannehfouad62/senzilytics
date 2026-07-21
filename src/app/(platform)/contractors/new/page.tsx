import { ContractorCreateForm } from "@/features/contractors/contractor-create-form";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import { ConfigurableFormModule, PermissionKey } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const input = "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3";
export default async function NewContractorPage() {
  await requirePermission(PermissionKey.MANAGE_CONTRACTORS);
  const { organizationId } = await getCurrentUserTenant();
  const [sites, forms] = await Promise.all([prisma.site.findMany({ where: { organizationId }, orderBy: { name: "asc" } }), getPublishedRuntimeForms(organizationId, ConfigurableFormModule.CONTRACTOR)]);
  return <div className="mx-auto max-w-5xl"><Link href="/contractors" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16}/>Back to contractors</Link><h1 className="mt-5 text-4xl font-bold">Register Contractor</h1><p className="mt-2 text-slate-400">Capture third-party qualifications and authorize where the contractor may perform work.</p>
    <ContractorCreateForm forms={forms}><div className="grid gap-5 md:grid-cols-2"><Field name="name" label="Trading name" required/><Field name="legalName" label="Legal name"/><Field name="registrationNumber" label="Registration number"/><Field name="taxIdentifier" label="Tax identifier"/><Field name="primaryContactName" label="Primary contact"/><Field name="primaryContactEmail" label="Contact email" type="email"/><Field name="primaryContactPhone" label="Contact phone"/><Field name="safetyRating" label="Safety rating (0–100)" type="number"/><Field name="insuranceProvider" label="Insurance provider"/><Field name="insurancePolicyNumber" label="Policy number"/><Field name="insuranceExpiresAt" label="Insurance expires" type="date" required/></div>
      <label className="block text-sm">Services<textarea name="services" rows={3} className={input}/></label><label className="block text-sm">Safety program summary<textarea name="safetyProgramSummary" rows={4} className={input}/></label><fieldset><legend className="text-sm">Authorized sites <span className="text-red-300">*</span></legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{sites.map(site => <label key={site.id} className="flex items-center gap-3 rounded-xl border border-white/10 p-3 text-sm"><input type="checkbox" name="siteIds" value={site.id}/>{site.name}</label>)}</div>{!sites.length && <p className="mt-2 text-sm text-amber-300">Create an organization site before registering a contractor.</p>}</fieldset><label className="block text-sm">Internal notes<textarea name="notes" rows={3} className={input}/></label>
    </ContractorCreateForm></div>;
}
function Field({ name, label, type = "text", required = false }: { name: string; label: string; type?: string; required?: boolean }) { return <label className="block text-sm">{label}<input name={name} type={type} required={required} min={name === "safetyRating" ? 0 : undefined} max={name === "safetyRating" ? 100 : undefined} className={input}/></label>; }
