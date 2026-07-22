import { hasPermission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";
import Link from "next/link";

export default async function ChemicalsPage() {
  await requirePermission(PermissionKey.VIEW_CHEMICALS);
  const [{ organizationId }, canManage] = await Promise.all([
    getCurrentUserTenant(),
    hasPermission(PermissionKey.MANAGE_CHEMICALS),
  ]);
  const items = await prisma.chemical.findMany({
    where: { organizationId },
    include: { inventories: true },
    orderBy: { productName: "asc" },
  });

  return (
    <div>
      <div className="flex justify-between gap-4">
        <div>
          <p className="text-sm text-cyan-300">Hazard Communication</p>
          <h1 className="mt-2 text-4xl font-bold">Chemical & SDS Register</h1>
          <p className="mt-2 text-slate-400">
            Control chemical approvals, SDS currency, hazards, storage, and site
            inventories.
          </p>
        </div>
        {canManage && (
          <Link
            href="/chemicals/new"
            className="h-fit rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950"
          >
            Add Chemical
          </Link>
        )}
      </div>
      <div className="mt-8 grid gap-4">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/chemicals/${item.id}`}
            className="rounded-3xl border border-white/10 bg-white/5 p-5"
          >
            <div className="flex justify-between">
              <p className="font-semibold">{item.productName}</p>
              <span className="text-cyan-300">{item.status}</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              {item.manufacturer || "Manufacturer not recorded"} · CAS{" "}
              {item.casNumber || "not recorded"} · {item.inventories.length}{" "}
              storage locations
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
