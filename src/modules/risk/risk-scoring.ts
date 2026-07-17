import {
    RiskImpact,
    RiskLevel,
    RiskLikelihood,
  } from "@prisma/client";
  
  const likelihoodScores: Record<
    RiskLikelihood,
    number
  > = {
    [RiskLikelihood.RARE]: 1,
    [RiskLikelihood.UNLIKELY]: 2,
    [RiskLikelihood.POSSIBLE]: 3,
    [RiskLikelihood.LIKELY]: 4,
    [RiskLikelihood.ALMOST_CERTAIN]: 5,
  };
  
  const impactScores: Record<
    RiskImpact,
    number
  > = {
    [RiskImpact.INSIGNIFICANT]: 1,
    [RiskImpact.MINOR]: 2,
    [RiskImpact.MODERATE]: 3,
    [RiskImpact.MAJOR]: 4,
    [RiskImpact.CATASTROPHIC]: 5,
  };
  
  export function calculateRiskScore(input: {
    likelihood: RiskLikelihood;
    impact: RiskImpact;
  }) {
    return (
      likelihoodScores[input.likelihood] *
      impactScores[input.impact]
    );
  }
  
  export function calculateRiskLevel(
    score: number
  ): RiskLevel {
    if (score >= 20) {
      return RiskLevel.CRITICAL;
    }
  
    if (score >= 12) {
      return RiskLevel.HIGH;
    }
  
    if (score >= 5) {
      return RiskLevel.MEDIUM;
    }
  
    return RiskLevel.LOW;
  }
  
  export function calculateRiskRating(input: {
    likelihood: RiskLikelihood;
    impact: RiskImpact;
  }) {
    const score =
      calculateRiskScore(input);
  
    return {
      score,
      riskLevel:
        calculateRiskLevel(score),
    };
  }