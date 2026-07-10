import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions";
import { Activity, Clock } from "lucide-react";
import { PermissionKey } from "@prisma/client";

export default async function ActivityPage() {
  await requirePermission(PermissionKey.VIEW_ACTIVITY_LOG);

  const { organizationId } = await getCurrentUserTenant();

  const logs = await prisma.activityLog.findMany({
    where: {
      organizationId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
    include: {
      user: true,
    },
  });

  return (
    <div>
      <div className="mb-8">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <Activity size={16} />
          Enterprise Audit Trail
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          Activity Log
        </h1>

        <p className="mt-2 max-w-2xl text-slate-400">
          Review user activity, workflow changes, record updates, and system
          events across your organization.
        </p>
      </div>

      <div className="space-y-4">
        {logs.map((log) => (
          <div
            key={log.id}
            className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-cyan-300">{log.action}</p>
                <h2 className="mt-1 text-lg font-semibold">{log.title}</h2>
                <p className="mt-2 text-sm text-slate-400">
                  {log.description || "No description provided."}
                </p>
              </div>

              <div className="text-right text-sm text-slate-400">
                <p>{log.user?.name || "System"}</p>
                <p className="mt-1 flex items-center gap-1">
                  <Clock size={14} />
                  {log.createdAt.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-slate-300">
                {log.entityType}
              </span>

              {log.entityId && (
                <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-slate-500">
                  {log.entityId}
                </span>
              )}
            </div>
          </div>
        ))}

        {logs.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-slate-400">
            No activity logs found.
          </div>
        )}
      </div>
    </div>
  );
}