import { logActivity } from "@/core/activity-log/activity-log.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  AuditInformationRequestStatus,
  AuditServiceMeetingStatus,
  AuditServiceMeetingType,
} from "@prisma/client";

const requestTransitions: Record<
  AuditInformationRequestStatus,
  readonly AuditInformationRequestStatus[]
> = {
  DRAFT: [
    AuditInformationRequestStatus.SENT,
    AuditInformationRequestStatus.CANCELLED,
  ],
  SENT: [
    AuditInformationRequestStatus.PARTIALLY_RECEIVED,
    AuditInformationRequestStatus.RECEIVED,
    AuditInformationRequestStatus.CANCELLED,
  ],
  PARTIALLY_RECEIVED: [
    AuditInformationRequestStatus.RECEIVED,
    AuditInformationRequestStatus.CANCELLED,
  ],
  RECEIVED: [
    AuditInformationRequestStatus.ACCEPTED,
    AuditInformationRequestStatus.SENT,
  ],
  ACCEPTED: [AuditInformationRequestStatus.CLOSED],
  CLOSED: [],
  CANCELLED: [],
};
export const informationRequestTransitions = (
  status: AuditInformationRequestStatus,
) => [...requestTransitions[status]];

async function engagement(organizationId: string, engagementId: string) {
  const record = await prisma.auditServiceEngagement.findFirst({
    where: { id: engagementId, organizationId },
    select: { id: true, clientId: true },
  });
  if (!record) throw new Error("Audit engagement not found.");
  return record;
}

export async function createAuditInformationRequest(input: {
  organizationId: string;
  userId: string;
  engagementId: string;
  reference?: string | null;
  title: string;
  description: string;
  contactId?: string | null;
  ownerId?: string | null;
  dueDate?: Date | null;
}) {
  const parent = await engagement(input.organizationId, input.engagementId);
  if (!input.title.trim() || !input.description.trim())
    throw new Error("Request title and description are required.");
  if (
    input.contactId &&
    !(await prisma.auditServiceClientContact.findFirst({
      where: {
        id: input.contactId,
        clientId: parent.clientId ?? "",
        isActive: true,
      },
    }))
  )
    throw new Error("Select an active contact for this engagement client.");
  if (
    input.ownerId &&
    !(await prisma.user.findFirst({
      where: {
        id: input.ownerId,
        organizationId: input.organizationId,
        isActive: true,
      },
    }))
  )
    throw new Error("Select an active tenant owner.");
  const record = await prisma.auditServiceInformationRequest.create({
    data: {
      organizationId: input.organizationId,
      engagementId: parent.id,
      reference:
        input.reference?.trim().toUpperCase() ||
        `IR-${Date.now().toString(36).toUpperCase()}`,
      title: input.title.trim(),
      description: input.description.trim(),
      contactId: input.contactId || null,
      ownerId: input.ownerId || null,
      requestedById: input.userId,
      dueDate: input.dueDate,
    },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType: "AuditServiceInformationRequest",
    entityId: record.id,
    title: "Audit information request created",
    description: record.reference,
  });
}

export async function transitionAuditInformationRequest(input: {
  organizationId: string;
  userId: string;
  requestId: string;
  status: AuditInformationRequestStatus;
  responseNotes?: string | null;
}) {
  const record = await prisma.auditServiceInformationRequest.findFirst({
    where: { id: input.requestId, organizationId: input.organizationId },
  });
  if (!record) throw new Error("Information request not found.");
  if (!requestTransitions[record.status].includes(input.status))
    throw new Error(
      `Information request cannot move from ${record.status} to ${input.status}.`,
    );
  if (
    [
      AuditInformationRequestStatus.PARTIALLY_RECEIVED,
      AuditInformationRequestStatus.RECEIVED,
    ].some((status) => status === input.status) &&
    !input.responseNotes?.trim()
  )
    throw new Error("Receipt notes are required.");
  const now = new Date();
  await prisma.auditServiceInformationRequest.update({
    where: { id: record.id },
    data: {
      status: input.status,
      responseNotes: input.responseNotes?.trim() || record.responseNotes,
      sentAt:
        input.status === AuditInformationRequestStatus.SENT ? now : undefined,
      receivedAt:
        input.status === AuditInformationRequestStatus.RECEIVED
          ? now
          : undefined,
      acceptedAt:
        input.status === AuditInformationRequestStatus.ACCEPTED
          ? now
          : undefined,
      closedAt:
        input.status === AuditInformationRequestStatus.CLOSED ? now : undefined,
    },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.STATUS_CHANGE,
    entityType: "AuditServiceInformationRequest",
    entityId: record.id,
    title: "Information request status changed",
    description: `${record.status} → ${input.status}`,
  });
}

