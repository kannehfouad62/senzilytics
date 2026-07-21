import { CompetencyProficiency } from "@prisma/client";

const ranks: Record<CompetencyProficiency, number> = {
  AWARENESS: 1,
  WORKING: 2,
  PRACTITIONER: 3,
  ADVANCED: 4,
  EXPERT: 5,
};

export const competencyLevelRank = (level: CompetencyProficiency) => ranks[level];
export const meetsCompetencyLevel = (actual: CompetencyProficiency | null, required: CompetencyProficiency) => actual !== null && ranks[actual] >= ranks[required];

export function addCompetencyMonths(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const finalDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, finalDay));
  return result;
}

export type CompetencyGapStatus = "SATISFIED" | "EXPIRING" | "GAP" | "EXPIRED";

export function classifyCompetencyGap(input: {
  actualLevel: CompetencyProficiency | null;
  requiredLevel: CompetencyProficiency;
  expiresAt: Date | null;
  hadExpiredEvidence: boolean;
  now: Date;
  expiryHorizon: Date;
}): CompetencyGapStatus {
  if (!meetsCompetencyLevel(input.actualLevel, input.requiredLevel)) return input.hadExpiredEvidence ? "EXPIRED" : "GAP";
  if (input.expiresAt && input.expiresAt <= input.expiryHorizon) return input.expiresAt < input.now ? "EXPIRED" : "EXPIRING";
  return "SATISFIED";
}
