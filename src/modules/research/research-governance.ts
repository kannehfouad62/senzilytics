import { ResearchCollectionStatus, ResearchProjectStatus } from "@prisma/client";

const transitions: Record<ResearchProjectStatus, readonly ResearchProjectStatus[]> = {
  DRAFT: [ResearchProjectStatus.PLANNING, ResearchProjectStatus.CANCELLED],
  PLANNING: [ResearchProjectStatus.IN_REVIEW, ResearchProjectStatus.ON_HOLD, ResearchProjectStatus.CANCELLED],
  IN_REVIEW: [ResearchProjectStatus.PLANNING, ResearchProjectStatus.APPROVED, ResearchProjectStatus.CANCELLED],
  APPROVED: [ResearchProjectStatus.ACTIVE, ResearchProjectStatus.PLANNING, ResearchProjectStatus.CANCELLED],
  ACTIVE: [ResearchProjectStatus.DATA_COLLECTION, ResearchProjectStatus.ANALYSIS, ResearchProjectStatus.ON_HOLD, ResearchProjectStatus.CANCELLED],
  DATA_COLLECTION: [ResearchProjectStatus.ANALYSIS, ResearchProjectStatus.ON_HOLD, ResearchProjectStatus.CANCELLED],
  ANALYSIS: [ResearchProjectStatus.CLIENT_REVIEW, ResearchProjectStatus.DATA_COLLECTION, ResearchProjectStatus.ON_HOLD, ResearchProjectStatus.CANCELLED],
  CLIENT_REVIEW: [ResearchProjectStatus.ANALYSIS, ResearchProjectStatus.COMPLETED, ResearchProjectStatus.ON_HOLD, ResearchProjectStatus.CANCELLED],
  COMPLETED: [ResearchProjectStatus.ARCHIVED],
  ON_HOLD: [ResearchProjectStatus.PLANNING, ResearchProjectStatus.ACTIVE, ResearchProjectStatus.DATA_COLLECTION, ResearchProjectStatus.ANALYSIS, ResearchProjectStatus.CLIENT_REVIEW, ResearchProjectStatus.CANCELLED],
  CANCELLED: [ResearchProjectStatus.ARCHIVED],
  ARCHIVED: [],
};

export function availableResearchProjectStatuses(status: ResearchProjectStatus) {
  return [...transitions[status]];
}

export function assertResearchProjectTransition(from: ResearchProjectStatus, to: ResearchProjectStatus) {
  if (!transitions[from].includes(to)) {
    throw new Error(`Research project cannot move from ${pretty(from)} to ${pretty(to)}.`);
  }
}

const collectionTransitions:Record<ResearchCollectionStatus,readonly ResearchCollectionStatus[]>={DRAFT:[ResearchCollectionStatus.ACTIVE,ResearchCollectionStatus.CANCELLED],ACTIVE:[ResearchCollectionStatus.PAUSED,ResearchCollectionStatus.CLOSED],PAUSED:[ResearchCollectionStatus.ACTIVE,ResearchCollectionStatus.CLOSED,ResearchCollectionStatus.CANCELLED],CLOSED:[],CANCELLED:[]};
export function availableResearchCollectionStatuses(status:ResearchCollectionStatus){return [...collectionTransitions[status]]}
export function assertResearchCollectionTransition(from:ResearchCollectionStatus,to:ResearchCollectionStatus){if(!collectionTransitions[from].includes(to))throw new Error(`Research collection cannot move from ${pretty(from)} to ${pretty(to)}.`)}

export function normalizeResearchReference(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (normalized.length < 3 || normalized.length > 40) throw new Error("Project reference must contain 3 to 40 letters, numbers or hyphens.");
  return normalized;
}

export function researchProjectReadiness(input: {
  purpose: string;
  objectives: string;
  researchQuestions: string;
  methodology: string;
  projectManagerId: string;
  clientRequired: boolean;
  clientId?: string | null;
  dataOwnershipStatement?: string | null;
  ethicsApprovalRequired: boolean;
  ethicsApprovalReference?: string | null;
  consentRequired: boolean;
  teamCount: number;
  milestoneCount: number;
}) {
  const checks = [
    ["Research purpose", input.purpose.trim().length >= 20],
    ["Research objectives", input.objectives.trim().length >= 20],
    ["Research questions", input.researchQuestions.trim().length >= 10],
    ["Methodology", Boolean(input.methodology)],
    ["Project manager", Boolean(input.projectManagerId)],
    ["Commissioning client", !input.clientRequired || Boolean(input.clientId)],
    ["Data ownership statement", !input.clientRequired || Boolean(input.dataOwnershipStatement?.trim())],
    ["Ethics approval evidence", !input.ethicsApprovalRequired || Boolean(input.ethicsApprovalReference?.trim())],
    ["Research team", input.teamCount > 0],
    ["Governed milestone plan", input.milestoneCount > 0],
    ["Consent requirement assessed", typeof input.consentRequired === "boolean"],
  ] as const;
  const completed = checks.filter(([, ready]) => ready).length;
  return {
    score: Math.round((completed / checks.length) * 100),
    checks: checks.map(([label, ready]) => ({ label, ready })),
    blockers: checks.filter(([, ready]) => !ready).map(([label]) => label),
  };
}

function pretty(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
