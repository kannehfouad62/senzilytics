import { createAudit } from "@/features/audits/actions";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  AuditType,
  PermissionKey,
} from "@prisma/client";
import {
  ArrowLeft,
  CalendarDays,
  SearchCheck,
} from "lucide-react";
import Link from "next/link";

export default async function NewAuditPage() {
  await requirePermission(
    PermissionKey.MANAGE_AUDITS
  );

  const { organizationId } =
    await getCurrentUserTenant();

  const [
    sites,
    users,
    checklistTemplates,
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

    prisma.auditChecklistTemplate.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        version: true,
        auditType: true,
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
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/audits"
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to audits
      </Link>

      <div className="mt-6">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <SearchCheck size={16} />
          Audit Planning
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          Create Audit
        </h1>

        <p className="mt-2 max-w-3xl text-slate-400">
          Establish the audit scope,
          ownership, schedule, and
          checklist used during execution.
        </p>
      </div>

      <form
        action={createAudit}
        className="mt-8 space-y-7 rounded-3xl border border-white/10 bg-white/5 p-7 shadow-2xl backdrop-blur-xl"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Audit title">
            <input
              name="title"
              required
              className={inputClassName}
            />
          </Field>

          <Field label="Reference number">
            <input
              name="reference"
              placeholder="AUD-2026-001"
              className={inputClassName}
            />
          </Field>
        </div>

        <Field label="Audit scope">
          <textarea
            name="scope"
            rows={6}
            className={inputClassName}
            placeholder="Define the processes, regulatory requirements, departments, standards, and operational areas included."
          />
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Audit type">
            <select
              name="type"
              defaultValue={
                AuditType.INTERNAL
              }
              className={inputClassName}
            >
              {Object.values(
                AuditType
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

              {sites.map((site) => (
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
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Lead auditor">
            <select
              name="leadAuditorId"
              defaultValue=""
              className={inputClassName}
            >
              <option value="">
                Not assigned
              </option>

              {users.map((user) => (
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
              ))}
            </select>
          </Field>

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
                      key={
                        template.id
                      }
                      value={
                        template.id
                      }
                    >
                      {template.name} v
                      {template.version} —{" "}
                      {questionCount}{" "}
                      questions
                    </option>
                  );
                }
              )}
            </select>
          </Field>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Scheduled date">
            <DateInput name="scheduledAt" />
          </Field>

          <Field label="Completion due date">
            <DateInput name="dueDate" />
          </Field>
        </div>

        {sites.length === 0 && (
          <div className="rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4 text-sm text-orange-200">
            Your organization does not
            have a site available.
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
          <Link
            href="/audits"
            className="rounded-2xl border border-white/10 px-5 py-3 text-sm text-slate-300"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={
              sites.length === 0
            }
            className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            Create Audit
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-cyan-400/50";

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