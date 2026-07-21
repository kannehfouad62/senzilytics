import {
  AiIntelligenceStatus,
  AiIntelligenceUseCase,
  type AiIntelligenceConfidence,
} from "@prisma/client";
import type { AiIntelligenceDraft } from "./enterprise-ai.types";

const MAX_QUESTION_LENGTH = 1500;

export function sanitizeAiQuestion(value: string | null | undefined) {
  const question = (value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (question.length > MAX_QUESTION_LENGTH) {
    throw new Error(`The intelligence question cannot exceed ${MAX_QUESTION_LENGTH} characters.`);
  }

  return question || null;
}

export function validateAiUseCaseQuestion(useCase: AiIntelligenceUseCase, question: string | null) {
  if (useCase === AiIntelligenceUseCase.CUSTOM_QUERY && !question) {
    throw new Error("Enter a specific management question for a custom analysis.");
  }
}

export function getAiAnalysisTitle(useCase: AiIntelligenceUseCase, generatedAt = new Date()) {
  const label: Record<AiIntelligenceUseCase, string> = {
    DAILY_BRIEFING: "Daily EHS intelligence briefing",
    EXECUTIVE_RISK: "Executive risk exposure analysis",
    AUDIT_FOCUS: "Audit focus and assurance analysis",
    REGULATORY_IMPACT: "Regulatory impact analysis",
    CONTROL_EFFECTIVENESS: "Critical-control effectiveness analysis",
    CUSTOM_QUERY: "Custom EHS intelligence analysis",
  };

  return `${label[useCase]} — ${generatedAt.toLocaleDateString("en-US")}`;
}

export function assertAiReviewTransition(current: AiIntelligenceStatus, next: AiIntelligenceStatus) {
  if (current !== AiIntelligenceStatus.PENDING_REVIEW) {
    throw new Error("This intelligence analysis already has a final review decision.");
  }

  if (next !== AiIntelligenceStatus.APPROVED && next !== AiIntelligenceStatus.REJECTED) {
    throw new Error("Select approve or reject as the review decision.");
  }
}

function validSourceKeys(sourceKeys: string[], allowed: Set<string>) {
  return [...new Set(sourceKeys.filter((key) => allowed.has(key)))];
}

export function normalizeAiDraft(draft: AiIntelligenceDraft, allowedSourceKeys: string[]): AiIntelligenceDraft {
  const allowed = new Set(allowedSourceKeys);
  const executiveSummarySourceKeys = validSourceKeys(draft.executiveSummarySourceKeys, allowed);

  if (!executiveSummarySourceKeys.length) {
    throw new Error("The AI response did not include verifiable source citations.");
  }

  const keyRisks = draft.keyRisks
    .map((item) => ({ ...item, sourceKeys: validSourceKeys(item.sourceKeys, allowed) }))
    .filter((item) => item.sourceKeys.length > 0)
    .slice(0, 6);
  const trends = draft.trends
    .map((item) => ({ ...item, sourceKeys: validSourceKeys(item.sourceKeys, allowed) }))
    .filter((item) => item.sourceKeys.length > 0)
    .slice(0, 5);
  const priorities = draft.priorities
    .map((item) => ({ ...item, sourceKeys: validSourceKeys(item.sourceKeys, allowed) }))
    .filter((item) => item.sourceKeys.length > 0)
    .slice(0, 6);
  const managementQuestions = draft.managementQuestions
    .map((item) => ({ ...item, sourceKeys: validSourceKeys(item.sourceKeys, allowed) }))
    .filter((item) => item.sourceKeys.length > 0)
    .slice(0, 6);

  const confidenceLevel: AiIntelligenceConfidence = draft.confidence.level;

  return {
    ...draft,
    executiveSummarySourceKeys,
    keyRisks,
    trends,
    priorities,
    managementQuestions,
    confidence: { ...draft.confidence, level: confidenceLevel },
  };
}
