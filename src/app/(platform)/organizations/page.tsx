import { prisma } from "@/lib/prisma";
import { Building2, MapPin, Users } from "lucide-react";
import { getCurrentUserTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions";
import { PermissionKey } from "@prisma/client";

export default async function OrganizationsPage() {
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const { organizationId } = await getCurrentUserTenant();

const organizations = await prisma.organization.findMany({
  where: {
    id: organizationId,
  },
  orderBy: { name: "asc" },
  include: {
    sites: {
      include: {
        departments: true,
      },
    },
    users: true,
  },
});

  return (
    <div>
      <div className="mb-8">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <Building2 size={16} />
          Enterprise Structure
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          Organizations
        </h1>

        <p className="mt-2 max-w-2xl text-slate-400">
          Manage organizations, sites, departments, and operational structure.
        </p>
      </div>

      <div className="grid gap-6">
        {organizations.map((org) => (
          <div
            key={org.id}
            className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">{org.name}</h2>
                <p className="mt-2 text-sm text-slate-400">
                  {org.industry || "No industry provided"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {org.address || "No address provided"}
                </p>
              </div>

              <div className="flex gap-3">
                <StatCard label="Sites" value={org.sites.length.toString()} />
                <StatCard label="Users" value={org.users.length.toString()} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {org.sites.map((site) => (
                <div
                  key={site.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/50 p-5"
                >
                  <p className="flex items-center gap-2 font-medium text-white">
                    <MapPin size={16} className="text-cyan-300" />
                    {site.name}
                  </p>

                  <p className="mt-2 text-sm text-slate-400">
                    {[site.city, site.state, site.country]
                      .filter(Boolean)
                      .join(", ") || "No location provided"}
                  </p>

                  <div className="mt-4">
                    <p className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                      <Users size={14} />
                      Departments
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {site.departments.map((department) => (
                        <span
                          key={department.id}
                          className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300"
                        >
                          {department.name}
                        </span>
                      ))}

                      {site.departments.length === 0 && (
                        <span className="text-xs text-slate-500">
                          No departments
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {org.sites.length === 0 && (
                <p className="text-sm text-slate-500">No sites found.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-5 py-4 text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}