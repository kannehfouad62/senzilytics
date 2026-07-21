import { SurveillanceProgramStatus } from "@prisma/client";

const transitions: Record<SurveillanceProgramStatus, SurveillanceProgramStatus[]> = {
  DRAFT: [SurveillanceProgramStatus.ACTIVE, SurveillanceProgramStatus.ARCHIVED],
  ACTIVE: [SurveillanceProgramStatus.PAUSED, SurveillanceProgramStatus.ARCHIVED],
  PAUSED: [SurveillanceProgramStatus.ACTIVE, SurveillanceProgramStatus.ARCHIVED],
  ARCHIVED: [],
};

export const getSurveillanceProgramNextStatuses = (status: SurveillanceProgramStatus) => [...transitions[status]];
export const isSurveillanceProgramTransitionAllowed = (from: SurveillanceProgramStatus, to: SurveillanceProgramStatus) => transitions[from].includes(to);
