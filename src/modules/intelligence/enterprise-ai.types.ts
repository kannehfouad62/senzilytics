import type {
  AiIntelligenceConfidence,
  AiIntelligenceSourceType,
  AiIntelligenceUseCase,
  PermissionKey,
} from "@prisma/client";

export type AiIntelligenceSourceRecord = {
  sourceKey: string;
  sourceType: AiIntelligenceSourceType;
  module: string;
  entityType: string;
  entityId: string;
  reference: string | null;
  title: string;
  summary: string;
  href: string;
};

export type AiIntelligenceFinding = {
  title: string;
  analysis: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  sourceKeys: string[];
};

export type AiIntelligenceTrend = {
  title: string;
  direction: "IMPROVING" | "STABLE" | "WORSENING" | "INSUFFICIENT_DATA";
  analysis: string;
  sourceKeys: string[];
};

export type AiIntelligencePriority = {
  title: string;
  rationale: string;
  urgency: "NOW" | "NEXT_30_DAYS" | "NEXT_90_DAYS";
  sourceKeys: string[];
};

export type AiIntelligenceDraft = {
  executiveSummary: string;
  executiveSummarySourceKeys: string[];
  keyRisks: AiIntelligenceFinding[];
  trends: AiIntelligenceTrend[];
  priorities: AiIntelligencePriority[];
  managementQuestions: Array<{
    question: string;
    rationale: string;
    sourceKeys: string[];
  }>;
  confidence: {
    level: AiIntelligenceConfidence;
    rationale: string;
  };
  limitations: string;
};

export type GenerateAiIntelligenceInput = {
  organizationId: string;
  userId: string;
  permissions: PermissionKey[];
  useCase: AiIntelligenceUseCase;
  question?: string | null;
};

export type AiIntelligenceActionState = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  message: string | null;
  analysisId: string | null;
};

export const initialAiIntelligenceActionState: AiIntelligenceActionState = {
  status: "IDLE",
  message: null,
  analysisId: null,
};
