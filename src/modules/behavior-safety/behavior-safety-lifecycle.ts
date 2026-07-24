import { BehaviorObservationOutcome, BehaviorProgramStatus } from "@prisma/client";

const programTransitions: Record<BehaviorProgramStatus, BehaviorProgramStatus[]> = {
  DRAFT: [BehaviorProgramStatus.ACTIVE, BehaviorProgramStatus.ARCHIVED],
  ACTIVE: [BehaviorProgramStatus.PAUSED, BehaviorProgramStatus.ARCHIVED],
  PAUSED: [BehaviorProgramStatus.ACTIVE, BehaviorProgramStatus.ARCHIVED],
  ARCHIVED: [],
};

export const canTransitionBehaviorProgram = (from: BehaviorProgramStatus, to: BehaviorProgramStatus) => programTransitions[from].includes(to);

export const getBehaviorProgramNextStatuses = (status: BehaviorProgramStatus) =>
  [...programTransitions[status]];

export type BehaviorResultInput = { outcome: BehaviorObservationOutcome; isCritical: boolean };

export function summarizeBehaviorResults(results: BehaviorResultInput[]) {
  const safeCount = results.filter(result => result.outcome === BehaviorObservationOutcome.SAFE).length;
  const atRiskCount = results.filter(result => result.outcome === BehaviorObservationOutcome.AT_RISK).length;
  const criticalAtRiskCount = results.filter(result => result.isCritical && result.outcome === BehaviorObservationOutcome.AT_RISK).length;
  const overallOutcome = atRiskCount > 0 ? BehaviorObservationOutcome.AT_RISK : safeCount > 0 ? BehaviorObservationOutcome.SAFE : BehaviorObservationOutcome.NOT_OBSERVED;
  return { safeCount, atRiskCount, criticalAtRiskCount, overallOutcome };
}
