import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { requireAuditServicesEntitlement } from "@/modules/audit/audit-services-entitlement";
import {
  authorizeInternalAuditDeliverableDownload,
  recordAuditDeliverableDownload,
} from "@/modules/audit/audit-service-deliverable.service";
import {
  auditDeliverableFilename,
  createAuditDeliverablePdf,
} from "@/modules/audit/audit-service-deliverable-export";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requirePermission(PermissionKey.VIEW_AUDITS);
  const [{ organizationId, user }, { id }] = await Promise.all([
    getCurrentUserTenant(),
    params,
  ]);
  await requireAuditServicesEntitlement(organizationId);
  const deliverable = await authorizeInternalAuditDeliverableDownload(
    organizationId,
    id,
  );
  if (!deliverable)
    return new Response("Released deliverable not found.", { status: 404 });
  const output = await createAuditDeliverablePdf({
    deliverable,
    organizationName: deliverable.organization.name,
    clientName: deliverable.engagement.client?.name,
    engagementReference: deliverable.engagement.reference,
    engagementTitle: deliverable.engagement.title,
  });
  await recordAuditDeliverableDownload({
    organizationId,
    deliverableId: deliverable.id,
    actorId: user.id,
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
