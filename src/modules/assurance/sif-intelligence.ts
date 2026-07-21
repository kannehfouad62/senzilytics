import {
  CriticalControlVerificationResult,
  RiskLevel,
  SifExposureCategory,
} from "@prisma/client";

const categoryRules: Array<[SifExposureCategory, string[]]> = [
  [SifExposureCategory.CONFINED_SPACE, ["confined space", "tank entry", "vessel entry"]],
  [SifExposureCategory.ENERGY_ISOLATION, ["lockout", "tagout", "loto", "energy isolation", "stored energy"]],
  [SifExposureCategory.WORK_AT_HEIGHT, ["work at height", "working at height", "fall from", "scaffold", "ladder", "roof work"]],
  [SifExposureCategory.LIFTING_OPERATIONS, ["crane", "hoist", "rigging", "suspended load", "lifting operation"]],
  [SifExposureCategory.FIRE_EXPLOSION, ["fire", "explosion", "ignition", "hot work", "flammable"]],
  [SifExposureCategory.ELECTRICAL, ["electrical", "arc flash", "energized", "electrocution"]],
  [SifExposureCategory.EXCAVATION, ["excavation", "trench", "ground disturbance"]],
  [SifExposureCategory.MOBILE_EQUIPMENT, ["forklift", "vehicle", "mobile equipment", "pedestrian", "reversing", "truck"]],
  [SifExposureCategory.LINE_OF_FIRE, ["line of fire", "struck by", "struck-by", "caught between", "pinch point"]],
  [SifExposureCategory.PROCESS_SAFETY, ["process safety", "loss of containment", "pressure vessel", "relief valve", "runaway reaction"]],
  [SifExposureCategory.HAZARDOUS_MATERIALS, ["chemical", "toxic", "hazardous material", "spill", "release", "exposure"]],
];

export function inferSifExposureCategory(text: string) {
  const normalized = text.toLowerCase();
  return categoryRules.find(([, keywords]) => keywords.some((keyword) => normalized.includes(keyword)))?.[0] ?? SifExposureCategory.OTHER;
}

export type WeakSignalScoringInput = {
  riskLevel: RiskLevel;
  nearMiss?: boolean;
  overdue?: boolean;
  repeat?: boolean;
  missingAction?: boolean;
  controlResult?: CriticalControlVerificationResult | null;
};

export function scoreWeakSignal(input: WeakSignalScoringInput) {
  const riskWeight: Record<RiskLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 4, CRITICAL: 6 };
  let score = riskWeight[input.riskLevel];
  const reasons = [`${input.riskLevel.toLowerCase()} potential severity`];
  if (input.nearMiss) { score += 2; reasons.push("near-miss precursor"); }
  if (input.overdue) { score += 2; reasons.push("overdue response or review"); }
  if (input.repeat) { score += 2; reasons.push("repeat condition"); }
  if (input.missingAction) { score += 1; reasons.push("no linked action or escalation"); }
  if (input.controlResult === CriticalControlVerificationResult.FAILED) { score += 5; reasons.push("critical control failed verification"); }
  if (input.controlResult === CriticalControlVerificationResult.DEGRADED) { score += 3; reasons.push("critical control is degraded"); }
  if (input.controlResult === CriticalControlVerificationResult.NOT_VERIFIED) { score += 2; reasons.push("critical control was not verified"); }
  return { score, confidence: score >= 9 ? "HIGH" as const : score >= 5 ? "MEDIUM" as const : "LOW" as const, reasons };
}

export function weakSignalTrend(current: number, previous: number) {
  if (current >= previous + 2 && current >= previous * 1.25) return "RISING" as const;
  if (previous >= current + 2 && previous >= current * 1.25) return "FALLING" as const;
  return "STABLE" as const;
}

export function preventionPressureBand(input: { score: number; count: number; failedControls: number }) {
  if (input.failedControls > 0 || input.score >= 20 || input.count >= 6) return "CRITICAL" as const;
  if (input.score >= 10 || input.count >= 3) return "ELEVATED" as const;
  return "WATCH" as const;
}
