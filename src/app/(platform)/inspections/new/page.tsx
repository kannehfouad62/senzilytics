import { InspectionCreateForm } from "@/features/inspections/inspection-create-form";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import {
  ConfigurableFormModule,
  InspectionType,
  PermissionKey,
} from "@prisma/client";
import {
  ArrowLeft,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

export default async function NewInspectionPage() {
  await requirePermission(
    PermissionKey.MANAGE_INSPECTIONS
  );

  const { organizationId } =
    await getCurrentUserTenant();

  const [
    sites,
    users,
    checklistTemplates,
    forms,
  ] = await Promise.all([
    prisma.site.findMany({
      where: {
        organizationId,
      },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
      },
      orderBy: {
        name: "asc",
      },
    }),

    prisma.user.findMany({
      where: {
        organizationId,
      },
      select: {
        id: true,
        name: true,
        role: true,
        jobTitle: true,
      },
      orderBy: {
        name: "asc",
      },
    }),

    prisma.inspectionChecklistTemplate.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        version: true,
        inspectionType: true,
        sections: {
          select: {
            questions: {
              select: {
                id: true,
              },
            },
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
    }),

    getPublishedRuntimeForms(
      organizationId,
      ConfigurableFormModule.INSPECTION
    ),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/inspections"
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to inspections
      </Link>

      <div className="mt-6">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <ShieldCheck size={16} />
          Inspection Planning
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          Create Inspection
        </h1>

        <p className="mt-2 max-w-3xl text-slate-400">
          Define the inspection area,
          ownership, schedule, and
          checklist used during field
          execution.
        </p>
      </div>

      <InspectionCreateForm
        forms={forms}
        cancelHref="/inspections"
        submitDisabled={
          sites.length === 0
        }
        submitLabel="Create Inspection"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Inspection title">
            <input
              name="title"
              required
              placeholder="Example: Monthly Warehouse Safety Inspection"
              className={inputClassName}
            />
          </Field>

          <Field label="Reference number">
            <input
              name="reference"
              placeholder="INS-2026-001"
              className={inputClassName}
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            name="description"
            rows={5}
            placeholder="Describe the purpose, scope, and operating conditions covered by this inspection."
            className={inputClassName}
          />
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Inspection type">
            <select
              name="type"
              defaultValue={
                InspectionType.ROUTINE
              }
              className={inputClassName}
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

          <Field label="Inspection area">
            <input
              name="area"
              placeholder="Example: Warehouse Loading Dock"
              className={inputClassName}
            />
          </Field>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Site">
            <select
              name="siteId"
              required
              defaultValue=""
              className={inputClassName}
            >
              <option
                value=""
                disabled
              >
                Select a site
              </option>

              {sites.map(
                (site) => (
                  <option
                    key={site.id}
                    value={site.id}
                  >
                    {site.name}
                    {site.city
                      ? ` — ${site.city}`
                      : ""}
                    {site.state
                      ? `, ${site.state}`
                      : ""}
                  </option>
                )
              )}
            </select>
          </Field>

          <Field label="Lead inspector">
            <select
              name="leadInspectorId"
              defaultValue=""
              className={inputClassName}
            >
              <option value="">
                Not assigned
              </option>

              {users.map(
                (user) => (
                  <option
                    key={user.id}
                    value={user.id}
                  >
                    {user.name} —{" "}
                    {user.jobTitle ||
                      user.role.replaceAll(
                        "_",
                        " "
                      )}
                  </option>
                )
              )}
            </select>
          </Field>
        </div>

        <Field label="Checklist template">
          <select
            name="checklistTemplateId"
            defaultValue=""
            className={inputClassName}
          >
            <option value="">
              No checklist template
            </option>

            {checklistTemplates.map(
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
                  <option
                    key={template.id}
                    value={template.id}
                  >
                    {template.name} v
                    {template.version} —{" "}
                    {template.inspectionType.replaceAll(
                      "_",
                      " "
                    )}{" "}
                    — {questionCount}{" "}
                    questions
                  </option>
                );
              }
            )}
          </select>
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Scheduled date">
            <DateInput
              name="scheduledAt"
            />
          </Field>

          <Field label="Completion due date">
            <DateInput
              name="dueDate"
            />
          </Field>
        </div>

        {sites.length === 0 && (
          <div className="rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4 text-sm text-orange-200">
            Your organization does not
            have a site available. Create
            a site before creating an
            inspection.
          </div>
        )}

      </InspectionCreateForm>
    </div>
  );
}

const inputClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-slate-200">
      {label}
      {children}
    </label>
  );
}

function DateInput({
  name,
}: {
  name: string;
}) {
  return (
    <div className="relative">
      <CalendarDays
        size={17}
        className="pointer-events-none absolute left-4 top-1/2 mt-1 -translate-y-1/2 text-slate-500"
      />

      <input
        name={name}
        type="datetime-local"
        className={`${inputClassName} pl-11`}
      />
    </div>
  );
}
