import { ExposureAssessmentStatus } from "@prisma/client";

const transitions: Record<ExposureAssessmentStatus, ExposureAssessmentStatus[]> = {
  DRAFT: [ExposureAssessmentStatus.PLANNED, ExposureAssessmentStatus.CANCELLED],
  PLANNED: [ExposureAssessmentStatus.IN_PROGRESS, ExposureAssessmentStatus.CANCELLED],
  IN_PROGRESS: [ExposureAssessmentStatus.UNDER_REVIEW, ExposureAssessmentStatus.CANCELLED],
  UNDER_REVIEW: [ExposureAssessmentStatus.COMPLETED, ExposureAssessmentStatus.IN_PROGRESS],
  COMPLETED: [], CANCELLED: [],
};
export const getExposureAssessmentNextStatuses = (status: ExposureAssessmentStatus) => [...transitions[status]];
export const isExposureAssessmentTransitionAllowed = (from: ExposureAssessmentStatus, to: ExposureAssessmentStatus) => transitions[from].includes(to);
