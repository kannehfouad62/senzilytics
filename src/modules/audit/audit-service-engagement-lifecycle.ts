import { AuditServiceEngagementStatus } from "@prisma/client";

const transitions: Record<AuditServiceEngagementStatus, readonly AuditServiceEngagementStatus[]> = {
  DRAFT: [AuditServiceEngagementStatus.PLANNING, AuditServiceEngagementStatus.CANCELLED],
  PLANNING: [AuditServiceEngagementStatus.READY, AuditServiceEngagementStatus.CANCELLED],
  READY: [AuditServiceEngagementStatus.IN_PROGRESS, AuditServiceEngagementStatus.CANCELLED],
  IN_PROGRESS: [AuditServiceEngagementStatus.UNDER_REVIEW, AuditServiceEngagementStatus.CANCELLED],
  UNDER_REVIEW: [AuditServiceEngagementStatus.IN_PROGRESS, AuditServiceEngagementStatus.COMPLETED, AuditServiceEngagementStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

export function auditServiceEngagementTransitions(status: AuditServiceEngagementStatus) {
  return [...transitions[status]];
}

export function assertAuditServiceEngagementTransition(
  current: AuditServiceEngagementStatus,
  next: AuditServiceEngagementStatus,
) {
  if (!transitions[current].includes(next)) {
    throw new Error(`Engagement cannot move from ${current} to ${next}.`);
  }
}
