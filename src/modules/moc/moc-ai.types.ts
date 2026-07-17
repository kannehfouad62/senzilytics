import type {
    MocApprovalRole,
    MocTaskType,
    RiskImpact,
    RiskLevel,
    RiskLikelihood,
  } from "@prisma/client";
  
  export type MocAiSignificance =
    | "LOW"
    | "MEDIUM"
    | "HIGH"
    | "CRITICAL";
  
  export type MocAiHazardCategory =
    | "SAFETY"
    | "ENVIRONMENTAL"
    | "OPERATIONAL"
    | "QUALITY"
    | "REGULATORY"
    | "SECURITY"
    | "TECHNOLOGY"
    | "HUMAN_FACTORS"
    | "OTHER";
  
  export type MocAiControlHierarchy =
    | "ELIMINATION"
    | "SUBSTITUTION"
    | "ENGINEERING"
    | "ADMINISTRATIVE"
    | "TRAINING"
    | "PPE"
    | "MONITORING"
    | "OTHER";
  
  export type MocAiHazard = {
    title: string;
    category: MocAiHazardCategory;
    description: string;
    exposurePathway: string;
    potentialConsequence: string;
    significance: MocAiSignificance;
    evidenceBasis: string;
  };
  
  export type MocAiControlRecommendation = {
    recommendationId: string;
    title: string;
    description: string;
    hierarchy: MocAiControlHierarchy;
  
    priority:
      | "IMMEDIATE"
      | "HIGH"
      | "MEDIUM"
      | "LOW";
  
    rationale: string;
    addressesHazards: string[];
    suggestedOwnerFunction: string;
    verificationMethod: string;
    effectivenessCriteria: string[];
    evidenceBasis: string;
  
    duplicationAssessment: {
      appearsDuplicative: boolean;
      explanation: string;
    };
  };
  
  export type MocAiApprovalRecommendation = {
    role: MocApprovalRole;
    sequence: number;
    rationale: string;
    required: boolean;
  };
  
  export type MocAiTaskRecommendation = {
    recommendationId: string;
    title: string;
    description: string;
    taskType: MocTaskType;
    sequence: number;
    required: boolean;
    suggestedOwnerFunction: string;
    suggestedDueDays: number;
    completionEvidence: string;
    verificationCriteria: string[];
  };
  
  export type MocAiVerificationActivity = {
    title: string;
    description: string;
    suggestedOwnerFunction: string;
    timing: string;
    evidenceRequired: string;
    acceptanceCriteria: string[];
  };
  
  export type MocAiAssessmentDraft = {
    executiveSummary: string;
  
    changeConditionAssessment: {
      scopeClarity:
        | "ADEQUATE"
        | "PARTIALLY_ADEQUATE"
        | "INADEQUATE";
  
      impactClarity:
        | "ADEQUATE"
        | "PARTIALLY_ADEQUATE"
        | "INADEQUATE";
  
      implementationReadiness:
        | "READY_FOR_REVIEW"
        | "ADDITIONAL_INFORMATION_REQUIRED"
        | "SIGNIFICANT_GAPS";
  
      rationale: string;
    };
  
    majorHazards: MocAiHazard[];
  
    operationalRisks: string[];
    environmentalRisks: string[];
    safetyRisks: string[];
    qualityRisks: string[];
    regulatoryConsiderations: string[];
    humanFactorConsiderations: string[];
  
    recommendedControls:
      MocAiControlRecommendation[];
  
    residualRiskRecommendation: {
      likelihood: RiskLikelihood;
      impact: RiskImpact;
      score: number;
      riskLevel: RiskLevel;
      rationale: string;
      assumptions: string[];
    };
  
    recommendedApprovals:
      MocAiApprovalRecommendation[];
  
    recommendedTasks:
      MocAiTaskRecommendation[];
  
    verificationActivities:
      MocAiVerificationActivity[];
  
    documentationUpdates: string[];
    trainingNeeds: string[];
    inspectionNeeds: string[];
    communicationNeeds: string[];
  
    informationGaps: string[];
    reviewQuestions: string[];
    escalationConsiderations: string[];
  
    managementPriorities: {
      priority: number;
      title: string;
      recommendedAction: string;
      rationale: string;
      suggestedOwnerFunction: string;
      suggestedTimeframe: string;
      successMeasure: string;
    }[];
  
    confidenceAssessment: {
      level:
        | "LOW"
        | "MEDIUM"
        | "HIGH";
  
      rationale: string;
    };
  
    limitationsNotice: string;
  };
  
  export type MocAiActionState =
    | {
        status: "IDLE";
        draft: null;
        error: null;
        generatedAt: null;
      }
    | {
        status: "SUCCESS";
        draft: MocAiAssessmentDraft;
        error: null;
        generatedAt: string;
      }
    | {
        status: "ERROR";
        draft: null;
        error: string;
        generatedAt: null;
      };
  
  export const initialMocAiActionState: MocAiActionState =
    {
      status: "IDLE",
      draft: null,
      error: null,
      generatedAt: null,
    };

    export type MocAiApplyActionState = {
      status:
        | "IDLE"
        | "SUCCESS"
        | "ERROR";
    
      message: string | null;
    
      result: {
        residualRiskUpdated: boolean;
        approvalsCreated: number;
        approvalsSkipped: number;
        tasksCreated: number;
        tasksSkipped: number;
      } | null;
    };
    
    export const initialMocAiApplyActionState: MocAiApplyActionState =
      {
        status: "IDLE",
        message: null,
        result: null,
      };
