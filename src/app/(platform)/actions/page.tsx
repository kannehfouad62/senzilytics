import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";

function riskClass(value: string) {
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

export default async function ActionsPage() {
  const { organizationId } = await getCurrentUserTenant();

  const actions = await prisma.correctiveAction.findMany({
    where: {
      incident: {
        site: {
          organizationId,
        },
      },
    },
    orderBy: {
      dueDate: "asc",
    },
    include: {
      assignedTo: true,
      incident: {
        include: {
          site: true,
        },
      },
    },
  });

  return (
    <div>
      <div className="mb-8">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <ClipboardCheck size={16} />
          CAPA Management
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          Corrective Actions
        </h1>

        <p className="mt-2 max-w-2xl text-slate-400">
          Track corrective and preventive actions across incidents,
          investigations, inspections, and audits.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-slate-300">
            <tr>
              <th className="px-6 py-4 font-medium">Action</th>
              <th className="px-6 py-4 font-medium">Risk</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Owner</th>
              <th className="px-6 py-4 font-medium">Due Date</th>
              <th className="px-6 py-4 font-medium">Related Incident</th>
              <th className="px-6 py-4 font-medium">Site</th>
            </tr>
          </thead>

          <tbody>
            {actions.map((action) => (
              <tr
                key={action.id}
                className="border-b border-white/5 transition hover:bg-white/[0.03]"
              >
                <td className="px-6 py-5">
                  <p className="font-medium text-white">{action.title}</p>
                  <p className="mt-1 line-clamp-1 max-w-md text-xs text-slate-400">
                    {action.description || "No description provided."}
                  </p>
                </td>

                <td className="px-6 py-5">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${riskClass(
                      action.riskLevel
                    )}`}
                  >
                    {action.riskLevel}
                  </span>
                </td>

                <td className="px-6 py-5">
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                    {action.status.replaceAll("_", " ")}
                  </span>
                </td>

                <td className="px-6 py-5 text-slate-300">
                  {action.assignedTo.name}
                </td>

                <td className="px-6 py-5 text-slate-300">
                  {action.dueDate.toLocaleDateString()}
                </td>

                <td className="px-6 py-5">
                  {action.incident ? (
                    <Link
                      href={`/incidents/${action.incident.id}`}
                      className="text-cyan-300 hover:text-cyan-200"
                    >
                      {action.incident.title}
                    </Link>
                  ) : (
                    <span className="text-slate-500">Standalone action</span>
                  )}
                </td>

                <td className="px-6 py-5 text-slate-300">
                  {action.incident?.site.name || "N/A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {actions.length === 0 && (
          <div className="p-10 text-center text-slate-400">
            No corrective actions found.
          </div>
        )}
      </div>
    </div>
  );
}