export async function createAuditServiceMeeting(input: {
  organizationId: string;
  userId: string;
  engagementId: string;
  type: AuditServiceMeetingType;
  title: string;
  agenda: string;
  scheduledAt: Date;
  location?: string | null;
  chairedById?: string | null;
}) {
  await engagement(input.organizationId, input.engagementId);
  if (!input.title.trim() || !input.agenda.trim())
    throw new Error("Meeting title and agenda are required.");
  if (
    input.chairedById &&
    !(await prisma.user.findFirst({
      where: {
        id: input.chairedById,
        organizationId: input.organizationId,
        isActive: true,
      },
    }))
  )
    throw new Error("Select an active tenant chairperson.");
  const record = await prisma.auditServiceMeeting.create({
    data: {
      organizationId: input.organizationId,
      engagementId: input.engagementId,
      type: input.type,
      title: input.title.trim(),
      agenda: input.agenda.trim(),
      scheduledAt: input.scheduledAt,
      location: input.location?.trim() || null,
      chairedById: input.chairedById || null,
      createdById: input.userId,
    },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType: "AuditServiceMeeting",
    entityId: record.id,
    title: "Audit service meeting scheduled",
    description: `${record.type} · ${record.title}`,
  });
}

export async function addAuditMeetingAttendee(input: {
  organizationId: string;
  userId: string;
  meetingId: string;
  attendeeUserId?: string | null;
  contactId?: string | null;
}) {
  const meeting = await prisma.auditServiceMeeting.findFirst({
    where: { id: input.meetingId, organizationId: input.organizationId },
    include: { engagement: { select: { clientId: true } } },
  });
  if (!meeting || meeting.status !== AuditServiceMeetingStatus.SCHEDULED)
    throw new Error("A scheduled audit meeting is required.");
  if (Boolean(input.attendeeUserId) === Boolean(input.contactId))
    throw new Error("Select exactly one internal user or client contact.");
  if (
    input.attendeeUserId &&
    !(await prisma.user.findFirst({
      where: {
        id: input.attendeeUserId,
        organizationId: input.organizationId,
        isActive: true,
      },
    }))
  )
    throw new Error("Select an active tenant user.");
  if (
    input.contactId &&
    !(await prisma.auditServiceClientContact.findFirst({
      where: {
        id: input.contactId,
        clientId: meeting.engagement.clientId ?? "",
        isActive: true,
      },
    }))
  )
    throw new Error("Select an active engagement client contact.");
  await prisma.auditServiceMeetingAttendee.create({
    data: {
      meetingId: meeting.id,
      userId: input.attendeeUserId || null,
      contactId: input.contactId || null,
    },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.ASSIGN,
    entityType: "AuditServiceMeeting",
    entityId: meeting.id,
    title: "Audit meeting attendee added",
  });
}

export async function closeAuditServiceMeeting(input: {
  organizationId: string;
  userId: string;
  meetingId: string;
  status: "COMPLETED" | "CANCELLED";
  minutes?: string | null;
  outcomes?: string | null;
  cancellationReason?: string | null;
}) {
  const meeting = await prisma.auditServiceMeeting.findFirst({
    where: { id: input.meetingId, organizationId: input.organizationId },
  });
  if (!meeting || meeting.status !== AuditServiceMeetingStatus.SCHEDULED)
    throw new Error("Only a scheduled meeting may be closed.");
  if (
    input.status === "COMPLETED" &&
    (!input.minutes?.trim() || !input.outcomes?.trim())
  )
    throw new Error("Completed meetings require minutes and outcomes.");
  if (input.status === "CANCELLED" && !input.cancellationReason?.trim())
    throw new Error("A cancellation reason is required.");
  const now = new Date();
  await prisma.auditServiceMeeting.update({
    where: { id: meeting.id },
    data: {
      status: input.status,
      minutes: input.minutes?.trim() || null,
      outcomes: input.outcomes?.trim() || null,
      cancellationReason: input.cancellationReason?.trim() || null,
      completedAt: input.status === "COMPLETED" ? now : undefined,
      cancelledAt: input.status === "CANCELLED" ? now : undefined,
    },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.STATUS_CHANGE,
    entityType: "AuditServiceMeeting",
    entityId: meeting.id,
    title: `Audit meeting ${input.status.toLowerCase()}`,
  });
}

export async function recordAuditMeetingAttendance(input: {
  organizationId: string;
  userId: string;
  attendeeId: string;
  attended: boolean;
  notes?: string | null;
}) {
  const attendee = await prisma.auditServiceMeetingAttendee.findFirst({
    where: {
      id: input.attendeeId,
      meeting: {
        organizationId: input.organizationId,
        status: AuditServiceMeetingStatus.SCHEDULED,
      },
    },
    select: { id: true, meetingId: true },
  });
  if (!attendee) throw new Error("Scheduled meeting attendee not found.");
  await prisma.auditServiceMeetingAttendee.update({
    where: { id: attendee.id },
    data: {
      attended: input.attended,
      attendanceRecordedAt: new Date(),
      notes: input.notes?.trim() || null,
    },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.UPDATE,
    entityType: "AuditServiceMeetingAttendee",
    entityId: attendee.id,
    title: "Audit meeting attendance recorded",
    metadata: { meetingId: attendee.meetingId, attended: input.attended },
  });
}
