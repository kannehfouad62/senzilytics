import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";

export default async function EnterpriseAuditsPage() {
  const { organizationId } = await getCurrentUserTenant();

  const audits = await prisma.enterpriseAudit.findMany({
    where: {
      organizationId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      reference: true,
      title: true,
      status: true,
      dueDate: true,
    },
  });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">
          Enterprise Audits
        </h1>

        <p className="mt-1 text-sm text-slate-400">
          View and manage enterprise audits.
        </p>
      </div>

      <div className="space-y-3">
        {audits.map((audit) => (
          <Link
            key={audit.id}
            href={`/audit-management/audit/${audit.id}`}
            className="block rounded-2xl border border-white/10 bg-slate-900/60 p-5 transition hover:border-cyan-400/40"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500">
                  {audit.reference}
                </p>

                <h2 className="mt-1 font-medium text-white">
                  {audit.title}
                </h2>
              </div>

              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                {audit.status.replaceAll("_", " ")}
              </span>
            </div>

            {audit.dueDate && (
              <p className="mt-3 text-xs text-slate-500">
                Due: {audit.dueDate.toLocaleDateString()}
              </p>
            )}
          </Link>
        ))}

        {audits.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-400">
            No enterprise audits were found.
          </div>
        )}
      </div>
    </main>
  );
}