import {
  ResearchDataLifecycleStatus,
  ResearchDatasetAccessStatus,
  ResearchPrivacyReviewStatus,
} from "@prisma/client";

export const dataLifecycleTransitions: Record<ResearchDataLifecycleStatus, ResearchDataLifecycleStatus[]> = {
  DRAFT: [ResearchDataLifecycleStatus.ACTIVE],
  ACTIVE: [ResearchDataLifecycleStatus.LEGAL_HOLD, ResearchDataLifecycleStatus.DISPOSAL_DUE],
  LEGAL_HOLD: [ResearchDataLifecycleStatus.ACTIVE],
  DISPOSAL_DUE: [ResearchDataLifecycleStatus.LEGAL_HOLD, ResearchDataLifecycleStatus.DISPOSED],
  DISPOSED: [],
};

export const privacyReviewTransitions: Record<ResearchPrivacyReviewStatus, ResearchPrivacyReviewStatus[]> = {
  DRAFT: [ResearchPrivacyReviewStatus.UNDER_REVIEW],
  UNDER_REVIEW: [ResearchPrivacyReviewStatus.DRAFT, ResearchPrivacyReviewStatus.APPROVED, ResearchPrivacyReviewStatus.REJECTED],
  APPROVED: [],
  REJECTED: [ResearchPrivacyReviewStatus.DRAFT],
};

export const datasetAccessTransitions: Record<ResearchDatasetAccessStatus, ResearchDatasetAccessStatus[]> = {
  PENDING: [ResearchDatasetAccessStatus.APPROVED, ResearchDatasetAccessStatus.REJECTED],
  APPROVED: [ResearchDatasetAccessStatus.REVOKED, ResearchDatasetAccessStatus.EXPIRED],
  REJECTED: [],
  REVOKED: [],
  EXPIRED: [],
};
