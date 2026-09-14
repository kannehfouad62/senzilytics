"use server";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { requireAuditServicesEntitlement } from "@/modules/audit/audit-services-entitlement";
import {
  addAuditMeetingAttendee,
  closeAuditServiceMeeting,
  createAuditInformationRequest,
  createAuditServiceMeeting,
  recordAuditMeetingAttendance,
  transitionAuditInformationRequest,
} from "@/modules/audit/audit-service-coordination.service";
import {
  AuditInformationRequestStatus,
  AuditServiceMeetingType,
  PermissionKey,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
const value = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const req = (d: FormData, k: string) => {
  const v = value(d, k);
  if (!v) throw new Error(`${k} is required.`);
  return v;
};
async function context() {
  await requirePermission(PermissionKey.MANAGE_AUDITS);
  const tenant = await getCurrentUserTenant();
  await requireAuditServicesEntitlement(tenant.organizationId);
  return tenant;
}
const refresh = (id: string) =>
  revalidatePath(`/audit-services/engagements/${id}`);
export async function createInformationRequest(d: FormData) {
  const { organizationId, user } = await context();
  const engagementId = req(d, "engagementId");
  await createAuditInformationRequest({
    organizationId,
    userId: user.id,
    engagementId,
    reference: value(d, "reference"),
    title: req(d, "title"),
    description: req(d, "description"),
    contactId: value(d, "contactId"),
    ownerId: value(d, "ownerId"),
    dueDate: value(d, "dueDate")
      ? new Date(`${value(d, "dueDate")}T00:00:00Z`)
      : null,
  });
  refresh(engagementId);
}
export async function transitionInformationRequest(d: FormData) {
  const { organizationId, user } = await context();
  const status = req(d, "status") as AuditInformationRequestStatus;
  if (!Object.values(AuditInformationRequestStatus).includes(status))
    throw new Error("Invalid request status.");
  await transitionAuditInformationRequest({
    organizationId,
    userId: user.id,
    requestId: req(d, "requestId"),
    status,
    responseNotes: value(d, "responseNotes"),
  });
  refresh(req(d, "engagementId"));
}
export async function scheduleAuditServiceMeeting(d: FormData) {
  const { organizationId, user } = await context();
  const type = req(d, "type") as AuditServiceMeetingType;
  if (!Object.values(AuditServiceMeetingType).includes(type))
    throw new Error("Invalid meeting type.");
  const scheduledAt = new Date(req(d, "scheduledAt"));
  if (Number.isNaN(scheduledAt.getTime()))
    throw new Error("Valid meeting date required.");
  const engagementId = req(d, "engagementId");
  await createAuditServiceMeeting({
    organizationId,
    userId: user.id,
    engagementId,
    type,
    title: req(d, "title"),
    agenda: req(d, "agenda"),
    scheduledAt,
    location: value(d, "location"),
    chairedById: value(d, "chairedById"),
  });
  refresh(engagementId);
}
export async function addMeetingAttendee(d: FormData) {
  const { organizationId, user } = await context();
  await addAuditMeetingAttendee({
    organizationId,
    userId: user.id,
    meetingId: req(d, "meetingId"),
    attendeeUserId: value(d, "attendeeUserId"),
    contactId: value(d, "contactId"),
  });
  refresh(req(d, "engagementId"));
}
export async function closeMeeting(d: FormData) {
  const { organizationId, user } = await context();
  const status = req(d, "status");
  if (status !== "COMPLETED" && status !== "CANCELLED")
    throw new Error("Invalid meeting decision.");
  await closeAuditServiceMeeting({
    organizationId,
    userId: user.id,
    meetingId: req(d, "meetingId"),
    status,
    minutes: value(d, "minutes"),
    outcomes: value(d, "outcomes"),
    cancellationReason: value(d, "cancellationReason"),
  });
  refresh(req(d, "engagementId"));
}
export async function recordMeetingAttendance(d: FormData) {
  const { organizationId, user } = await context();
  await recordAuditMeetingAttendance({
    organizationId,
    userId: user.id,
    attendeeId: req(d, "attendeeId"),
    attended: req(d, "attended") === "true",
    notes: value(d, "notes"),
  });
  refresh(req(d, "engagementId"));
}
