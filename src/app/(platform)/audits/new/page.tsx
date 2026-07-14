import { createAudit } from "@/features/audits/actions";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";
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

  const sites =
    await prisma.site.findMany({
      where: {
        organizationId,
      },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        country: true,
      },
      orderBy: {
        name: "asc",
      },
    });

  return (
    <div className="mx-auto max-w-4xl">
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

        <p className="mt-2 max-w-2xl text-slate-400">
          Define the audit scope, select
          the site, and establish the
          planned audit date.
        </p>
      </div>

      <form
        action={createAudit}
        className="mt-8 space-y-6 rounded-3xl border border-white/10 bg-white/5 p-7 shadow-2xl backdrop-blur-xl"
      >
        <div>
          <label
            htmlFor="title"
            className="text-sm font-medium text-slate-200"
          >
            Audit title
          </label>

          <input
            id="title"
            name="title"
            type="text"
            required
            placeholder="Example: Annual Environmental Compliance Audit"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
          />
        </div>

        <div>
          <label
            htmlFor="scope"
            className="text-sm font-medium text-slate-200"
          >
            Audit scope
          </label>

          <textarea
            id="scope"
            name="scope"
            rows={6}
            placeholder="Describe the processes, departments, standards, regulations, and operating areas included in this audit."
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="siteId"
              className="text-sm font-medium text-slate-200"
            >
              Site
            </label>

            <select
              id="siteId"
              name="siteId"
              required
              defaultValue=""
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-cyan-400/50"
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
          </div>

          <div>
            <label
              htmlFor="scheduledAt"
              className="text-sm font-medium text-slate-200"
            >
              Scheduled date
            </label>

            <div className="relative mt-2">
              <CalendarDays
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <input
                id="scheduledAt"
                name="scheduledAt"
                type="datetime-local"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 py-3 pl-11 pr-4 text-white outline-none transition focus:border-cyan-400/50"
              />
            </div>
          </div>
        </div>

        {sites.length === 0 && (
          <div className="rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4 text-sm text-orange-200">
            Your organization does not
            have a site available. Create
            a site before creating an
            audit.
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 pt-6">
          <Link
            href="/audits"
            className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={
              sites.length === 0
            }
            className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create Audit
          </button>
        </div>
      </form>
    </div>
  );
}