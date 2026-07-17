export type MocExecutiveAiSignificance =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type MocExecutiveAiInsight = {
  title: string;
  observation: string;
  evidenceBasis: string;
  significance: MocExecutiveAiSignificance;
};

export type MocExecutiveAiPriority = {
  priority: number;
  title: string;
  recommendedAction: string;
  rationale: string;
  suggestedOwnerFunction: string;
  suggestedTimeframe: string;
  successMeasure: string;
};

export type MocExecutiveAiDraft = {
  executiveSummary: string;

  portfolioAssessment: {
    overallCondition:
      | "STABLE"
      | "WATCH"
      | "ELEVATED"
      | "CRITICAL";

    rationale: string;
  };

  keyFindings: MocExecutiveAiInsight[];
  positiveSignals: MocExecutiveAiInsight[];
  approvalBottlenecks: MocExecutiveAiInsight[];
  implementationRisks: MocExecutiveAiInsight[];
  temporaryChangeExposure: MocExecutiveAiInsight[];
  siteExposureInsights: MocExecutiveAiInsight[];
  ownerWorkloadInsights: MocExecutiveAiInsight[];
  riskProfileInsights: MocExecutiveAiInsight[];
  governanceInsights: MocExecutiveAiInsight[];

  recommendedPriorities: MocExecutiveAiPriority[];

  managementQuestions: string[];
  dataQualityCautions: string[];

  confidenceAssessment: {
    level:
      | "LOW"
      | "MEDIUM"
      | "HIGH";

    rationale: string;
  };

  limitationsNotice: string;
};

export type MocExecutiveAiActionState =
  | {
      status: "IDLE";
      draft: null;
      error: null;
      generatedAt: null;
    }
  | {
      status: "SUCCESS";
      draft: MocExecutiveAiDraft;
      error: null;
      generatedAt: string;
    }
  | {
      status: "ERROR";
      draft: null;
      error: string;
      generatedAt: null;
    };

export const initialMocExecutiveAiActionState: MocExecutiveAiActionState =
  {
    status: "IDLE",
    draft: null,
    error: null,
    generatedAt: null,
  };