import { ChemicalApprovalStatus } from "@prisma/client";

const transitions: Record<
  ChemicalApprovalStatus,
  readonly ChemicalApprovalStatus[]
> = {
  DRAFT: [
    ChemicalApprovalStatus.UNDER_REVIEW,
    ChemicalApprovalStatus.ARCHIVED,
  ],
  UNDER_REVIEW: [
    ChemicalApprovalStatus.DRAFT,
    ChemicalApprovalStatus.APPROVED,
    ChemicalApprovalStatus.RESTRICTED,
    ChemicalApprovalStatus.PROHIBITED,
    ChemicalApprovalStatus.ARCHIVED,
  ],
  APPROVED: [
    ChemicalApprovalStatus.UNDER_REVIEW,
    ChemicalApprovalStatus.RESTRICTED,
    ChemicalApprovalStatus.PROHIBITED,
    ChemicalApprovalStatus.ARCHIVED,
  ],
  RESTRICTED: [
    ChemicalApprovalStatus.UNDER_REVIEW,
    ChemicalApprovalStatus.APPROVED,
    ChemicalApprovalStatus.PROHIBITED,
    ChemicalApprovalStatus.ARCHIVED,
  ],
  PROHIBITED: [
    ChemicalApprovalStatus.UNDER_REVIEW,
    ChemicalApprovalStatus.ARCHIVED,
  ],
  ARCHIVED: [],
};

export function getChemicalNextStatuses(status: ChemicalApprovalStatus) {
  return [...transitions[status]];
}

export function isChemicalTransitionAllowed(
  current: ChemicalApprovalStatus,
  next: ChemicalApprovalStatus
) {
  return transitions[current].includes(next);
}
