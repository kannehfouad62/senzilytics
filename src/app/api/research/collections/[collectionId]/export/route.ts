import { PermissionKey } from "@prisma/client";

import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cell = (value: unknown) => {
  let text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  await requirePermission(PermissionKey.EXPORT_RESEARCH_OUTPUTS);
  const [{ collectionId }, { organizationId }] = await Promise.all([
    params,
    getCurrentUserTenant(),
  ]);
  const collection = await prisma.researchCollectionWave.findFirst({
    where: { id: collectionId, organizationId },
    include: {
      project: { include: { client: true } },
      questionnaire: true,
      formVersion: { include: { fields: { orderBy: { sequence: "asc" } } } },
      assignments: {
        where: { status: "COMPLETED", submissionId: { not: null } },
        include: {
          respondent: { select: { name: true, email: true } },
          submission: { include: { answers: true } },
        },
        orderBy: { completedAt: "asc" },
      },
      publicResponses: {
        where: { submissionId: { not: null } },
        include: { submission: { include: { answers: true } } },
        orderBy: { submittedAt: "asc" },
      },
    },
  });
  if (!collection)
    return new Response("Collection not found.", { status: 404 });
  const headers = [
    "response_id",
    "response_source",
    "project_reference",
    "project_title",
    "client",
    "collection",
    "questionnaire_version",
    "respondent",
    "respondent_email",
    "submitted_at",
    ...collection.formVersion.fields.map((field) => field.key),
  ];
  const prefix = [
    collection.project.reference,
    collection.project.title,
    collection.project.client?.name ?? "Internal",
    collection.name,
    collection.formVersion.version,
  ];
  const assigned = collection.assignments.map((response) => {
    const answers = new Map(
      response.submission?.answers.map((answer) => [
        answer.fieldId,
        answer.value,
      ]) ?? [],
    );
    const identified = collection.questionnaire.identityMode === "IDENTIFIED";
    const respondent = identified
      ? response.respondent.name
      : collection.questionnaire.identityMode === "PSEUDONYMIZED"
        ? `RESP-${response.id.slice(-8).toUpperCase()}`
        : "";
    return [
      response.submissionId,
      "ASSIGNED",
      ...prefix,
      respondent,
      identified ? response.respondent.email : "",
      response.completedAt?.toISOString() ?? "",
      ...collection.formVersion.fields.map(
        (field) => answers.get(field.id) ?? "",
      ),
    ];
  });
  const external = collection.publicResponses.map((response) => {
    const answers = new Map(
      response.submission?.answers.map((answer) => [
        answer.fieldId,
        answer.value,
      ]) ?? [],
    );
    return [
      response.submissionId,
      "PUBLIC",
      ...prefix,
      response.participantName ?? response.pseudonymousReference ?? "",
      response.participantEmail ?? "",
      response.submittedAt.toISOString(),
      ...collection.formVersion.fields.map(
        (field) => answers.get(field.id) ?? "",
      ),
    ];
  });
  const csv = [headers, ...assigned, ...external]
    .map((row) => row.map(cell).join(","))
    .join("\n");
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${collection.project.reference}-${collection.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-dataset.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
