import {
  EsgDisclosureStatus,
  EsgInitiativeStatus,
} from "@prisma/client";

const disclosureTransitions: Readonly<
  Record<EsgDisclosureStatus, readonly EsgDisclosureStatus[]>
> = {
  [EsgDisclosureStatus.DRAFT]: [
    EsgDisclosureStatus.DATA_COLLECTION,
    EsgDisclosureStatus.ARCHIVED,
  ],
  [EsgDisclosureStatus.DATA_COLLECTION]: [
    EsgDisclosureStatus.UNDER_REVIEW,
    EsgDisclosureStatus.ARCHIVED,
  ],
  [EsgDisclosureStatus.UNDER_REVIEW]: [
    EsgDisclosureStatus.DATA_COLLECTION,
    EsgDisclosureStatus.APPROVED,
    EsgDisclosureStatus.ARCHIVED,
  ],
  [EsgDisclosureStatus.APPROVED]: [
    EsgDisclosureStatus.PUBLISHED,
    EsgDisclosureStatus.ARCHIVED,
  ],
  [EsgDisclosureStatus.PUBLISHED]: [EsgDisclosureStatus.ARCHIVED],
  [EsgDisclosureStatus.ARCHIVED]: [],
};

const initiativeTransitions: Readonly<
  Record<EsgInitiativeStatus, readonly EsgInitiativeStatus[]>
> = {
  [EsgInitiativeStatus.PLANNED]: [
    EsgInitiativeStatus.IN_PROGRESS,
    EsgInitiativeStatus.CANCELLED,
  ],
  [EsgInitiativeStatus.IN_PROGRESS]: [
    EsgInitiativeStatus.ON_HOLD,
    EsgInitiativeStatus.COMPLETED,
    EsgInitiativeStatus.CANCELLED,
  ],
  [EsgInitiativeStatus.ON_HOLD]: [
    EsgInitiativeStatus.IN_PROGRESS,
    EsgInitiativeStatus.CANCELLED,
  ],
  [EsgInitiativeStatus.COMPLETED]: [],
  [EsgInitiativeStatus.CANCELLED]: [],
};

export function getEsgDisclosureNextStatuses(status: EsgDisclosureStatus) {
  return [...disclosureTransitions[status]];
}

export function isEsgDisclosureTransitionAllowed(
  from: EsgDisclosureStatus,
  to: EsgDisclosureStatus
) {
  return disclosureTransitions[from].includes(to);
}

export function getEsgInitiativeNextStatuses(status: EsgInitiativeStatus) {
  return [...initiativeTransitions[status]];
}

export function isEsgInitiativeTransitionAllowed(
  from: EsgInitiativeStatus,
  to: EsgInitiativeStatus
) {
  return initiativeTransitions[from].includes(to);
}
