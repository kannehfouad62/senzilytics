import {
  ResearchGovernanceRecordStatus,
  ResearchGovernanceRecordType,
} from "@prisma/client";

export const governanceTransitions: Record<
  ResearchGovernanceRecordStatus,
  ResearchGovernanceRecordStatus[]
> = {
  DRAFT: [ResearchGovernanceRecordStatus.UNDER_REVIEW],
  UNDER_REVIEW: [
    ResearchGovernanceRecordStatus.DRAFT,
    ResearchGovernanceRecordStatus.APPROVED,
    ResearchGovernanceRecordStatus.REJECTED,
  ],
  APPROVED: [
    ResearchGovernanceRecordStatus.SUPERSEDED,
    ResearchGovernanceRecordStatus.EXPIRED,
  ],
  REJECTED: [ResearchGovernanceRecordStatus.DRAFT],
  EXPIRED: [ResearchGovernanceRecordStatus.SUPERSEDED],
  SUPERSEDED: [],
};

export const researchGovernanceRecordTypes = Object.values(
  ResearchGovernanceRecordType,
);
