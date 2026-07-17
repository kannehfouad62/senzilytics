export type RiskAiSignificance =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type RiskAiInsight = {
  title: string;
  observation: string;
  evidenceBasis: string;
  significance: RiskAiSignificance;
};

export type RiskAiControlRecommendation = {
  recommendationId: string;
  title: string;
  description: string;
  rationale: string;

  controlHierarchy:
    | "ELIMINATION"
    | "SUBSTITUTION"
    | "ENGINEERING"
    | "ADMINISTRATIVE"
    | "TRAINING"
    | "PPE"
    | "MONITORING"
    | "OTHER";

  priority:
    | "IMMEDIATE"
    | "HIGH"
    | "MEDIUM"
    | "LOW";

  suggestedOwnerFunction: string;
  suggestedDueDays: number;

  implementationSteps: string[];
  dependencies: string[];

  verificationMethod: string;
  effectivenessCriteria: string[];

  evidenceBasis: string;
  addressesExposure: string;

  duplicationAssessment: {
    appearsDuplicative: boolean;
    explanation: string;
  };
};

export type RiskAiManagementPriority = {
  priority: number;
  title: string;
  recommendedAction: string;
  rationale: string;
  suggestedOwnerFunction: string;
  suggestedTimeframe: string;
  successMeasure: string;
};

export type RiskAiDraft = {
  executiveSummary: string;

  riskConditionAssessment: {
    currentExposure: string;
    residualExposure: string;
    riskDirection:
      | "DECREASING"
      | "STABLE"
      | "INCREASING"
      | "UNCLEAR";
    rationale: string;
  };

  keyInsights: RiskAiInsight[];
  controlGapInsights: RiskAiInsight[];
  ownershipAndGovernanceInsights: RiskAiInsight[];
  monitoringInsights: RiskAiInsight[];

  recommendedControls:
    RiskAiControlRecommendation[];

  evidenceGaps: string[];
  reviewQuestions: string[];
  suggestedLeadingIndicators: string[];
  suggestedLaggingIndicators: string[];
  escalationConsiderations: string[];

  managementPriorities:
    RiskAiManagementPriority[];

  confidenceAssessment: {
    level:
      | "LOW"
      | "MEDIUM"
      | "HIGH";
    rationale: string;
  };

  limitationsNotice: string;
};

export type RiskAiActionState =
  | {
      status: "IDLE";
      draft: null;
      error: null;
      generatedAt: null;
    }
  | {
      status: "SUCCESS";
      draft: RiskAiDraft;
      error: null;
      generatedAt: string;
    }
  | {
      status: "ERROR";
      draft: null;
      error: string;
      generatedAt: null;
    };

export const initialRiskAiActionState: RiskAiActionState =
  {
    status: "IDLE",
    draft: null,
    error: null,
    generatedAt: null,
  };