import { CapaCreateForm } from "@/features/capa/capa-create-form";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import {
  ConfigurableFormModule,
  PermissionKey,
  RiskLevel,
} from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3";

export default async function NewCapaPage() {
  await requirePermission(
    PermissionKey.CREATE_CAPA
  );

  const { organizationId } =
    await getCurrentUserTenant();

  const [users, forms] =
    await Promise.all([
      prisma.user.findMany({
        where: {
          organizationId,
        },
        select: {
          id: true,
          name: true,
          jobTitle: true,
          role: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
      getPublishedRuntimeForms(
        organizationId,
        ConfigurableFormModule.CAPA
      ),
    ]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/actions"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to corrective actions
      </Link>

      <div className="mt-6">
        <p className="text-sm text-cyan-300">
          Corrective and Preventive Action
        </p>
        <h1 className="mt-2 text-4xl font-bold">
          Create Standalone CAPA
        </h1>
        <p className="mt-2 max-w-3xl text-slate-400">
          Create a governed corrective action that is not generated from an incident, inspection, or audit finding.
        </p>
      </div>

      <CapaCreateForm forms={forms}>
        <label className="block text-sm">
          Action title
          <input
            name="title"
            required
            className={inputClassName}
          />
        </label>

        <label className="block text-sm">
          Description
          <textarea
            name="description"
            rows={5}
            className={inputClassName}
          />
        </label>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="block text-sm">
            Risk level
            <select
              name="riskLevel"
              defaultValue={
                RiskLevel.MEDIUM
              }
              className={
                inputClassName
              }
            >
              {Object.values(
                RiskLevel
              ).map((riskLevel) => (
                <option
                  key={riskLevel}
                  value={riskLevel}
                >
                  {riskLevel}
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
              className={
                inputClassName
              }
            />
          </label>

          <label className="block text-sm md:col-span-2">
            Assigned owner
            <select
              name="assignedToId"
              required
              defaultValue=""
              className={
                inputClassName
              }
            >
              <option
                value=""
                disabled
              >
                Select an owner
              </option>
              {users.map((user) => (
                <option
                  key={user.id}
                  value={user.id}
                >
                  {user.name} — {" "}
                  {user.jobTitle ||
                    user.role.replaceAll(
                      "_",
                      " "
                    )}
                </option>
              ))}
            </select>
          </label>
        </div>

        {users.length === 0 && (
          <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
            Add an active tenant user before creating a corrective action.
          </p>
        )}
      </CapaCreateForm>
    </div>
  );
}
