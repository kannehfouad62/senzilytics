import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { AlertTriangle, Plus } from "lucide-react";
import Link from "next/link";
import { hasPermission, requirePermission } from "@/lib/permissions";
import { PermissionKey } from "@prisma/client";

function badgeClass(value: string) {
  switch (value) {
    case "LOW":
      return "bg-green-400/10 text-green-300 border-green-400/20";
    case "MEDIUM":
      return "bg-orange-400/10 text-orange-300 border-orange-400/20";
    case "HIGH":
      return "bg-red-400/10 text-red-300 border-red-400/20";
    case "CRITICAL":
      return "bg-purple-400/10 text-purple-300 border-purple-400/20";
    default:
      return "bg-slate-400/10 text-slate-300 border-slate-400/20";
  }
}

export default async function IncidentsPage() {
  await requirePermission(PermissionKey.VIEW_INCIDENT);
  const [{ organizationId }, canCreate] = await Promise.all([
    getCurrentUserTenant(),
    hasPermission(PermissionKey.CREATE_INCIDENT),
  ]);

  const incidents = await prisma.incident.findMany({
    where: {
      site: {
        organizationId,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      site: true,
      reportedBy: true,
    },
  });

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <AlertTriangle size={16} />
            Safety Event Management
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">Incidents</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Track injuries, near misses, environmental events, property damage,
            investigations, and corrective actions.
          </p>
        </div>

        {canCreate && <Link
          href="/incidents/new"
          className="flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          <Plus size={18} />
          New Incident
        </Link>}
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-slate-300">
            <tr>
              <th className="px-6 py-4 font-medium">Title</th>
              <th className="px-6 py-4 font-medium">Type</th>
              <th className="px-6 py-4 font-medium">Risk</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Site</th>
              <th className="px-6 py-4 font-medium">Reported By</th>
              <th className="px-6 py-4 font-medium">Date</th>
            </tr>
          </thead>

          <tbody>
            {incidents.map((incident) => (
              <tr
                key={incident.id}
                className="border-b border-white/5 transition hover:bg-white/[0.03]"
              >
                <td className="px-6 py-5">
                  <div>
                    <Link
                      href={`/incidents/${incident.id}`}
                      className="font-medium text-white hover:text-cyan-300"
                    >
                      {incident.title}
                    </Link>
                    <p className="mt-1 line-clamp-1 max-w-md text-xs text-slate-400">
                      {incident.description}
                    </p>
                  </div>
                </td>

                <td className="px-6 py-5 text-slate-300">
                  {incident.type.replaceAll("_", " ")}
                </td>

                <td className="px-6 py-5">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${badgeClass(
                      incident.riskLevel
                    )}`}
                  >
                    {incident.riskLevel}
                  </span>
                </td>

                <td className="px-6 py-5">
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                    {incident.status.replaceAll("_", " ")}
                  </span>
                </td>

                <td className="px-6 py-5 text-slate-300">
                  {incident.site.name}
                </td>

                <td className="px-6 py-5 text-slate-300">
                  {incident.reportedBy.name}
                </td>

                <td className="px-6 py-5 text-slate-400">
                  {incident.createdAt.toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {incidents.length === 0 && (
          <div className="p-10 text-center text-slate-400">
            No incidents found.
          </div>
        )}
      </div>
    </div>
  );
}
