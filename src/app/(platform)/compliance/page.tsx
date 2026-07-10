import { prisma } from "@/lib/prisma";
import { CalendarCheck } from "lucide-react";
import { getCurrentUserTenant } from "@/lib/tenant";

export default async function CompliancePage() {
  const { organizationId } = await getCurrentUserTenant();

const items = await prisma.complianceItem.findMany({
  where: {
    site: {
      organizationId,
    },
  },
  orderBy: {
    dueDate: "asc",
  },
  include: {
    site: true,
  },
});

  return (
    <div>
      <div className="mb-8">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <CalendarCheck size={16} />
          Compliance Calendar
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">Compliance</h1>

        <p className="mt-2 max-w-2xl text-slate-400">
          Track permits, inspections, regulatory deadlines, certifications, and
          recurring compliance obligations.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-slate-300">
            <tr>
              <th className="px-6 py-4 font-medium">Compliance Item</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Due Date</th>
              <th className="px-6 py-4 font-medium">Site</th>
              <th className="px-6 py-4 font-medium">Created</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-white/5 transition hover:bg-white/[0.03]"
              >
                <td className="px-6 py-5">
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="mt-1 line-clamp-1 max-w-md text-xs text-slate-400">
                    {item.description || "No description provided."}
                  </p>
                </td>

                <td className="px-6 py-5">
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                    {item.status.replaceAll("_", " ")}
                  </span>
                </td>

                <td className="px-6 py-5 text-slate-300">
                  {item.dueDate.toLocaleDateString()}
                </td>

                <td className="px-6 py-5 text-slate-300">
                  {item.site.name}
                </td>

                <td className="px-6 py-5 text-slate-400">
                  {item.createdAt.toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {items.length === 0 && (
          <div className="p-10 text-center text-slate-400">
            No compliance items found.
          </div>
        )}
      </div>
    </div>
  );
}