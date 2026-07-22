import { OrganizationStructureManager } from "@/features/identity/organization-structure-forms";
import { configureTenantIdentityProvider } from "@/features/identity/tenant.actions";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";
import { Building2, ShieldCheck } from "lucide-react";

const input =
  "rounded-xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400/40";

export default async function OrganizationsPage() {
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const { organizationId } = await getCurrentUserTenant();

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    include: {
      sites: {
        include: { departments: { orderBy: { name: "asc" } } },
        orderBy: { name: "asc" },
      },
      identityProviders: { orderBy: { type: "asc" } },
      _count: { select: { users: true } },
    },
  });

  const departmentCount = organization.sites.reduce(
    (total, site) => total + site.departments.length,
    0,
  );

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <Building2 size={16} /> Enterprise Structure
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Organization settings
          </h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Manage your tenant&apos;s sites, departments, and enterprise identity
            configuration.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <StatCard label="Sites" value={organization.sites.length.toString()} />
          <StatCard label="Departments" value={departmentCount.toString()} />
          <StatCard label="Users" value={organization._count.users.toString()} />
        </div>
      </div>

      <section className="mb-8 rounded-3xl border border-white/10 bg-white/[.04] p-6">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <ShieldCheck size={16} /> Enterprise identity
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Single sign-on</h2>
        <p className="mt-2 text-sm text-slate-400">
          Configure Microsoft Entra ID or Okta for {organization.name}. Existing
          connections: {organization.identityProviders.length}.
        </p>
        <form
          action={configureTenantIdentityProvider}
          className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5"
        >
          <select name="type" className={input}>
            <option value="MICROSOFT_ENTRA">Microsoft Entra ID</option>
            <option value="OKTA">Okta</option>
          </select>
          <input
            name="issuer"
            required
            placeholder="OIDC issuer URL"
            className={input}
          />
          <input
            name="directoryId"
            placeholder="Microsoft directory ID"
            className={input}
          />
          <input name="emailDomain" placeholder="company.com" className={input} />
          <button className="rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950">
            Configure SSO
          </button>
          <label className="text-sm xl:col-span-5">
            <input type="checkbox" name="enforceSso" className="mr-2" />
            Require SSO for this tenant
          </label>
        </form>
      </section>

      <OrganizationStructureManager sites={organization.sites} />

      <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
        <p className="text-sm text-slate-500">Tenant profile</p>
        <h2 className="mt-2 text-2xl font-semibold">{organization.name}</h2>
        <p className="mt-2 text-sm text-slate-400">
          {organization.industry || "Industry not provided"}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {organization.address || "Organization address not provided"}
        </p>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24 rounded-2xl border border-white/10 bg-slate-950/50 px-5 py-4 text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
