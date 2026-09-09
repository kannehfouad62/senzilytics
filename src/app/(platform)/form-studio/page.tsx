import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey, Prisma } from "@prisma/client";
import { ClipboardList, FileCog, Plus } from "lucide-react";
import Link from "next/link";

export default async function FormStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; search?: string; page?: string }>;
}) {
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const [{ organizationId }, params] = await Promise.all([
    getCurrentUserTenant(),
    searchParams,
  ]);
  const query = normalizeRegisterQuery(params);
  const { message } = params;
  const where: Prisma.ConfigurableFormDefinitionWhereInput = { organizationId, ...(query.search ? { OR: [
    { name: { contains: query.search, mode: "insensitive" } },
    { slug: { contains: query.search, mode: "insensitive" } },
    { description: { contains: query.search, mode: "insensitive" } },
  ] } : {}) };
  const [forms, total] = await Promise.all([prisma.configurableFormDefinition.findMany({
    where,
    include: {
      _count: { select: { submissions: true } },
      versions: {
        orderBy: { version: "desc" },
        select: {
          version: true,
          status: true,
          _count: { select: { fields: true } },
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { module: "asc" }, { name: "asc" }],
    skip: query.skip,
    take: query.take,
  }), prisma.configurableFormDefinition.count({ where })]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <FileCog size={17} />
            Tenant Configuration
          </p>
          <h1 className="mt-2 text-4xl font-bold">Form Studio</h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Design tenant-specific, version-controlled forms. Assignments can be
            moved or paused while published versions and historical submissions
            remain defensible.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/form-studio/submissions"
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 font-semibold text-cyan-200"
          >
            <ClipboardList size={16} />
            Submission Center
          </Link>
          <Link
            href="/form-studio/new"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 font-semibold text-slate-950"
          >
            <Plus size={16} />
            New Form
          </Link>
        </div>
      </div>

      {message && (
        <p
          role="status"
          className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200"
        >
          {message}
        </p>
      )}

      <div className="mt-8"><RegisterSearch action="/form-studio" value={query.search} placeholder="Search form name, slug, or description"/><p className="mt-3 text-sm text-slate-500">{total} matching form{total === 1 ? "" : "s"}</p></div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {forms.map((form) => {
          const latest = form.versions[0];
          const published = form.versions.find(
            (version) => version.status === "PUBLISHED",
          );
          return (
            <Link
              key={form.id}
              href={`/form-studio/${form.id}`}
              className={`rounded-3xl border p-6 transition ${
                form.isActive
                  ? "border-white/10 bg-white/5 hover:border-cyan-400/30"
                  : "border-white/5 bg-slate-950/40 opacity-75 hover:opacity-100"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                  {pretty(form.module)}
                </p>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
                    form.isActive
                      ? "bg-emerald-400/10 text-emerald-300"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {form.isActive ? "ASSIGNED" : "UNASSIGNED"}
                </span>
              </div>
              <h2 className="mt-2 text-xl font-semibold">{form.name}</h2>
              <p className="mt-2 line-clamp-2 text-sm text-slate-400">
                {form.description || "No description"}
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white/5 px-3 py-1">
                  Latest v{latest?.version ?? 1}
                </span>
                <span
                  className={`rounded-full px-3 py-1 ${
                    published
                      ? "bg-emerald-400/10 text-emerald-300"
                      : "bg-amber-400/10 text-amber-300"
                  }`}
                >
                  {published ? `Published v${published.version}` : "Draft only"}
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1">
                  {latest?._count.fields ?? 0} fields
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1">
                  {form._count.submissions} submissions
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {!forms.length && (
        <p className="mt-8 rounded-3xl border border-dashed border-white/10 p-10 text-center text-slate-500">
          No configurable forms yet. Create the first tenant form definition.
        </p>
      )}
      <RegisterPagination action="/form-studio" search={query.search} page={query.page} pages={registerPageCount(total)}/>
    </div>
  );
}

function pretty(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
import { RegisterPagination } from "@/components/register/register-pagination";
import { RegisterSearch } from "@/components/register/register-search";
import { normalizeRegisterQuery, registerPageCount } from "@/core/register/register-query";
