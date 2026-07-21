import { EntityCustomFormSubmissions } from "@/features/forms/entity-custom-form-submissions";
import { triageSafetyObservation } from "@/features/observations/actions";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { hasSubscriptionFeature } from "@/lib/subscription";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  ConfigurableFormModule,
  DocumentEntityType,
  PermissionKey,
  SafetyObservationStatus,
} from "@prisma/client";
import { notFound } from "next/navigation";
import Link from "next/link";

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3";

export default async function ObservationPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  await requirePermission(
    PermissionKey.VIEW_OBSERVATIONS
  );

  const [{ id }, { organizationId, user }] =
    await Promise.all([
      params,
      getCurrentUserTenant(),
    ]);

  const [
    observation,
    users,
    documentUploadEnabled,
    permissions,
  ] = await Promise.all([
    prisma.safetyObservation.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        site: true,
        reportedBy: true,
        assignedTo: true,
        behaviorSession: { include: { program: true } },
      },
    }),
    prisma.user.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        name: "asc",
      },
    }),
    hasSubscriptionFeature(
      organizationId,
      "DOCUMENT_UPLOAD"
    ),
    getCurrentUserPermissions(),
  ]);

  if (!observation) {
    notFound();
  }

  const canUpload =
    documentUploadEnabled &&
    (permissions.includes(
      PermissionKey.CREATE_OBSERVATION
    ) ||
      permissions.includes(
        PermissionKey.MANAGE_OBSERVATIONS
      ));

  return (
    <div>
      <p className="text-sm text-cyan-300">
        {observation.reference}
      </p>

      <h1 className="mt-2 text-4xl font-bold">
        {observation.title}
      </h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="whitespace-pre-wrap text-slate-300">
              {observation.description}
            </p>

            <dl className="mt-6 space-y-3 text-sm">
              <div>
                Type: {" "}
                {observation.type.replaceAll(
                  "_",
                  " "
                )}
              </div>
              <div>
                Risk: {" "}
                {observation.riskLevel}
              </div>
              <div>
                Site: {" "}
                {observation.site.name}
              </div>
              <div>
                Reporter: {" "}
                {observation.isAnonymous
                  ? "Anonymous"
                  : observation
                      .reportedBy.name}
              </div>
              <div>
                Immediate action: {" "}
                {observation.immediateAction ||
                  "None recorded"}
              </div>
              <div>
                Follow-up due: {" "}
                {observation.followUpDueDate
                  ? observation.followUpDueDate.toLocaleDateString()
                  : "Not set"}
              </div>
            </dl>
            {observation.behaviorSession && (
              <Link href={`/behavior-safety/sessions/${observation.behaviorSession.id}`} className="mt-5 inline-block rounded-xl border border-white/10 px-4 py-2 text-sm text-cyan-300">
                Linked coaching: {observation.behaviorSession.reference} — {observation.behaviorSession.program.name}
              </Link>
            )}
          </section>

          <EntityCustomFormSubmissions
            organizationId={
              organizationId
            }
            userId={user.id}
            module={
              ConfigurableFormModule.OBSERVATION
            }
            entityType={
              DocumentEntityType.SAFETY_OBSERVATION
            }
            entityId={observation.id}
            canUpload={canUpload}
            className="space-y-6"
          />
        </div>

        <form
          action={triageSafetyObservation}
          className="h-fit rounded-3xl border border-white/10 bg-white/5 p-6"
        >
          <input
            type="hidden"
            name="id"
            value={observation.id}
          />

          <h2 className="text-xl font-semibold">
            Triage
          </h2>

          <label className="mt-5 block">
            Status
            <select
              name="status"
              defaultValue={
                observation.status
              }
              className={
                inputClassName
              }
            >
              {Object.values(
                SafetyObservationStatus
              ).map((status) => (
                <option key={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-5 block">
            Assignee
            <select
              name="assignedToId"
              defaultValue={
                observation.assignedToId ||
                ""
              }
              className={
                inputClassName
              }
            >
              <option value="">
                Unassigned
              </option>
              {users.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-5 block">
            Follow-up due date
            <input
              type="date"
              name="followUpDueDate"
              defaultValue={
                observation.followUpDueDate
                  ?.toISOString()
                  .slice(0, 10) || ""
              }
              className={
                inputClassName
              }
            />
          </label>

          <label className="mt-5 block">
            Review notes
            <textarea
              name="reviewNotes"
              defaultValue={
                observation.reviewNotes ||
                ""
              }
              rows={5}
              className={
                inputClassName
              }
            />
          </label>

          <button className="mt-5 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950">
            Save Triage
          </button>
        </form>
      </div>
    </div>
  );
}
