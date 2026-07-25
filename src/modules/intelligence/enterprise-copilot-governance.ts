import {
  AiCopilotConversationStatus,
  type AiIntelligenceConfidence,
} from "@prisma/client";
import type {
  AiCopilotDraft,
  AiCopilotPolicyInput,
} from "./enterprise-copilot.types";

export const AI_COPILOT_POLICY_VERSION = "COPILOT-1.0";
export const AI_COPILOT_DEFAULT_RETENTION_DAYS = 90;
export const AI_COPILOT_DEFAULT_MAX_TURNS = 20;
export const AI_COPILOT_MIN_RETENTION_DAYS = 30;
export const AI_COPILOT_MAX_RETENTION_DAYS = 365;
export const AI_COPILOT_MIN_TURNS = 5;
export const AI_COPILOT_MAX_TURNS = 40;
export const AI_COPILOT_MAX_QUESTION_LENGTH = 1_500;
export const AI_COPILOT_REDACTED_CONTENT =
  "[Conversation content removed under the tenant AI retention policy.]";

export function sanitizeCopilotQuestion(value: string | null | undefined) {
  const question = (value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!question) throw new Error("Enter a question for the EHS Copilot.");
  if (question.length > AI_COPILOT_MAX_QUESTION_LENGTH) {
    throw new Error(
      `The Copilot question cannot exceed ${AI_COPILOT_MAX_QUESTION_LENGTH} characters.`,
    );
  }
  return question;
}

export function validateCopilotPolicy(input: AiCopilotPolicyInput) {
  if (
    !Number.isInteger(input.retentionDays) ||
    input.retentionDays < AI_COPILOT_MIN_RETENTION_DAYS ||
    input.retentionDays > AI_COPILOT_MAX_RETENTION_DAYS
  ) {
    throw new Error(
      `Conversation retention must be between ${AI_COPILOT_MIN_RETENTION_DAYS} and ${AI_COPILOT_MAX_RETENTION_DAYS} days.`,
    );
  }
  if (
    !Number.isInteger(input.maxTurnsPerConversation) ||
    input.maxTurnsPerConversation < AI_COPILOT_MIN_TURNS ||
    input.maxTurnsPerConversation > AI_COPILOT_MAX_TURNS
  ) {
    throw new Error(
      `Conversation turns must be between ${AI_COPILOT_MIN_TURNS} and ${AI_COPILOT_MAX_TURNS}.`,
    );
  }
}

export function calculateCopilotRetentionExpiry(
  from: Date,
  retentionDays: number,
) {
  const expiry = new Date(from);
  expiry.setUTCDate(expiry.getUTCDate() + retentionDays);
  return expiry;
}

export function assertCopilotConversationWritable(input: {
  status: AiCopilotConversationStatus;
  purgedAt: Date | null;
}) {
  if (input.purgedAt) {
    throw new Error("This conversation has expired under the tenant retention policy.");
  }
  if (input.status !== AiCopilotConversationStatus.ACTIVE) {
    throw new Error("Archived Copilot conversations are read-only.");
  }
}

export function copilotConversationTitle(question: string) {
  const normalized = sanitizeCopilotQuestion(question);
  return normalized.length <= 80
    ? normalized
    : `${normalized.slice(0, 77).trimEnd()}…`;
}

function validSourceKeys(sourceKeys: string[], allowed: Set<string>) {
  return [...new Set(sourceKeys.filter((key) => allowed.has(key)))];
}

function boundedText(value: unknown, maximum: number, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`The Copilot response did not include ${field}.`);
  }
  return value.trim().slice(0, maximum);
}

export function normalizeCopilotDraft(
  draft: AiCopilotDraft,
  allowedSourceKeys: string[],
): AiCopilotDraft {
  const allowed = new Set(allowedSourceKeys);
  const answerSourceKeys = validSourceKeys(
    Array.isArray(draft.answerSourceKeys) ? draft.answerSourceKeys : [],
    allowed,
  );
  if (!answerSourceKeys.length) {
    throw new Error("The Copilot response did not include verifiable source citations.");
  }

  const keyPoints = (Array.isArray(draft.keyPoints) ? draft.keyPoints : [])
    .map((item) => ({
      text: boundedText(item.text, 1_500, "a key point"),
      sourceKeys: validSourceKeys(
        Array.isArray(item.sourceKeys) ? item.sourceKeys : [],
        allowed,
      ),
    }))
    .filter((item) => item.sourceKeys.length > 0)
    .slice(0, 6);
  const followUpQuestions = [
    ...new Set(
      (Array.isArray(draft.followUpQuestions)
        ? draft.followUpQuestions
        : []
      )
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].slice(0, 4);
  const confidenceLevel: AiIntelligenceConfidence = draft.confidence.level;
  const escalationSourceKeys = validSourceKeys(
    Array.isArray(draft.escalation?.sourceKeys)
      ? draft.escalation.sourceKeys
      : [],
    allowed,
  );

  return {
    answer: boundedText(draft.answer, 6_000, "an answer"),
    answerSourceKeys,
    keyPoints,
    followUpQuestions,
    confidence: {
      level: confidenceLevel,
      rationale: boundedText(
        draft.confidence.rationale,
        1_500,
        "a confidence rationale",
      ),
    },
    limitations: boundedText(draft.limitations, 2_000, "limitations"),
    escalation: {
      required: Boolean(draft.escalation?.required),
      reason: boundedText(
        draft.escalation?.reason,
        1_500,
        "an escalation rationale",
      ),
      sourceKeys: escalationSourceKeys,
    },
  };
}

export function citedCopilotSourceKeys(draft: AiCopilotDraft) {
  return [
    ...new Set([
      ...draft.answerSourceKeys,
      ...draft.keyPoints.flatMap((item) => item.sourceKeys),
      ...draft.escalation.sourceKeys,
    ]),
  ];
}
