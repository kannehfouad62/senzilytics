import { TrainingAssignmentForm } from "@/features/training/training-assignment-form";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import { ConfigurableFormModule, PermissionKey } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3";

export default async function AssignTrainingPage() {
  await requirePermission(PermissionKey.MANAGE_TRAINING);
  const { organizationId } = await getCurrentUserTenant();
  const [courses, users, forms] = await Promise.all([
    prisma.trainingCourse.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
    }),
    getPublishedRuntimeForms(
      organizationId,
      ConfigurableFormModule.TRAINING
    ),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/training"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to training
      </Link>
      <h1 className="mt-5 text-4xl font-bold">Assign Training</h1>
      <p className="mt-2 text-slate-400">
        Assign a course and capture any organization-specific training controls.
      </p>

      <TrainingAssignmentForm forms={forms}>
        <label className="block text-sm">
          Course
          <select
            name="courseId"
            required
            defaultValue=""
            className={inputClassName}
          >
            <option value="" disabled>
              Select a course
            </option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} — {course.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          Employee
          <select
            name="userId"
            required
            defaultValue=""
            className={inputClassName}
          >
            <option value="" disabled>
              Select an employee
            </option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
                {user.jobTitle ? ` — ${user.jobTitle}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          Due date
          <input
            type="date"
            name="dueDate"
            required
            className={inputClassName}
          />
        </label>
      </TrainingAssignmentForm>
    </div>
  );
}
