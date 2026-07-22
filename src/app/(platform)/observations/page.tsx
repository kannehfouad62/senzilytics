import { hasPermission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";
import Link from "next/link";

export default async function ObservationsPage() {
  await requirePermission(PermissionKey.VIEW_OBSERVATIONS);
  const [{ organizationId }, canCreate] = await Promise.all([
    getCurrentUserTenant(),
    hasPermission(PermissionKey.CREATE_OBSERVATION),
  ]);
  const items = await prisma.safetyObservation.findMany({
    where: { organizationId },
    include: { site: true, reportedBy: { select: { name: true } } },
    orderBy: { observedAt: "desc" },
  });

  return (
    <div>
      <div className="flex justify-between gap-4">
        <div>
          <p className="text-sm text-cyan-300">Proactive Safety</p>
          <h1 className="mt-2 text-4xl font-bold">Safety Observations</h1>
          <p className="mt-2 text-slate-400">
            Triage leading indicators and recognize positive practices.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/observations/new"
            className="h-fit rounded-2xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950"
          >
            Report Observation
          </Link>
        )}
      </div>
      <div className="mt-8 grid gap-4">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/observations/${item.id}`}
            className="rounded-3xl border border-white/10 bg-white/5 p-5"
          >
            <div className="flex justify-between">
              <div>
                <p className="font-semibold">
                  {item.reference} — {item.title}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {item.site.name} · {item.type.replaceAll("_", " ")} ·{" "}
                  {item.isAnonymous ? "Anonymous" : item.reportedBy.name}
                </p>
              </div>
              <span className="text-sm text-cyan-300">
                {item.status.replaceAll("_", " ")}
              </span>
            </div>
          </Link>
        ))}
        {!items.length && (
          <p className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-slate-400">
            No observations reported.
          </p>
        )}
      </div>
    </div>
  );
}
