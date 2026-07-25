import type { AiIntelligenceConfidence, PermissionKey } from "@prisma/client";

export type AiCopilotKeyPoint = {
  text: string;
  sourceKeys: string[];
};

export type AiCopilotDraft = {
  answer: string;
  answerSourceKeys: string[];
  keyPoints: AiCopilotKeyPoint[];
  followUpQuestions: string[];
  confidence: {
    level: AiIntelligenceConfidence;
    rationale: string;
  };
  limitations: string;
  escalation: {
    required: boolean;
    reason: string;
    sourceKeys: string[];
  };
};

export type AiCopilotRequestContext = {
  organizationId: string;
  userId: string;
  permissions: PermissionKey[];
};

export type AiCopilotActionState = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  message: string | null;
  conversationId: string | null;
};

export const initialAiCopilotActionState: AiCopilotActionState = {
  status: "IDLE",
  message: null,
  conversationId: null,
};

export type AiCopilotPolicyInput = {
  enabled: boolean;
  retentionDays: number;
  maxTurnsPerConversation: number;
  includeConversationHistory: boolean;
};
