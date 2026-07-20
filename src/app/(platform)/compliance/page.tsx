import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";
import { CalendarCheck, Plus } from "lucide-react";
import Link from "next/link";

export default async function CompliancePage() {
  await requirePermission(PermissionKey.VIEW_COMPLIANCE);
  const [{ organizationId }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const canManage = permissions.includes(
    PermissionKey.MANAGE_COMPLIANCE
  );
  const items = await prisma.complianceItem.findMany({
    where: { site: { organizationId } },
    orderBy: { dueDate: "asc" },
    include: { site: true, owner: true },
  });

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <CalendarCheck size={16} />
            Compliance Governance
          </p>
          <h1 className="mt-2 text-4xl font-bold">
            Compliance Obligations
          </h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Manage legal requirements, regulatory deadlines, evaluations,
            evidence, and recurring obligations.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/compliance/permits"
            className="rounded-xl border border-white/10 px-4 py-2"
          >
            Permit Register
          </Link>
          {canManage && (
            <Link
              href="/compliance/new"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 font-semibold text-slate-950"
            >
              <Plus size={17} />
              New Obligation
            </Link>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/5">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-slate-300">
            <tr>
              <th className="px-6 py-4">Obligation</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Due</th>
              <th className="px-6 py-4">Site</th>
              <th className="px-6 py-4">Owner</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-white/5">
                <td className="px-6 py-5">
                  <Link
                    href={`/compliance/${item.id}`}
                    className="font-medium text-white hover:text-cyan-200"
                  >
                    {item.reference ? `${item.reference} — ` : ""}
                    {item.title}
                  </Link>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.obligationType.replaceAll("_", " ")} · {" "}
                    {item.authority || "Authority not recorded"}
                  </p>
                </td>
                <td className="px-6 py-5 text-cyan-300">
                  {item.status.replaceAll("_", " ")}
                </td>
                <td className="px-6 py-5">
                  {item.dueDate.toLocaleDateString()}
                </td>
                <td className="px-6 py-5">{item.site.name}</td>
                <td className="px-6 py-5">
                  {item.owner?.name || "Unassigned"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {items.length === 0 && (
          <p className="p-10 text-center text-slate-400">
            No compliance obligations found.
          </p>
        )}
      </div>
    </div>
  );
}
