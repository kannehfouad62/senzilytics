export type IncidentInvestigationAiDraft = {
    investigationSummary: string;
    immediateCauseHypotheses: string[];
    rootCauseHypotheses: string[];
    contributingFactors: string[];
    fiveWhys: Array<{
      level: number;
      question: string;
      answer: string;
      evidenceBasis: string;
    }>;
    evidenceToCollect: string[];
    interviewQuestions: string[];
    dataGaps: string[];
    recommendedNextSteps: string[];
    preliminaryCorrectiveActionThemes: string[];
    confidenceAssessment: {
      level: "LOW" | "MEDIUM" | "HIGH";
      rationale: string;
    };
    limitationsNotice: string;
  };
  
  export type IncidentInvestigationAiActionState =
    | {
        status: "IDLE";
        draft: null;
        error: null;
        generatedAt: null;
      }
    | {
        status: "SUCCESS";
        draft: IncidentInvestigationAiDraft;
        error: null;
        generatedAt: string;
      }
    | {
        status: "ERROR";
        draft: null;
        error: string;
        generatedAt: null;
      };
  
  export const initialIncidentInvestigationAiActionState: IncidentInvestigationAiActionState =
    {
      status: "IDLE",
      draft: null,
      error: null,
      generatedAt: null,
    };