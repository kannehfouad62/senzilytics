import { updateAuditServiceClientStatus } from "@/features/audits/audit-service.actions";
import { hasPermission, requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { findAuditServiceClient } from "@/modules/audit/audit-service.service";
import { requireAuditServicesEntitlement } from "@/modules/audit/audit-services-entitlement";
import { AuditServiceClientStatus, PermissionKey } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

const pretty = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default async function AuditClientPage({
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
  const client = await findAuditServiceClient(organizationId, id);
  if (!client) notFound();
  return (
    <div>
      <Link href="/audit-services" className="text-sm text-slate-400">
        ← Audit Services
      </Link>
      <div className="mt-6 flex flex-wrap justify-between gap-4">
        <div>
          <p className="text-sm text-cyan-300">{client.reference}</p>
          <h1 className="mt-2 text-4xl font-bold">{client.name}</h1>
          <p className="mt-2 text-slate-400">
            {client.legalName ?? client.industry ?? "Audit service client"}
          </p>
        </div>
        <span className="h-fit rounded-full border border-white/10 px-4 py-2 text-sm">
          {pretty(client.status)}
        </span>
      </div>
      {canManage && client.status !== AuditServiceClientStatus.ARCHIVED && (
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            AuditServiceClientStatus.ACTIVE,
            AuditServiceClientStatus.ON_HOLD,
            AuditServiceClientStatus.ARCHIVED,
          ]
            .filter((status) => status !== client.status)
            .map((status) => (
              <form key={status} action={updateAuditServiceClientStatus}>
                <input type="hidden" name="clientId" value={client.id} />
                <input type="hidden" name="status" value={status} />
                <button className="rounded-xl border border-cyan-400/20 px-4 py-2 text-sm text-cyan-200">
                  {pretty(status)}
                </button>
              </form>
            ))}
        </div>
      )}
      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Authorized contacts</h2>
          <div className="mt-4 space-y-3">
            {client.contacts.map((contact) => (
              <div key={contact.id} className="rounded-xl bg-slate-950/50 p-4">
                <p className="font-medium">
                  {contact.name}
                  {contact.isPrimary ? " · Primary" : ""}
                </p>
                <p className="mt-1 text-sm text-slate-400">{contact.email}</p>
                <p className="mt-1 text-xs text-violet-300">
                  {contact.isAuthorizedRepresentative
                    ? "Authorized representative"
                    : "General contact"}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Engagement history</h2>
          <div className="mt-4 space-y-3">
            {client.engagements.map((engagement) => (
              <Link
                key={engagement.id}
                href={`/audit-services/engagements/${engagement.id}`}
                className="block rounded-xl bg-slate-950/50 p-4"
              >
                <p className="text-xs text-cyan-300">
                  {engagement.reference} · {pretty(engagement.status)}
                </p>
                <p className="mt-1 font-medium">{engagement.title}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {engagement._count.audits} linked audit(s)
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
