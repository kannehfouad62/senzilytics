export type ExecutiveReportAiInsight = {
    title: string;
    observation: string;
    evidenceBasis: string;
    significance:
      | "LOW"
      | "MEDIUM"
      | "HIGH"
      | "CRITICAL";
  };
  
  export type ExecutiveReportAiPriority = {
    priority: number;
    title: string;
    recommendedAction: string;
    rationale: string;
    suggestedOwnerFunction: string;
    suggestedTimeframe: string;
    successMeasure: string;
  };

  export type ExecutivePredictiveSignal = {
    title: string;
  
    signalType:
      | "EMERGING_RISK"
      | "DETERIORATING_CONTROL"
      | "RECURRING_FINDING"
      | "OVERDUE_EXPOSURE"
      | "OWNERSHIP_GAP"
      | "PERFORMANCE_DIVERGENCE"
      | "OTHER";
  
    observation: string;
    supportingEvidence: string;
  
    direction:
      | "IMPROVING"
      | "STABLE"
      | "DETERIORATING"
      | "UNCLEAR";
  
    horizon:
      | "IMMEDIATE"
      | "NEXT_30_DAYS"
      | "NEXT_QUARTER"
      | "LONGER_TERM";
  
    significance:
      | "LOW"
      | "MEDIUM"
      | "HIGH"
      | "CRITICAL";
  
    managementConsideration: string;
  };
  
  export type ExecutiveEffectivenessInsight = {
    title: string;
  
    area:
      | "CAPA"
      | "AUDIT"
      | "INSPECTION"
      | "TRAINING"
      | "RISK_CONTROL"
      | "GOVERNANCE";
  
    assessment:
      | "EFFECTIVE"
      | "PARTIALLY_EFFECTIVE"
      | "INEFFECTIVE"
      | "INSUFFICIENT_EVIDENCE";
  
    observation: string;
    supportingEvidence: string;
    evidenceLimitations: string;
    recommendedReviewAction: string;
  };
  
  export type ExecutiveForecastConsideration = {
    title: string;
    forecastHorizon: string;
    currentConditions: string;
    potentialDevelopment: string;
    supportingEvidence: string;
    uncertainty: string;
    suggestedPreparation: string;
  };
  
  export type ExecutiveReportAiDraft = {
    executiveSummary: string;
  
    keyFindings:
      ExecutiveReportAiInsight[];
  
    positiveSignals:
      ExecutiveReportAiInsight[];
  
    riskSignals:
      ExecutiveReportAiInsight[];
  
    capaInsights:
      ExecutiveReportAiInsight[];
  
    auditAndInspectionInsights:
      ExecutiveReportAiInsight[];
  
    siteExposureInsights:
      ExecutiveReportAiInsight[];
  
    governanceInsights:
      ExecutiveReportAiInsight[];
  
    dataQualityCautions: string[];
  
    confidenceAssessment: {
      level:
        | "LOW"
        | "MEDIUM"
        | "HIGH";
  
      rationale: string;
    };
  
    limitationsNotice: string;

    crossModuleInsights: {
      title: string;
      observation: string;
      supportingEvidence: string;
      significance:
        | "LOW"
        | "MEDIUM"
        | "HIGH"
        | "CRITICAL";
    }[];
    
    enterpriseRiskInsights: {
      title: string;
      observation: string;
      supportingEvidence: string;
      recommendedExecutiveAction: string;
    }[];
    
    strategicOpportunities: {
      title: string;
      opportunity: string;
      expectedBenefit: string;
      recommendedOwnerFunction: string;
    }[];

  predictiveSignals:
    ExecutivePredictiveSignal[];

  effectivenessInsights:
    ExecutiveEffectivenessInsight[];

  forecastConsiderations:
    ExecutiveForecastConsideration[];

  leadingIndicatorRecommendations: {
    indicator: string;
    purpose: string;
    sourceModule: string;
    suggestedReviewFrequency: string;
    escalationThreshold: string;
}[];

  recommendedPriorities:
    ExecutiveReportAiPriority[];
  };
  
  export type ExecutiveReportAiActionState =
    | {
        status: "IDLE";
        draft: null;
        error: null;
        generatedAt: null;
      }
    | {
        status: "SUCCESS";
        draft:
          ExecutiveReportAiDraft;
        error: null;
        generatedAt: string;
      }
    | {
        status: "ERROR";
        draft: null;
        error: string;
        generatedAt: null;
      };
  
  export const initialExecutiveReportAiActionState: ExecutiveReportAiActionState =
    {
      status: "IDLE",
      draft: null,
      error: null,
      generatedAt: null,
    };