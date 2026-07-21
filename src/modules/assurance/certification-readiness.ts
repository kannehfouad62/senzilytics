export type CertificationReadinessBand = "READY_FOR_FORMAL_REVIEW" | "NEEDS_ATTENTION" | "NOT_READY";

export type CertificationReadinessScores = {
  protocolFoundation: number;
  auditCoverage: number;
  conformance: number;
  evidenceAndClosure: number;
  operationalControl: number;
  managementReview: number;
};

export const certificationReadinessWeights: Record<keyof CertificationReadinessScores, number> = {
  protocolFoundation: 15,
  auditCoverage: 25,
  conformance: 20,
  evidenceAndClosure: 20,
  operationalControl: 10,
  managementReview: 10,
};

const clamp = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

export function calculateCertificationReadiness(scores: CertificationReadinessScores) {
  const dimensions = (Object.keys(certificationReadinessWeights) as (keyof CertificationReadinessScores)[]).map((key) => {
    const score = Math.round(clamp(scores[key]));
    const weight = certificationReadinessWeights[key];
    return { key, score, weight, contribution: Math.round(score * weight) / 100 };
  });
  const total = Math.round(dimensions.reduce((sum, dimension) => sum + dimension.contribution, 0));
  const band: CertificationReadinessBand = total >= 85 ? "READY_FOR_FORMAL_REVIEW" : total >= 65 ? "NEEDS_ATTENTION" : "NOT_READY";
  return { total, band, dimensions };
}

export function protocolFoundationScore(input: { active: boolean; sections: number; questions: number; clauseMapped: number }) {
  if (!input.active || input.sections < 1 || input.questions < 1) return 0;
  const clauseCoverage = input.questions ? input.clauseMapped / input.questions : 0;
  return Math.round(50 + Math.min(50, clauseCoverage * 50));
}

export function operationalControlScore(input: { highRisks: number; overdueCompliance: number; overdueTraining: number; overdueCapas: number; failedCriticalControls: number }) {
  const deduction = Math.min(25, input.highRisks * 5) + Math.min(25, input.overdueCompliance * 5) + Math.min(20, input.overdueTraining * 2) + Math.min(20, input.overdueCapas * 5) + Math.min(30, input.failedCriticalControls * 10);
  return Math.max(0, 100 - deduction);
}
