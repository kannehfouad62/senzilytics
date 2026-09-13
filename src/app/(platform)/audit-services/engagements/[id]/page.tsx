import {
  declareEngagementIndependence,
  linkAuditServiceEngagementAudit,
  reviewEngagementIndependence,
  reviewEngagementPlan,
  submitEngagementPlan,
} from "@/features/audits/audit-service.actions";
import { hasPermission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { findAuditServiceEngagement } from "@/modules/audit/audit-service.service";
import { requireAuditServicesEntitlement } from "@/modules/audit/audit-services-entitlement";
import {
  AuditIndependenceDecision,
  AuditServicePlanningStatus,
  AuditServiceRiskRating,
  PermissionKey,
} from "@prisma/client";
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
  const [{ organizationId, user }, { id }, canManage] = await Promise.all([
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
      <section className="mt-8 grid gap-5 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Independence and conflicts</h2>
          <p className="mt-2 text-sm text-slate-500">
            Each assigned auditor declares independently; another authorized
            user reviews the declaration.
          </p>
          {engagement.teamMembers.some(
            (member) => member.userId === user.id,
          ) && (
            <form
              action={declareEngagementIndependence}
              className="mt-4 space-y-3"
            >
              <input type="hidden" name="engagementId" value={engagement.id} />
              <textarea
                name="declaration"
                required
                rows={2}
                placeholder="State your independence and relevant relationships"
                className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
              />
              <label className="flex gap-2 text-sm">
                <input type="checkbox" name="conflictDeclared" /> I declare a
                potential conflict
              </label>
              <textarea
                name="safeguards"
                rows={2}
                placeholder="Required safeguards when a conflict is declared"
                className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
              />
              <button className="rounded-xl border border-cyan-400/20 px-4 py-2 text-sm text-cyan-200">
                Submit declaration
              </button>
            </form>
          )}
          <div className="mt-5 space-y-3">
            {engagement.independenceDeclarations.map((item) => (
              <div key={item.id} className="rounded-xl bg-slate-950/50 p-4">
                <p className="font-medium">
                  {item.user.name} · {pretty(item.decision)}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {item.declaration}
                </p>
                {canManage &&
                  item.userId !== user.id &&
                  item.decision === AuditIndependenceDecision.PENDING && (
                    <form
                      action={reviewEngagementIndependence}
                      className="mt-3 flex flex-wrap gap-2"
                    >
                      <input
                        type="hidden"
                        name="engagementId"
                        value={engagement.id}
                      />
                      <input
                        type="hidden"
                        name="declarationId"
                        value={item.id}
                      />
                      <select
                        name="decision"
                        className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                      >
                        {[
                          AuditIndependenceDecision.CLEARED,
                          AuditIndependenceDecision.MITIGATED,
                          AuditIndependenceDecision.REJECTED,
                        ].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                      <input
                        name="notes"
                        placeholder="Review notes"
                        className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                      />
                      <button className="rounded-xl border border-violet-400/20 px-4 py-2 text-sm text-violet-200">
                        Review
                      </button>
                    </form>
                  )}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Planning governance</h2>
          <p className="mt-2 text-sm text-slate-400">
            Status: {pretty(engagement.planningStatus)} · Risk:{" "}
            {pretty(engagement.riskRating)}
          </p>
          {canManage &&
            (engagement.planningStatus === AuditServicePlanningStatus.DRAFT ||
              engagement.planningStatus ===
                AuditServicePlanningStatus.CHANGES_REQUESTED) && (
              <form action={submitEngagementPlan} className="mt-4 space-y-3">
                <input
                  type="hidden"
                  name="engagementId"
                  value={engagement.id}
                />
                <select
                  name="riskRating"
                  defaultValue={engagement.riskRating}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                >
                  {Object.values(AuditServiceRiskRating).map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <textarea
                  name="riskRationale"
                  required
                  rows={3}
                  defaultValue={engagement.riskRationale ?? ""}
                  placeholder="Risk-based planning rationale"
                  className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                />
                <textarea
                  name="planningNotes"
                  rows={2}
                  defaultValue={engagement.planningNotes ?? ""}
                  placeholder="Planning notes"
                  className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                />
                <button className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">
                  Submit plan
                </button>
              </form>
            )}
          {canManage &&
            engagement.planningStatus ===
              AuditServicePlanningStatus.SUBMITTED &&
            engagement.planningSubmittedById !== user.id && (
              <form action={reviewEngagementPlan} className="mt-4 space-y-3">
                <input
                  type="hidden"
                  name="engagementId"
                  value={engagement.id}
                />
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Independent review notes"
                  className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    name="decision"
                    value="APPROVED"
                    className="rounded-xl bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950"
                  >
                    Approve plan
                  </button>
                  <button
                    name="decision"
                    value="CHANGES_REQUESTED"
                    className="rounded-xl border border-amber-400/20 px-4 py-2 text-sm text-amber-200"
                  >
                    Request changes
                  </button>
                </div>
              </form>
            )}
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
