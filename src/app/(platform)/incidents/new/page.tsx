import { prisma } from "@/lib/prisma";
import { createIncident } from "@/features/incidents/actions";
import { IncidentType, RiskLevel } from "@prisma/client";
import { getCurrentUserTenant } from "@/lib/tenant";

export default async function NewIncidentPage() {
  const { organizationId, user } = await getCurrentUserTenant();

  const sites = await prisma.site.findMany({
    where: {
      organizationId,
    },
    orderBy: { name: "asc" },
  });

  const users = await prisma.user.findMany({
    where: {
      organizationId,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <p className="text-sm text-cyan-300">Incident Reporting</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          New Incident
        </h1>
        <p className="mt-2 text-slate-400">
          Report injuries, near misses, environmental events, vehicle incidents,
          property damage, and other safety events.
        </p>
      </div>

      <form
        action={createIncident}
        className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl"
      >
        <input type="hidden" name="reportedById" value={user.id} />

        <div>
          <label className="mb-2 block text-sm text-slate-300">Title</label>
          <input
            name="title"
            required
            placeholder="Example: Slip hazard near loading dock"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-300">
            Description
          </label>
          <textarea
            name="description"
            required
            rows={5}
            placeholder="Describe what happened..."
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Incident Type
            </label>
            <select
              name="type"
              required
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
            >
              {Object.values(IncidentType).map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Risk Level
            </label>
            <select
              name="riskLevel"
              required
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
            >
              {Object.values(RiskLevel).map((risk) => (
                <option key={risk} value={risk}>
                  {risk}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Site</label>
            <select
              name="siteId"
              required
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
            >
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Reported By
            </label>
            <input
              disabled
              value={`${user.name} — ${user.role.replaceAll("_", " ")}`}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-400 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-300">Location</label>
          <input
            name="location"
            placeholder="Example: Warehouse A, Loading Dock 2"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            className="rounded-2xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Submit Incident
          </button>

          <a
            href="/incidents"
            className="rounded-2xl border border-white/10 px-6 py-3 text-slate-300 transition hover:bg-white/5"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}