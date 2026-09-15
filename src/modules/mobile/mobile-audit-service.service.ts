import { PermissionKey, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { organizationHasAuditServices } from "@/modules/audit/audit-services-entitlement";

const managementRoles = new Set<UserRole>([
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.EHS_MANAGER,
]);

export async function getMobileAuditServiceWorkspace(input: {
  organizationId: string;
  userId: string;
  userRole: UserRole;
  permissions: readonly PermissionKey[];
}) {
  const canView = input.permissions.includes(PermissionKey.VIEW_AUDITS);
  const canManage = input.permissions.includes(PermissionKey.MANAGE_AUDITS);
  const enabled = canView && await organizationHasAuditServices(input.organizationId);
  if (!enabled) return emptyWorkspace(canView, canManage);

  const assignedOnly = !managementRoles.has(input.userRole);
  const engagements = await prisma.auditServiceEngagement.findMany({
    where: {
      organizationId: input.organizationId,
      ...(assignedOnly ? {
        OR: [
          { ownerId: input.userId },
          { managerId: input.userId },
          { leadAuditorId: input.userId },
          { teamMembers: { some: { userId: input.userId } } },
        ],
      } : {}),
    },
    select: {
      id: true,
      reference: true,
      title: true,
      kind: true,
      status: true,
      purpose: true,
      scope: true,
      planningStatus: true,
      riskRating: true,
      plannedStartDate: true,
      plannedEndDate: true,
      dueDate: true,
      client: { select: { id: true, reference: true, name: true } },
      manager: { select: { id: true, name: true } },
      leadAuditor: { select: { id: true, name: true } },
      teamMembers: {
        select: { id: true, role: true, acceptedAt: true, declinedAt: true, user: { select: { id: true, name: true } } },
        orderBy: { assignedAt: "asc" },
        take: 30,
      },
      informationRequests: {
        select: { id: true, reference: true, title: true, status: true, dueDate: true, owner: { select: { id: true, name: true } } },
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        take: 50,
      },
      meetings: {
        select: { id: true, type: true, status: true, title: true, scheduledAt: true, location: true, chairedBy: { select: { id: true, name: true } }, _count: { select: { attendees: true } } },
        orderBy: { scheduledAt: "desc" },
        take: 25,
      },
      externalAccesses: {
        select: { id: true, scope: true, status: true, title: true, expiresAt: true, verifiedAt: true, contact: { select: { id: true, name: true, email: true } }, decision: { select: { decision: true, decidedAt: true } }, findingResponse: { select: { position: true, reviewStatus: true, submittedAt: true } }, _count: { select: { comments: true, deliverableDownloads: true } } },
        orderBy: { createdAt: "desc" },
        take: 25,
      },
      deliverables: {
        select: { id: true, reference: true, type: true, title: true, version: true, status: true, updatedAt: true, releasedAt: true },
        orderBy: [{ updatedAt: "desc" }],
        take: 25,
      },
      audits: { select: { id: true, reference: true, title: true, status: true, scorePercentage: true }, take: 15 },
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
    take: 50,
  });

  const now = new Date();
  const records = engagements.map((engagement) => ({
    ...engagement,
    audits: engagement.audits.map((audit) => ({
      ...audit,
      scorePercentage: audit.scorePercentage === null ? null : Number(audit.scorePercentage),
    })),
  }));
  const requests = records.flatMap((record) => record.informationRequests);
  const accesses = records.flatMap((record) => record.externalAccesses);
  const deliverables = records.flatMap((record) => record.deliverables);
  return {
    auditServiceGeneratedAt: now.toISOString(),
    auditServiceCapabilities: { enabled: true, canView, canManage, onlineOnlyWrites: true },
    auditServiceMetrics: {
      engagements: records.length,
      activeEngagements: records.filter((record) => !["COMPLETED", "CANCELLED"].includes(record.status)).length,
      overdueEngagements: records.filter((record) => record.dueDate && record.dueDate < now && !["COMPLETED", "CANCELLED"].includes(record.status)).length,
      openRequests: requests.filter((record) => !["ACCEPTED", "CLOSED", "CANCELLED"].includes(record.status)).length,
      externalReviewsPending: accesses.filter((record) => record.status === "ACTIVE" && !record.decision && !record.findingResponse).length,
      deliverablesInReview: deliverables.filter((record) => ["UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED"].includes(record.status)).length,
      releasedDeliverables: deliverables.filter((record) => record.status === "RELEASED").length,
    },
    auditServiceEngagements: records,
  };
}

function emptyWorkspace(canView: boolean, canManage: boolean) {
  return {
    auditServiceGeneratedAt: new Date().toISOString(),
    auditServiceCapabilities: { enabled: false, canView, canManage, onlineOnlyWrites: true },
    auditServiceMetrics: { engagements: 0, activeEngagements: 0, overdueEngagements: 0, openRequests: 0, externalReviewsPending: 0, deliverablesInReview: 0, releasedDeliverables: 0 },
    auditServiceEngagements: [],
  };
}
