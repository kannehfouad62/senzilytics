import { linkAuditServiceEngagementAudit } from "@/features/audits/audit-service.actions";
import { hasPermission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { findAuditServiceEngagement } from "@/modules/audit/audit-service.service";
import { requireAuditServicesEntitlement } from "@/modules/audit/audit-services-entitlement";
import { PermissionKey } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

const pretty = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default async function AuditEngagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_AUDITS);
  const [{ organizationId }, { id }, canManage] = await Promise.all([
    getCurrentUserTenant(),
    params,
    hasPermission(PermissionKey.MANAGE_AUDITS),
  ]);
  await requireAuditServicesEntitlement(organizationId);
  const [engagement, availableAudits] = await Promise.all([
    findAuditServiceEngagement(organizationId, id),
    prisma.enterpriseAudit.findMany({
      where: { organizationId, engagementId: null },
      select: { id: true, reference: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  if (!engagement) notFound();
  return (
    <div>
      <Link href="/audit-services" className="text-sm text-slate-400">
        ← Audit Services
      </Link>
      <div className="mt-6">
        <p className="text-sm text-violet-300">
          {engagement.reference} · {pretty(engagement.kind)} ·{" "}
          {pretty(engagement.status)}
        </p>
        <h1 className="mt-2 text-4xl font-bold">{engagement.title}</h1>
        <p className="mt-3 max-w-4xl text-slate-400">{engagement.purpose}</p>
      </div>
      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <Info
          label="Client"
          value={engagement.client?.name ?? "Internal engagement"}
        />
        <Info
          label="Manager"
          value={engagement.manager?.name ?? "Not assigned"}
        />
        <Info
          label="Lead auditor"
          value={engagement.leadAuditor?.name ?? "Not assigned"}
        />
      </div>
      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Scope and criteria</h2>
          <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">
            {engagement.scope}
          </p>
          <p className="mt-4 whitespace-pre-wrap text-sm text-slate-500">
            {engagement.criteria ?? "No criteria recorded."}
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Engagement team</h2>
          <div className="mt-4 space-y-3">
            {engagement.teamMembers.map((member) => (
              <div key={member.id} className="rounded-xl bg-slate-950/50 p-4">
                <p className="font-medium">{member.user.name}</p>
                <p className="text-sm text-slate-500">
                  {pretty(member.role)} · {member.user.email}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Linked enterprise audits</h2>
          {canManage && availableAudits.length > 0 && (
            <form
              action={linkAuditServiceEngagementAudit}
              className="flex gap-2"
            >
              <input type="hidden" name="engagementId" value={engagement.id} />
              <select
                name="auditId"
                required
                defaultValue=""
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Select existing audit
                </option>
                {availableAudits.map((audit) => (
                  <option key={audit.id} value={audit.id}>
                    {audit.reference} — {audit.title}
                  </option>
                ))}
              </select>
              <button className="rounded-xl border border-cyan-400/20 px-4 py-2 text-sm text-cyan-200">
                Link audit
              </button>
            </form>
          )}
        </div>
        <div className="mt-4 space-y-3">
          {engagement.audits.map((audit) => (
            <Link
              key={audit.id}
              href={`/audits/${audit.id}`}
              className="block rounded-xl bg-slate-950/50 p-4"
            >
              <p className="text-xs text-cyan-300">
                {audit.reference} · {pretty(audit.status)}
              </p>
              <p className="mt-1 font-medium">{audit.title}</p>
              <p className="mt-1 text-sm text-slate-500">{audit.site.name}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 font-medium">{value}</p>
    </div>
  );
}
