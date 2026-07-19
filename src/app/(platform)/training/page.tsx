import { prisma } from "@/lib/prisma";
import { GraduationCap } from "lucide-react";
import { getCurrentUserTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions";
import { PermissionKey } from "@prisma/client";
import Link from "next/link";
import { completeTraining } from "@/features/training/actions";

export default async function TrainingPage() {
  await requirePermission(PermissionKey.VIEW_TRAINING);
  const { organizationId } = await getCurrentUserTenant();

const records = await prisma.trainingRecord.findMany({
  where: {
    user: {
      organizationId,
    },
  },
  orderBy: {
    dueDate: "asc",
  },
  include: {
    user: true,
  },
});

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <GraduationCap size={16} />
          Training Management
        </p>
        </div>
        <div className="flex gap-3"><Link href="/training/courses" className="rounded-xl border border-white/10 px-4 py-2">Course Catalog</Link><Link href="/training/assign" className="rounded-xl bg-cyan-300 px-4 py-2 font-semibold text-slate-950">Assign Training</Link></div>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">Training</h1>

        <p className="mt-2 max-w-2xl text-slate-400">
          Track employee safety training, course completion, expiration dates,
          and overdue learning requirements.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-slate-300">
            <tr>
              <th className="px-6 py-4 font-medium">Course</th>
              <th className="px-6 py-4 font-medium">Employee</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Due Date</th>
              <th className="px-6 py-4 font-medium">Completed</th>
              <th className="px-6 py-4 font-medium">Expiry</th>
              <th className="px-6 py-4 font-medium">Record completion</th>
            </tr>
          </thead>

          <tbody>
            {records.map((record) => (
              <tr
                key={record.id}
                className="border-b border-white/5 transition hover:bg-white/[0.03]"
              >
                <td className="px-6 py-5">
                  <p className="font-medium text-white">{record.courseName}</p>
                </td>

                <td className="px-6 py-5 text-slate-300">
                  {record.user.name}
                </td>

                <td className="px-6 py-5">
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                    {record.status.replaceAll("_", " ")}
                  </span>
                </td>

                <td className="px-6 py-5 text-slate-300">
                  {record.dueDate
                    ? record.dueDate.toLocaleDateString()
                    : "No due date"}
                </td>

                <td className="px-6 py-5 text-slate-400">
                  {record.completedAt
                    ? record.completedAt.toLocaleDateString()
                    : "Not completed"}
                </td>
                <td className="px-6 py-5 text-slate-400">{record.expiresAt?.toLocaleDateString()||"—"}</td>
                <td className="px-6 py-5">{record.status!=="COMPLETED"?<form action={completeTraining} className="flex flex-col gap-2"><input type="hidden" name="id" value={record.id}/><input type="date" name="completedAt" required className="rounded-lg bg-slate-950 px-2 py-1"/><input name="certificateNumber" placeholder="Certificate #" className="rounded-lg bg-slate-950 px-2 py-1"/><button className="rounded-lg bg-emerald-300 px-3 py-1 text-slate-950">Complete</button></form>:<span className="text-emerald-300">Recorded</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {records.length === 0 && (
          <div className="p-10 text-center text-slate-400">
            No training records found.
          </div>
        )}
      </div>
    </div>
  );
}
