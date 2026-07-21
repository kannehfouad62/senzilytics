import { ComplianceObligationCreateForm } from "@/features/compliance/compliance-obligation-create-form";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import {
  ComplianceObligationType,
  ComplianceRecurrence,
  ConfigurableFormModule,
  PermissionKey,
} from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3";

export default async function NewComplianceObligationPage() {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE);
  const { organizationId } = await getCurrentUserTenant();
  const [sites, users, sources, forms] = await Promise.all([
    prisma.site.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.regulatorySource.findMany({ where: { organizationId, status: "ACTIVE" }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
    getPublishedRuntimeForms(
      organizationId,
      ConfigurableFormModule.COMPLIANCE
    ),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/compliance"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to compliance
      </Link>

      <div className="mt-6">
        <p className="text-sm text-cyan-300">Compliance Governance</p>
        <h1 className="mt-2 text-4xl font-bold">
          Create Compliance Obligation
        </h1>
        <p className="mt-2 max-w-3xl text-slate-400">
          Register an applicable legal, regulatory, permit, contractual, or
          internal obligation and its recurring evaluation requirements.
        </p>
      </div>

      <ComplianceObligationCreateForm forms={forms}>
        <label className="block text-sm">
          Title
          <input name="title" required className={inputClassName} />
        </label>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="block text-sm">
            Reference
            <input name="reference" className={inputClassName} />
          </label>

          <label className="block text-sm">
            Obligation type
            <select name="obligationType" className={inputClassName}>
              {Object.values(ComplianceObligationType).map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            Authority
            <input name="authority" className={inputClassName} />
          </label>

          <label className="block text-sm">
            Jurisdiction
            <input name="jurisdiction" className={inputClassName} />
          </label>

          <label className="block text-sm md:col-span-2">
            Legal reference
            <input name="legalReference" className={inputClassName} />
          </label>

          <label className="block text-sm md:col-span-2">
            Governed regulatory source
            <select name="regulatorySourceId" className={inputClassName}>
              <option value="">Not linked</option>
              {sources.map((source) => <option key={source.id} value={source.id}>{source.code} — {source.name}</option>)}
            </select>
          </label>

          <label className="block text-sm">
            Due date
            <input
              type="date"
              name="dueDate"
              required
              className={inputClassName}
            />
          </label>

          <label className="block text-sm">
            Recurrence
            <select name="recurrence" className={inputClassName}>
              {Object.values(ComplianceRecurrence).map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            Recurrence interval
            <input
              type="number"
              min="1"
              step="1"
              name="intervalValue"
              defaultValue="1"
              required
              className={inputClassName}
            />
          </label>

          <label className="block text-sm">
            Site
            <select
              name="siteId"
              required
              defaultValue=""
              className={inputClassName}
            >
              <option value="" disabled>
                Select a site
              </option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm md:col-span-2">
            Owner
            <select name="ownerId" className={inputClassName}>
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                  {user.jobTitle ? ` — ${user.jobTitle}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm">
          Applicability
          <textarea
            name="applicability"
            rows={3}
            className={inputClassName}
          />
        </label>

        <label className="block text-sm">
          Evidence required
          <textarea
            name="evidenceRequired"
            rows={3}
            className={inputClassName}
          />
        </label>

        <label className="block text-sm">
          Description
          <textarea
            name="description"
            rows={4}
            className={inputClassName}
          />
        </label>

        {sites.length === 0 && (
          <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
            Add a site before creating a compliance obligation.
          </p>
        )}
      </ComplianceObligationCreateForm>
    </div>
  );
}
