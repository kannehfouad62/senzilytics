import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";
import { GraduationCap } from "lucide-react";
import Link from "next/link";

export default async function TrainingPage() {
  await requirePermission(PermissionKey.VIEW_TRAINING);
  const [{ organizationId }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const canManage = permissions.includes(PermissionKey.MANAGE_TRAINING);
  const records = await prisma.trainingRecord.findMany({
    where: { user: { organizationId } },
    orderBy: { dueDate: "asc" },
    include: { user: true },
  });

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <GraduationCap size={16} />
            Training Management
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">Training</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Track employee safety training, course completion, expiration dates,
            certificates, and overdue learning requirements.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/training/dashboard"
            className="rounded-xl border border-white/10 px-4 py-2"
          >
            Analytics
          </Link>
          {canManage && (
            <>
              <Link
                href="/training/requirements"
                className="rounded-xl border border-white/10 px-4 py-2"
              >
                Requirements
              </Link>
              <Link
                href="/training/courses"
                className="rounded-xl border border-white/10 px-4 py-2"
              >
                Course Catalog
              </Link>
              <Link
                href="/training/assign"
                className="rounded-xl bg-cyan-300 px-4 py-2 font-semibold text-slate-950"
              >
                Assign Training
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-slate-300">
            <tr>
              <th className="px-6 py-4 font-medium">Course</th>
              <th className="px-6 py-4 font-medium">Employee</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Due Date</th>
              <th className="px-6 py-4 font-medium">Completed</th>
              <th className="px-6 py-4 font-medium">Expiry</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr
                key={record.id}
                className="border-b border-white/5 transition hover:bg-white/[0.03]"
              >
                <td className="px-6 py-5">
                  <Link
                    href={`/training/${record.id}`}
                    className="font-medium text-white hover:text-cyan-200"
                  >
                    {record.courseName}
                  </Link>
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
                  {record.dueDate?.toLocaleDateString() || "No due date"}
                </td>
                <td className="px-6 py-5 text-slate-400">
                  {record.completedAt?.toLocaleDateString() || "Not completed"}
                </td>
                <td className="px-6 py-5 text-slate-400">
                  {record.expiresAt?.toLocaleDateString() || "—"}
                </td>
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
