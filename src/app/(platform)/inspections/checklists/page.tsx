import { createInspectionChecklistTemplate } from "@/features/inspections/inspection-checklist.actions";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  InspectionType,
  PermissionKey,
} from "@prisma/client";
import {
  ClipboardList,
  Plus,
} from "lucide-react";
import Link from "next/link";

export default async function InspectionChecklistsPage() {
  await requirePermission(
    PermissionKey.MANAGE_INSPECTIONS
  );

  const { organizationId } =
    await getCurrentUserTenant();

  const templates =
    await prisma.inspectionChecklistTemplate.findMany({
      where: {
        organizationId,
      },
      include: {
        sections: {
          include: {
            questions: {
              select: {
                id: true,
              },
            },
          },
        },
        inspections: {
          select: {
            id: true,
          },
        },
      },
      orderBy: [
        {
          name: "asc",
        },
        {
          version: "desc",
        },
      ],
    });

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <ClipboardList size={16} />
            Inspection Administration
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Inspection Checklists
          </h1>

          <p className="mt-2 max-w-2xl text-slate-400">
            Build reusable, versioned
            checklists for consistent
            operational inspections.
          </p>
        </div>

        <Link
          href="/inspections"
          className="rounded-2xl border border-white/10 px-5 py-3 text-sm text-slate-300"
        >
          Back to Inspections
        </Link>
      </div>

      <div className="mt-8 grid gap-7 xl:grid-cols-[1fr_380px]">
        <section className="space-y-4">
          {templates.map(
            (template) => {
              const questionCount =
                template.sections.reduce(
                  (
                    total,
                    section
                  ) =>
                    total +
                    section.questions
                      .length,
                  0
                );

              return (
                <Link
                  key={template.id}
                  href={`/inspections/checklists/${template.id}`}
                  className="block rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-cyan-400/30"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-cyan-300">
                        {template.inspectionType.replaceAll(
                          "_",
                          " "
                        )}{" "}
                        · Version{" "}
                        {template.version}
                      </p>

                      <h2 className="mt-2 text-xl font-semibold text-white">
                        {template.name}
                      </h2>

                      <p className="mt-2 text-sm text-slate-400">
                        {template.description ||
                          "No description provided."}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs ${
                        template.isActive
                          ? "border-green-400/20 bg-green-400/10 text-green-300"
                          : "border-slate-400/20 bg-slate-400/10 text-slate-300"
                      }`}
                    >
                      {template.isActive
                        ? "ACTIVE"
                        : "INACTIVE"}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <Metric
                      label="Sections"
                      value={
                        template.sections
                          .length
                      }
                    />

                    <Metric
                      label="Questions"
                      value={questionCount}
                    />

                    <Metric
                      label="Inspections using"
                      value={
                        template.inspections
                          .length
                      }
                    />
                  </div>
                </Link>
              );
            }
          )}

          {templates.length ===
            0 && (
            <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center text-slate-400">
              No inspection checklist
              templates have been created.
            </div>
          )}
        </section>

        <form
          action={
            createInspectionChecklistTemplate
          }
          className="h-fit rounded-3xl border border-white/10 bg-white/5 p-6"
        >
          <div className="flex items-center gap-2">
            <Plus
              size={18}
              className="text-cyan-300"
            />

            <h2 className="text-lg font-semibold text-white">
              Create Template
            </h2>
          </div>

          <div className="mt-5 space-y-4">
            <Field label="Template name">
              <input
                name="name"
                required
                className={inputClass}
              />
            </Field>

            <Field label="Description">
              <textarea
                name="description"
                rows={4}
                className={inputClass}
              />
            </Field>

            <Field label="Inspection type">
              <select
                name="inspectionType"
                defaultValue={
                  InspectionType.ROUTINE
                }
                className={inputClass}
              >
                {Object.values(
                  InspectionType
                ).map((type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {type.replaceAll(
                      "_",
                      " "
                    )}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <button
            type="submit"
            className="mt-5 w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950"
          >
            Create Template
          </button>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      {children}
    </label>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-lg font-semibold text-white">
        {value}
      </p>
    </div>
  );
}