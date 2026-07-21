import { RegulatoryChangeStatus, RegulatorySourceStatus } from "@prisma/client";

const changeTransitions: Record<RegulatoryChangeStatus, RegulatoryChangeStatus[]> = {
  DETECTED: [RegulatoryChangeStatus.UNDER_REVIEW, RegulatoryChangeStatus.IMPACT_ASSESSMENT],
  UNDER_REVIEW: [RegulatoryChangeStatus.IMPACT_ASSESSMENT],
  IMPACT_ASSESSMENT: [RegulatoryChangeStatus.UNDER_REVIEW, RegulatoryChangeStatus.ACTION_REQUIRED, RegulatoryChangeStatus.NOT_APPLICABLE],
  ACTION_REQUIRED: [RegulatoryChangeStatus.IMPLEMENTED],
  IMPLEMENTED: [RegulatoryChangeStatus.CLOSED],
  NOT_APPLICABLE: [RegulatoryChangeStatus.CLOSED],
  CLOSED: [],
};

const sourceTransitions: Record<RegulatorySourceStatus, RegulatorySourceStatus[]> = {
  ACTIVE: [RegulatorySourceStatus.PAUSED, RegulatorySourceStatus.RETIRED],
  PAUSED: [RegulatorySourceStatus.ACTIVE, RegulatorySourceStatus.RETIRED],
  RETIRED: [],
};

export const canTransitionRegulatoryChange = (from: RegulatoryChangeStatus, to: RegulatoryChangeStatus) => changeTransitions[from].includes(to);
export const canTransitionRegulatorySource = (from: RegulatorySourceStatus, to: RegulatorySourceStatus) => sourceTransitions[from].includes(to);
export const isRegulatoryChangeTerminal = (status: RegulatoryChangeStatus) => status === RegulatoryChangeStatus.CLOSED;
