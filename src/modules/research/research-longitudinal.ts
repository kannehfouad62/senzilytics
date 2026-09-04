import {
  ResearchLongitudinalParticipantStatus,
  ResearchLongitudinalStudyStatus,
} from "@prisma/client";

export const longitudinalTransitions: Record<
  ResearchLongitudinalStudyStatus,
  ResearchLongitudinalStudyStatus[]
> = {
  DRAFT: [
    ResearchLongitudinalStudyStatus.ACTIVE,
    ResearchLongitudinalStudyStatus.CANCELLED,
  ],
  ACTIVE: [
    ResearchLongitudinalStudyStatus.PAUSED,
    ResearchLongitudinalStudyStatus.COMPLETED,
    ResearchLongitudinalStudyStatus.CANCELLED,
  ],
  PAUSED: [
    ResearchLongitudinalStudyStatus.ACTIVE,
    ResearchLongitudinalStudyStatus.COMPLETED,
    ResearchLongitudinalStudyStatus.CANCELLED,
  ],
  COMPLETED: [],
  CANCELLED: [],
};

export function summarizeLongitudinalRetention(input: {
  enrolled: number;
  completedBaseline: number;
  completedCurrent: number;
  withdrawn: number;
  lost: number;
  targetPercent: number;
}) {
  const denominator = Math.max(0, input.completedBaseline || input.enrolled);
  const retained = Math.max(0, Math.min(denominator, input.completedCurrent));
  const retentionPercent = denominator
    ? Math.round((retained / denominator) * 100)
    : 0;
  return {
    denominator,
    retained,
    attrition: Math.max(0, denominator - retained),
    retentionPercent,
    meetsTarget: denominator > 0 && retentionPercent >= input.targetPercent,
    withdrawn: Math.max(0, input.withdrawn),
    lost: Math.max(0, input.lost),
  };
}

export function participantLongitudinalStatus(
  current: ResearchLongitudinalParticipantStatus,
  completedWaves: number,
  totalWaves: number,
) {
  if (
    current === ResearchLongitudinalParticipantStatus.WITHDRAWN ||
    current === ResearchLongitudinalParticipantStatus.LOST_TO_FOLLOW_UP
  )
    return current;
  return totalWaves > 0 && completedWaves >= totalWaves
    ? ResearchLongitudinalParticipantStatus.COMPLETED
    : ResearchLongitudinalParticipantStatus.ENROLLED;
}
