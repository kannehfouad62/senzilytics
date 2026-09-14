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
import {
  addMeetingAttendee,
  closeMeeting,
  createInformationRequest,
  recordMeetingAttendance,
  scheduleAuditServiceMeeting,
  transitionInformationRequest,
} from "@/features/audits/audit-service-coordination.actions";
import { informationRequestTransitions } from "@/modules/audit/audit-service-coordination.service";
import {
  AuditInformationRequestStatus,
  AuditExternalAccessScope,
  AuditExternalAccessStatus,
  AuditServiceMeetingStatus,
  AuditServiceMeetingType,
} from "@prisma/client";
import {
  createAuditExternalAccess,
  revokeAuditExternalAccessLink,
} from "@/features/audits/audit-external-access.actions";

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
  const [engagement, availableAudits, users] = await Promise.all([
    findAuditServiceEngagement(organizationId, id),
    prisma.enterpriseAudit.findMany({
      where: { organizationId, engagementId: null },
      select: { id: true, reference: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.user.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
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
      <section className="mt-8 grid gap-5 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Information requests</h2>
          {canManage && (
            <details className="mt-4 rounded-xl border border-white/10 p-4">
              <summary className="cursor-pointer text-sm text-cyan-200">
                Create request
              </summary>
              <form
                action={createInformationRequest}
                className="mt-3 grid gap-3"
              >
                <input
                  type="hidden"
                  name="engagementId"
                  value={engagement.id}
                />
                <input
                  name="title"
                  required
                  placeholder="Requested information"
                  className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                />
                <textarea
                  name="description"
                  required
                  rows={2}
                  placeholder="Describe the evidence or information required"
                  className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    name="contactId"
                    defaultValue=""
                    className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                  >
                    <option value="">No client contact</option>
                    {engagement.client?.contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="ownerId"
                    defaultValue=""
                    className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                  >
                    <option value="">No internal owner</option>
                    {users.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                  <input
                    name="dueDate"
                    type="date"
                    className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                  />
                  <input
                    name="reference"
                    placeholder="Auto reference"
                    className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                  />
                </div>
                <button className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">
                  Create request
                </button>
              </form>
            </details>
          )}
          <div className="mt-4 space-y-3">
            {engagement.informationRequests.map((request) => (
              <div key={request.id} className="rounded-xl bg-slate-950/50 p-4">
                <p className="text-xs text-cyan-300">
                  {request.reference} · {pretty(request.status)}
                </p>
                <p className="mt-1 font-medium">{request.title}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {request.contact?.name ?? "Internal request"}
                  {request.dueDate
                    ? ` · Due ${request.dueDate.toLocaleDateString()}`
                    : ""}
                </p>
                {canManage &&
                  informationRequestTransitions(request.status).map(
                    (status) => (
                      <form
                        key={status}
                        action={transitionInformationRequest}
                        className="mt-2 flex gap-2"
                      >
                        <input
                          type="hidden"
                          name="engagementId"
                          value={engagement.id}
                        />
                        <input
                          type="hidden"
                          name="requestId"
                          value={request.id}
                        />
                        <input type="hidden" name="status" value={status} />
                        {(status ===
                          AuditInformationRequestStatus.PARTIALLY_RECEIVED ||
                          status ===
                            AuditInformationRequestStatus.RECEIVED) && (
                          <input
                            name="responseNotes"
                            required
                            placeholder="Receipt notes"
                            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-xs"
                          />
                        )}
                        <button className="rounded-lg border border-cyan-400/20 px-3 py-1 text-xs text-cyan-200">
                          {pretty(status)}
                        </button>
                      </form>
                    ),
                  )}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">
            Entrance, status and exit meetings
          </h2>
          {canManage && (
            <details className="mt-4 rounded-xl border border-white/10 p-4">
              <summary className="cursor-pointer text-sm text-violet-200">
                Schedule meeting
              </summary>
              <form
                action={scheduleAuditServiceMeeting}
                className="mt-3 grid gap-3"
              >
                <input
                  type="hidden"
                  name="engagementId"
                  value={engagement.id}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    name="type"
                    className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                  >
                    {Object.values(AuditServiceMeetingType).map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                  <input
                    name="scheduledAt"
                    required
                    type="datetime-local"
                    className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                  />
                  <input
                    name="title"
                    required
                    placeholder="Meeting title"
                    className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                  />
                  <select
                    name="chairedById"
                    defaultValue=""
                    className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                  >
                    <option value="">No chairperson</option>
                    {users.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  name="agenda"
                  required
                  rows={2}
                  placeholder="Controlled agenda"
                  className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                />
                <input
                  name="location"
                  placeholder="Location or meeting channel"
                  className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                />
                <button className="rounded-xl bg-violet-300 px-4 py-2 text-sm font-semibold text-slate-950">
                  Schedule meeting
                </button>
              </form>
            </details>
          )}
          <div className="mt-4 space-y-3">
            {engagement.meetings.map((meeting) => (
              <div key={meeting.id} className="rounded-xl bg-slate-950/50 p-4">
                <p className="text-xs text-violet-300">
                  {pretty(meeting.type)} · {pretty(meeting.status)}
                </p>
                <p className="mt-1 font-medium">{meeting.title}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {meeting.scheduledAt.toLocaleString()} ·{" "}
                  {meeting.attendees.length} attendee(s)
                </p>
                <div className="mt-2 space-y-1">
                  {meeting.attendees.map((attendee) => (
                    <form
                      key={attendee.id}
                      action={recordMeetingAttendance}
                      className="flex flex-wrap items-center gap-2 text-xs"
                    >
                      <input
                        type="hidden"
                        name="engagementId"
                        value={engagement.id}
                      />
                      <input
                        type="hidden"
                        name="attendeeId"
                        value={attendee.id}
                      />
                      <span className="min-w-32">
                        {attendee.user?.name ?? attendee.contact?.name} ·{" "}
                        {attendee.attendanceRecordedAt
                          ? attendee.attended
                            ? "Present"
                            : "Absent"
                          : "Not marked"}
                      </span>
                      {canManage &&
                        meeting.status ===
                          AuditServiceMeetingStatus.SCHEDULED && (
                          <>
                            <button
                              name="attended"
                              value="true"
                              className="rounded border border-emerald-400/20 px-2 py-1 text-emerald-200"
                            >
                              Present
                            </button>
                            <button
                              name="attended"
                              value="false"
                              className="rounded border border-slate-400/20 px-2 py-1 text-slate-300"
                            >
                              Absent
                            </button>
                          </>
                        )}
                    </form>
                  ))}
                </div>
                {canManage &&
                  meeting.status === AuditServiceMeetingStatus.SCHEDULED && (
                    <>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <form
                          action={addMeetingAttendee}
                          className="flex gap-2"
                        >
                          <input
                            type="hidden"
                            name="engagementId"
                            value={engagement.id}
                          />
                          <input
                            type="hidden"
                            name="meetingId"
                            value={meeting.id}
                          />
                          <select
                            name="attendeeUserId"
                            required
                            defaultValue=""
                            className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-xs"
                          >
                            <option value="" disabled>
                              Internal attendee
                            </option>
                            {users.map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.name}
                              </option>
                            ))}
                          </select>
                          <button className="rounded-lg border border-white/10 px-2 py-1 text-xs">
                            Add
                          </button>
                        </form>
                        {engagement.client && (
                          <form
                            action={addMeetingAttendee}
                            className="flex gap-2"
                          >
                            <input
                              type="hidden"
                              name="engagementId"
                              value={engagement.id}
                            />
                            <input
                              type="hidden"
                              name="meetingId"
                              value={meeting.id}
                            />
                            <select
                              name="contactId"
                              required
                              defaultValue=""
                              className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-xs"
                            >
                              <option value="" disabled>
                                Client attendee
                              </option>
                              {engagement.client.contacts.map((contact) => (
                                <option key={contact.id} value={contact.id}>
                                  {contact.name}
                                </option>
                              ))}
                            </select>
                            <button className="rounded-lg border border-white/10 px-2 py-1 text-xs">
                              Add
                            </button>
                          </form>
                        )}
                      </div>
                      <form action={closeMeeting} className="mt-3 grid gap-2">
                        <input
                          type="hidden"
                          name="engagementId"
                          value={engagement.id}
                        />
                        <input
                          type="hidden"
                          name="meetingId"
                          value={meeting.id}
                        />
                        <textarea
                          name="minutes"
                          rows={2}
                          placeholder="Meeting minutes"
                          className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs"
                        />
                        <textarea
                          name="outcomes"
                          rows={2}
                          placeholder="Decisions and outcomes"
                          className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs"
                        />
                        <input
                          name="cancellationReason"
                          placeholder="Cancellation reason, when applicable"
                          className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs"
                        />
                        <div className="flex gap-2">
                          <button
                            name="status"
                            value="COMPLETED"
                            className="rounded-lg border border-emerald-400/20 px-3 py-1 text-xs text-emerald-200"
                          >
                            Complete
                          </button>
                          <button
                            name="status"
                            value="CANCELLED"
                            className="rounded-lg border border-red-400/20 px-3 py-1 text-xs text-red-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </>
                  )}
              </div>
            ))}
          </div>
        </div>
      </section>
      {engagement.kind === "EXTERNAL" && engagement.client && (
        <section className="mt-8 rounded-3xl border border-cyan-300/15 bg-cyan-300/[.025] p-6">
          <h2 className="text-xl font-semibold">Secure external access</h2>
          <p className="mt-2 text-sm text-slate-400">
            Send an expiring link and six-digit passcode to an authorized client
            representative. Client accounts are never created.
          </p>
          {canManage && (
            <details className="mt-5 rounded-2xl border border-white/10 p-4">
              <summary className="cursor-pointer text-sm font-medium text-cyan-200">
                Issue controlled access
              </summary>
              <form
                action={createAuditExternalAccess}
                className="mt-4 grid gap-3 md:grid-cols-2"
              >
                <input
                  type="hidden"
                  name="engagementId"
                  value={engagement.id}
                />
                <select
                  name="contactId"
                  required
                  defaultValue=""
                  className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                >
                  <option value="" disabled>
                    Authorized representative
                  </option>
                  {engagement.client.contacts
                    .filter((contact) => contact.isAuthorizedRepresentative)
                    .map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name} · {contact.email}
                      </option>
                    ))}
                </select>
                <select
                  name="scope"
                  defaultValue={AuditExternalAccessScope.ENGAGEMENT}
                  className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                >
                  {Object.values(AuditExternalAccessScope).map((scope) => (
                    <option key={scope} value={scope}>
                      {pretty(scope)}
                    </option>
                  ))}
                </select>
                <select
                  name="auditId"
                  defaultValue=""
                  className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                >
                  <option value="">Linked audit — for report/question</option>
                  {engagement.audits.map((audit) => (
                    <option key={audit.id} value={audit.id}>
                      {audit.reference} · {audit.title}
                    </option>
                  ))}
                </select>
                <select
                  name="questionId"
                  defaultValue=""
                  className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                >
                  <option value="">Audit question — for question scope</option>
                  {engagement.audits.flatMap((audit) =>
                    audit.sections.flatMap((section) =>
                      section.questions.map((question) => (
                        <option key={question.id} value={question.id}>
                          {audit.reference} · {section.sequence}.{question.sequence}{" "}
                          {question.questionText}
                        </option>
                      )),
                    ),
                  )}
                </select>
                <select
                  name="findingId"
                  defaultValue=""
                  className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm md:col-span-2"
                >
                  <option value="">Audit finding — for finding scope</option>
                  {engagement.audits.flatMap((audit) =>
                    audit.findings.map((finding) => (
                      <option key={finding.id} value={finding.id}>
                        {audit.reference} · {finding.reference} · {finding.title}
                      </option>
                    )),
                  )}
                </select>
                <input
                  name="title"
                  required
                  placeholder="Review title"
                  className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                />
                <input
                  name="expiresAt"
                  required
                  type="datetime-local"
                  className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                />
                <select
                  name="informationRequestId"
                  defaultValue=""
                  className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm md:col-span-2"
                >
                  <option value="">
                    No information request — required only for that scope
                  </option>
                  {engagement.informationRequests.map((request) => (
                    <option key={request.id} value={request.id}>
                      {request.reference} · {request.title}
                    </option>
                  ))}
                </select>
                <textarea
                  name="instructions"
                  rows={2}
                  placeholder="Instructions for the authorized representative"
                  className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm md:col-span-2"
                />
                <button className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 md:col-span-2">
                  Generate and email secure access
                </button>
              </form>
            </details>
          )}
          <div className="mt-5 space-y-3">
            {engagement.externalAccesses.map((access) => {
              const expired = access.expiresAt <= new Date();
              return (
                <article
                  key={access.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-cyan-300">
                        {pretty(access.scope)} · {access.contact.name}
                      </p>
                      <h3 className="mt-1 font-semibold">{access.title}</h3>
                      <p className="mt-2 text-xs text-slate-500">
                        {access.contact.email} · expires{" "}
                        {access.expiresAt.toLocaleString()} ·{" "}
                        {access.status === AuditExternalAccessStatus.REVOKED
                          ? "Revoked"
                          : expired
                            ? "Expired"
                            : access.verifiedAt
                              ? "Verified"
                              : "Awaiting verification"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {access._count.comments} comment(s) · decision: {" "}
                        {access.decision
                          ? pretty(access.decision.decision)
                          : "Pending"}
                      </p>
                      {access.findingResponse && (
                        <p className="mt-1 text-xs text-amber-200">
                          Finding response: {pretty(access.findingResponse.position)}
                        </p>
                      )}
                    </div>
                    {canManage &&
                      access.status === AuditExternalAccessStatus.ACTIVE &&
                      !expired && (
                        <form action={revokeAuditExternalAccessLink}>
                          <input
                            type="hidden"
                            name="engagementId"
                            value={engagement.id}
                          />
                          <input
                            type="hidden"
                            name="accessId"
                            value={access.id}
                          />
                          <button className="rounded-lg border border-red-400/20 px-3 py-1 text-xs text-red-200">
                            Revoke
                          </button>
                        </form>
                      )}
                  </div>
                </article>
              );
            })}
            {!engagement.externalAccesses.length && (
              <p className="text-sm text-slate-500">
                No external access has been issued for this engagement.
              </p>
            )}
          </div>
        </section>
      )}
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
