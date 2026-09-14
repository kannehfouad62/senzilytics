import { AuditServiceDeliverableStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  auditExternalSessionCookie,
  resolveAuditExternalAccess,
} from "@/modules/audit/audit-external-access.service";
import {
  auditDeliverableFilename,
  createAuditDeliverablePdf,
} from "@/modules/audit/audit-service-deliverable-export";
import { recordAuditDeliverableDownload } from "@/modules/audit/audit-service-deliverable.service";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    return new Response("Invalid access.", { status: 400 });
  const sessionToken = (await cookies()).get(auditExternalSessionCookie)?.value;
  const access = await resolveAuditExternalAccess(token, sessionToken);
  if (
    !access?.deliverable ||
    access.deliverable.status !== AuditServiceDeliverableStatus.RELEASED
  )
    return new Response("Deliverable access is invalid or expired.", {
      status: 403,
    });
  const deliverable = await prisma.auditServiceDeliverable.findFirst({
    where: {
      id: access.deliverable.id,
      organizationId: access.organizationId,
      engagementId: access.engagementId,
      status: AuditServiceDeliverableStatus.RELEASED,
    },
    include: {
      organization: { select: { name: true } },
      engagement: { include: { client: { select: { name: true } } } },
    },
  });
  if (!deliverable)
    return new Response("Released deliverable is no longer available.", {
      status: 410,
    });
  const output = await createAuditDeliverablePdf({
    deliverable,
    organizationName: deliverable.organization.name,
    clientName: deliverable.engagement.client?.name,
    engagementReference: deliverable.engagement.reference,
    engagementTitle: deliverable.engagement.title,
  });
  await recordAuditDeliverableDownload({
    organizationId: access.organizationId,
    deliverableId: deliverable.id,
    accessId: access.id,
    representativeName: access.contact.name,
    representativeEmail: access.contact.email,
  });
  return new Response(new Uint8Array(output), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${auditDeliverableFilename(deliverable)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
