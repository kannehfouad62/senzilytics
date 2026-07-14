import {
    RiskLevel,
  } from "@prisma/client";
  
  export type CorrectiveActionHierarchyLevel =
    | "ELIMINATION"
    | "SUBSTITUTION"
    | "ENGINEERING_CONTROL"
    | "ADMINISTRATIVE_CONTROL"
    | "TRAINING"
    | "PPE"
    | "MONITORING"
    | "OTHER";
  
  export type CorrectiveActionRecommendationPriority =
    | "IMMEDIATE"
    | "HIGH"
    | "MEDIUM"
    | "LOW";
  
  export type IncidentCorrectiveActionAiRecommendation = {
    recommendationId: string;
    title: string;
    description: string;
    rationale: string;
    hierarchyLevel:
      CorrectiveActionHierarchyLevel;
    priority:
      CorrectiveActionRecommendationPriority;
    suggestedRiskLevel: RiskLevel;
    suggestedOwnerRole: string;
    suggestedDueDays: number;
    implementationSteps: string[];
    dependencies: string[];
    verificationMethod: string;
    effectivenessCriteria: string[];
    evidenceBasis: string;
    addressesCause: string;
    duplicationAssessment: {
      appearsDuplicative: boolean;
      explanation: string;
    };
  };
  
  export type IncidentCorrectiveActionAiDraft = {
    executiveSummary: string;
    incidentControlObjective: string;
    recommendations:
      IncidentCorrectiveActionAiRecommendation[];
    immediateContainmentActions: string[];
    preventiveActionThemes: string[];
    missingInformation: string[];
    implementationSequence: string[];
    managementConsiderations: string[];
    confidenceAssessment: {
      level: "LOW" | "MEDIUM" | "HIGH";
      rationale: string;
    };
    limitationsNotice: string;
  };
  
  export type IncidentCorrectiveActionAiActionState =
    | {
        status: "IDLE";
        draft: null;
        error: null;
        generatedAt: null;
      }
    | {
        status: "SUCCESS";
        draft:
          IncidentCorrectiveActionAiDraft;
        error: null;
        generatedAt: string;
      }
    | {
        status: "ERROR";
        draft: null;
        error: string;
        generatedAt: null;
      };
  
  export const initialIncidentCorrectiveActionAiActionState: IncidentCorrectiveActionAiActionState =
    {
      status: "IDLE",
      draft: null,
      error: null,
      generatedAt: null,
    };