import { PermitToWorkStatus } from "@prisma/client";

const transitions: Record<PermitToWorkStatus, PermitToWorkStatus[]> = {
  DRAFT: [PermitToWorkStatus.PENDING_APPROVAL, PermitToWorkStatus.CANCELLED],
  PENDING_APPROVAL: [PermitToWorkStatus.APPROVED, PermitToWorkStatus.DRAFT, PermitToWorkStatus.REJECTED, PermitToWorkStatus.CANCELLED],
  APPROVED: [PermitToWorkStatus.ACTIVE, PermitToWorkStatus.SUSPENDED, PermitToWorkStatus.CANCELLED],
  ACTIVE: [PermitToWorkStatus.SUSPENDED, PermitToWorkStatus.CLOSED],
  SUSPENDED: [PermitToWorkStatus.ACTIVE, PermitToWorkStatus.CLOSED, PermitToWorkStatus.CANCELLED],
  CLOSED: [],
  REJECTED: [PermitToWorkStatus.DRAFT],
  EXPIRED: [],
  CANCELLED: [],
};

export function getPermitToWorkNextStatuses(status: PermitToWorkStatus) {
  return [...transitions[status]];
}

export function isPermitToWorkTransitionAllowed(from: PermitToWorkStatus, to: PermitToWorkStatus) {
  return transitions[from].includes(to);
}
