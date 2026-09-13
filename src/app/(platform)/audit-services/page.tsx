import {
  assignAuditServiceEngagementMember,
  createAuditServiceClient,
  createAuditServiceContact,
  createAuditServiceEngagement,
  updateAuditServiceEngagementStatus,
} from "@/features/audits/audit-service.actions";
import { hasPermission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { auditServiceEngagementTransitions } from "@/modules/audit/audit-service-engagement-lifecycle";
import { findAuditServiceWorkspace } from "@/modules/audit/audit-service.service";
import { requireAuditServicesEntitlement } from "@/modules/audit/audit-services-entitlement";
import {
  AuditServiceEngagementKind,
  AuditServiceEngagementStatus,
  AuditServiceEngagementTeamRole,
  PermissionKey,
} from "@prisma/client";
import {
  BriefcaseBusiness,
  Building2,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";

const input =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm";
const pretty = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const terminalStatuses = new Set<AuditServiceEngagementStatus>([
  AuditServiceEngagementStatus.COMPLETED,
  AuditServiceEngagementStatus.CANCELLED,
]);

export default async function AuditServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_AUDITS);
  const [{ organizationId }, canManage, filters] = await Promise.all([
    getCurrentUserTenant(),
    hasPermission(PermissionKey.MANAGE_AUDITS),
    searchParams,
  ]);
  await requireAuditServicesEntitlement(organizationId);
  const [{ clients, engagements }, users] = await Promise.all([
    findAuditServiceWorkspace(organizationId, filters.q),
    prisma.user.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, jobTitle: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const openEngagements = engagements.filter(
    (item) => !terminalStatuses.has(item.status),
  ).length;
  const externalEngagements = engagements.filter(
    (item) => item.kind === AuditServiceEngagementKind.EXTERNAL,
  ).length;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-violet-300">
            <BriefcaseBusiness size={16} /> Audit &amp; Assurance Services
          </p>
          <h1 className="mt-2 text-4xl font-bold">
            Client and Engagement Portfolio
          </h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Deliver governed internal and external audit services. Client
            contacts are controlled records and never receive tenant accounts.
          </p>
        </div>
        <form className="flex min-w-72 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4">
          <Search size={17} className="text-slate-500" />
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search clients or engagements"
            className="w-full bg-transparent py-3 text-sm outline-none"
          />
        </form>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-3">
        <Metric
          label="Active clients"
          value={clients.filter((client) => client.status === "ACTIVE").length}
          icon={<Building2 size={19} />}
        />
        <Metric
          label="Open engagements"
          value={openEngagements}
          icon={<ShieldCheck size={19} />}
        />
        <Metric
          label="External engagements"
          value={externalEngagements}
          icon={<Users size={19} />}
        />
      </div>

      <div className="mt-7 rounded-2xl border border-amber-400/20 bg-amber-400/[.06] px-5 py-4 text-sm text-amber-100">
        <strong>Service-delivery boundary:</strong> Senzilytics stores
        engagement references and audit evidence only. Contracts, fees, invoices
        and payments remain outside the platform.
      </div>

      {canManage && (
        <div className="mt-7 grid gap-5 xl:grid-cols-2">
          <details className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <summary className="cursor-pointer font-semibold text-cyan-200">
              Create audit client
            </summary>
            <form
              action={createAuditServiceClient}
              className="mt-5 grid gap-4 md:grid-cols-2"
            >
              <Field label="Client name">
                <input name="name" required className={input} />
              </Field>
              <Field label="Reference">
                <input
                  name="reference"
                  placeholder="Automatically generated"
                  className={input}
                />
              </Field>
              <Field label="Legal name">
                <input name="legalName" className={input} />
              </Field>
              <Field label="Industry">
                <input name="industry" className={input} />
              </Field>
              <Field label="Country">
                <input name="country" className={input} />
              </Field>
              <Field label="HTTPS website">
                <input name="website" type="url" className={input} />
              </Field>
              <Field label="Address" wide>
                <textarea name="address" rows={2} className={input} />
              </Field>
              <Field label="Internal notes" wide>
                <textarea name="notes" rows={2} className={input} />
              </Field>
              <button className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 md:col-span-2">
                Create client record
              </button>
            </form>
          </details>
          <details className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <summary className="cursor-pointer font-semibold text-violet-200">
              Create service engagement
            </summary>
            <form
              action={createAuditServiceEngagement}
              className="mt-5 grid gap-4 md:grid-cols-2"
            >
              <Field label="Title">
                <input name="title" required className={input} />
              </Field>
              <Field label="Reference">
                <input
                  name="reference"
                  placeholder="Automatically generated"
                  className={input}
                />
              </Field>
              <Field label="Engagement kind">
                <select
                  name="kind"
                  defaultValue={AuditServiceEngagementKind.EXTERNAL}
                  className={input}
                >
                  {Object.values(AuditServiceEngagementKind).map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </Field>
              <Field label="External client">
                <select name="clientId" defaultValue="" className={input}>
                  <option value="">
                    None — required only for external work
                  </option>
                  {clients
                    .filter((client) => client.status === "ACTIVE")
                    .map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.reference} — {client.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Purpose" wide>
                <textarea name="purpose" required rows={2} className={input} />
              </Field>
              <Field label="Scope" wide>
                <textarea name="scope" required rows={3} className={input} />
              </Field>
              <Field label="Objectives">
                <textarea name="objectives" rows={2} className={input} />
              </Field>
              <Field label="Criteria / standards">
                <textarea name="criteria" rows={2} className={input} />
              </Field>
              <Field label="External contract reference">
                <input
                  name="externalContractReference"
                  placeholder="Reference only — no monetary data"
                  className={input}
                />
              </Field>
              <Field label="Engagement owner">
                <UserSelect name="ownerId" users={users} />
              </Field>
              <Field label="Engagement manager">
                <UserSelect name="managerId" users={users} required />
              </Field>
              <Field label="Lead auditor">
                <UserSelect name="leadAuditorId" users={users} required />
              </Field>
              <Field label="Planned start">
                <input
                  name="plannedStartDate"
                  required
                  type="date"
                  className={input}
                />
              </Field>
              <Field label="Planned end">
                <input name="plannedEndDate" type="date" className={input} />
              </Field>
              <Field label="Due date">
                <input name="dueDate" required type="date" className={input} />
              </Field>
              <button className="rounded-xl bg-violet-300 px-5 py-3 font-semibold text-slate-950 md:col-span-2">
                Create engagement
              </button>
            </form>
          </details>
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Engagements</h2>
        <div className="mt-4 grid gap-5">
          {engagements.length === 0 ? (
            <Empty text="No service engagements match this view." />
          ) : (
            engagements.map((engagement) => (
              <article
                key={engagement.id}
                className="rounded-3xl border border-white/10 bg-white/5 p-6"
              >
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-violet-300">
                      {engagement.reference} · {pretty(engagement.kind)}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold">
                      <Link
                        href={`/audit-services/engagements/${engagement.id}`}
                        className="hover:text-cyan-200"
                      >
                        {engagement.title}
                      </Link>
                    </h3>
                    <p className="mt-2 text-sm text-slate-400">
                      {engagement.client?.name ?? "Internal engagement"} ·{" "}
                      {engagement.purpose}
                    </p>
                  </div>
                  <span className="h-fit rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
                    {pretty(engagement.status)}
                  </span>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <Info
                    label="Manager"
                    value={engagement.manager?.name ?? "Not assigned"}
                  />
                  <Info
                    label="Lead auditor"
                    value={engagement.leadAuditor?.name ?? "Not assigned"}
                  />
                  <Info
                    label="Team"
                    value={`${engagement.teamMembers.length} member(s)`}
                  />
                  <Info
                    label="Linked audits"
                    value={String(engagement._count.audits)}
                  />
                </div>
                {canManage && !terminalStatuses.has(engagement.status) && (
                  <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 lg:grid-cols-2">
                    <form
                      action={assignAuditServiceEngagementMember}
                      className="flex flex-wrap gap-2"
                    >
                      <input
                        type="hidden"
                        name="engagementId"
                        value={engagement.id}
                      />
                      <select
                        name="memberUserId"
                        required
                        defaultValue=""
                        className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                      >
                        <option value="" disabled>
                          Team member
                        </option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                      <select
                        name="role"
                        defaultValue={AuditServiceEngagementTeamRole.AUDITOR}
                        className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                      >
                        {Object.values(AuditServiceEngagementTeamRole).map(
                          (role) => (
                            <option key={role} value={role}>
                              {pretty(role)}
                            </option>
                          ),
                        )}
                      </select>
                      <button className="rounded-xl border border-violet-400/20 px-4 py-2 text-sm text-violet-200">
                        Assign
                      </button>
                    </form>
                    <div className="flex flex-wrap gap-2">
                      {auditServiceEngagementTransitions(engagement.status)
                        .filter(
                          (status) =>
                            status !== AuditServiceEngagementStatus.CANCELLED,
                        )
                        .map((status) => (
                          <form
                            key={status}
                            action={updateAuditServiceEngagementStatus}
                          >
                            <input
                              type="hidden"
                              name="engagementId"
                              value={engagement.id}
                            />
                            <input type="hidden" name="status" value={status} />
                            <button className="rounded-xl border border-cyan-400/20 px-4 py-2 text-sm text-cyan-200">
                              Move to {pretty(status)}
                            </button>
                          </form>
                        ))}
                      <form
                        action={updateAuditServiceEngagementStatus}
                        className="flex gap-2"
                      >
                        <input
                          type="hidden"
                          name="engagementId"
                          value={engagement.id}
                        />
                        <input
                          type="hidden"
                          name="status"
                          value={AuditServiceEngagementStatus.CANCELLED}
                        />
                        <input
                          name="cancellationReason"
                          required
                          placeholder="Cancellation reason"
                          className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                        />
                        <button className="rounded-xl border border-red-400/20 px-4 py-2 text-sm text-red-200">
                          Cancel
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Audit clients</h2>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          {clients.length === 0 ? (
            <Empty text="No audit clients match this view." />
          ) : (
            clients.map((client) => (
              <article
                key={client.id}
                className="rounded-3xl border border-white/10 bg-white/5 p-6"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="text-xs text-cyan-300">{client.reference}</p>
                    <h3 className="mt-1 text-lg font-semibold">
                      <Link
                        href={`/audit-services/clients/${client.id}`}
                        className="hover:text-cyan-200"
                      >
                        {client.name}
                      </Link>
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {client.industry ?? "Industry not recorded"} ·{" "}
                      {client._count.engagements} engagement(s)
                    </p>
                  </div>
                  <span className="text-xs text-emerald-300">
                    {pretty(client.status)}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {client.contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="rounded-xl bg-slate-950/40 p-3 text-sm"
                    >
                      <p className="font-medium">
                        {contact.name}
                        {contact.isPrimary ? " · Primary" : ""}
                      </p>
                      <p className="text-slate-500">
                        {contact.email}
                        {contact.isAuthorizedRepresentative
                          ? " · Authorized representative"
                          : ""}
                      </p>
                    </div>
                  ))}
                </div>
                {canManage && (
                  <details className="mt-4 rounded-xl border border-white/10 p-3">
                    <summary className="cursor-pointer text-sm text-cyan-200">
                      Add client contact
                    </summary>
                    <form
                      action={createAuditServiceContact}
                      className="mt-3 grid gap-3 md:grid-cols-2"
                    >
                      <input type="hidden" name="clientId" value={client.id} />
                      <input
                        name="name"
                        required
                        placeholder="Contact name"
                        className={input}
                      />
                      <input
                        name="email"
                        required
                        type="email"
                        placeholder="Email"
                        className={input}
                      />
                      <input
                        name="jobTitle"
                        placeholder="Job title"
                        className={input}
                      />
                      <input
                        name="phone"
                        placeholder="Phone"
                        className={input}
                      />
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" name="isPrimary" /> Primary
                        contact
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          name="isAuthorizedRepresentative"
                        />{" "}
                        Authorized representative
                      </label>
                      <button className="rounded-xl border border-cyan-400/20 px-4 py-2 text-sm text-cyan-200 md:col-span-2">
                        Add contact
                      </button>
                    </form>
                  </details>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`text-sm ${wide ? "md:col-span-2" : ""}`}>
      {label}
      {children}
    </label>
  );
}
function UserSelect({
  name,
  users,
  required = false,
}: {
  name: string;
  users: { id: string; name: string; jobTitle: string | null }[];
  required?: boolean;
}) {
  return (
    <select name={name} required={required} defaultValue="" className={input}>
      <option value="">Not assigned</option>
      {users.map((user) => (
        <option key={user.id} value={user.id}>
          {user.name}
          {user.jobTitle ? ` — ${user.jobTitle}` : ""}
        </option>
      ))}
    </select>
  );
}
function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between text-slate-400">
        <p className="text-sm">{label}</p>
        <span className="text-cyan-300">{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-950/40 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}
