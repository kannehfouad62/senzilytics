import assert from "node:assert/strict";
import test from "node:test";
import {
  AiIntelligenceConfidence,
  AiIntelligenceStatus,
  AiIntelligenceUseCase,
} from "@prisma/client";
import {
  assertAiReviewTransition,
  normalizeAiDraft,
  sanitizeAiQuestion,
  validateAiUseCaseQuestion,
} from "../src/modules/intelligence/enterprise-ai-governance";
import type { AiIntelligenceDraft } from "../src/modules/intelligence/enterprise-ai.types";

const draft: AiIntelligenceDraft = {
  executiveSummary: "A cited summary.",
  executiveSummarySourceKeys: ["SRC-001", "INVALID"],
  keyRisks: [
    { title: "Supported", analysis: "Evidence", severity: "HIGH", sourceKeys: ["SRC-001"] },
    { title: "Unsupported", analysis: "No evidence", severity: "HIGH", sourceKeys: ["INVALID"] },
  ],
  trends: [],
  priorities: [],
  managementQuestions: [],
  confidence: { level: AiIntelligenceConfidence.MEDIUM, rationale: "Limited history." },
  limitations: "Snapshot only.",
};

test("AI questions are normalized and custom requests require a question", () => {
  assert.equal(sanitizeAiQuestion("  Which\n controls   are weak?  "), "Which controls are weak?");
  assert.throws(() => validateAiUseCaseQuestion(AiIntelligenceUseCase.CUSTOM_QUERY, null));
  assert.doesNotThrow(() => validateAiUseCaseQuestion(AiIntelligenceUseCase.DAILY_BRIEFING, null));
});

test("AI review decisions are final and cannot bypass pending review", () => {
  assert.doesNotThrow(() => assertAiReviewTransition(AiIntelligenceStatus.PENDING_REVIEW, AiIntelligenceStatus.APPROVED));
  assert.throws(() => assertAiReviewTransition(AiIntelligenceStatus.APPROVED, AiIntelligenceStatus.REJECTED));
  assert.throws(() => assertAiReviewTransition(AiIntelligenceStatus.PENDING_REVIEW, AiIntelligenceStatus.PENDING_REVIEW));
});

test("AI output retains only authorized citations and removes unsupported items", () => {
  const normalized = normalizeAiDraft(draft, ["SRC-001"]);
  assert.deepEqual(normalized.executiveSummarySourceKeys, ["SRC-001"]);
  assert.deepEqual(normalized.keyRisks.map((item) => item.title), ["Supported"]);
});

test("AI output without a valid executive citation is rejected", () => {
  assert.throws(() => normalizeAiDraft({ ...draft, executiveSummarySourceKeys: ["INVALID"] }, ["SRC-001"]));
});
