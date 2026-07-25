import assert from "node:assert/strict";
import test from "node:test";
import {
  AiCopilotConversationStatus,
  AiIntelligenceConfidence,
} from "@prisma/client";
import {
  assertCopilotConversationWritable,
  calculateCopilotRetentionExpiry,
  citedCopilotSourceKeys,
  copilotConversationTitle,
  normalizeCopilotDraft,
  sanitizeCopilotQuestion,
  validateCopilotPolicy,
} from "../src/modules/intelligence/enterprise-copilot-governance";
import type { AiCopilotDraft } from "../src/modules/intelligence/enterprise-copilot.types";

const draft: AiCopilotDraft = {
  answer: "Current evidence supports qualified management attention.",
  answerSourceKeys: ["SRC-001", "INVALID"],
  keyPoints: [
    { text: "Supported point", sourceKeys: ["SRC-002"] },
    { text: "Unsupported point", sourceKeys: ["INVALID"] },
  ],
  followUpQuestions: ["What control verification is overdue?"],
  confidence: {
    level: AiIntelligenceConfidence.MEDIUM,
    rationale: "The current source set is limited.",
  },
  limitations: "Only current tenant-authorized records were evaluated.",
  escalation: {
    required: true,
    reason: "A supported high-priority exception requires review.",
    sourceKeys: ["SRC-001"],
  },
};

test("Copilot questions are normalized, bounded, and produce safe titles", () => {
  assert.equal(
    sanitizeCopilotQuestion("  Which\n controls   need review?  "),
    "Which controls need review?",
  );
  assert.throws(() => sanitizeCopilotQuestion("   "), /Enter a question/);
  assert.equal(
    copilotConversationTitle("A".repeat(100)).length,
    78,
  );
});

test("tenant Copilot policy enforces retention and turn boundaries", () => {
  assert.doesNotThrow(() =>
    validateCopilotPolicy({
      enabled: true,
      retentionDays: 90,
      maxTurnsPerConversation: 20,
      includeConversationHistory: true,
    }),
  );
  assert.throws(
    () =>
      validateCopilotPolicy({
        enabled: true,
        retentionDays: 7,
        maxTurnsPerConversation: 20,
        includeConversationHistory: true,
      }),
    /between 30 and 365/,
  );
  assert.throws(
    () =>
      validateCopilotPolicy({
        enabled: true,
        retentionDays: 90,
        maxTurnsPerConversation: 100,
        includeConversationHistory: true,
      }),
    /between 5 and 40/,
  );
});

test("archived and purged conversations are immutable", () => {
  assert.doesNotThrow(() =>
    assertCopilotConversationWritable({
      status: AiCopilotConversationStatus.ACTIVE,
      purgedAt: null,
    }),
  );
  assert.throws(
    () =>
      assertCopilotConversationWritable({
        status: AiCopilotConversationStatus.ARCHIVED,
        purgedAt: null,
      }),
    /read-only/,
  );
  assert.throws(
    () =>
      assertCopilotConversationWritable({
        status: AiCopilotConversationStatus.ACTIVE,
        purgedAt: new Date(),
      }),
    /expired/,
  );
});

test("Copilot output retains only current authorized citations", () => {
  const normalized = normalizeCopilotDraft(draft, ["SRC-001", "SRC-002"]);
  assert.deepEqual(normalized.answerSourceKeys, ["SRC-001"]);
  assert.deepEqual(normalized.keyPoints, [
    { text: "Supported point", sourceKeys: ["SRC-002"] },
  ]);
  assert.deepEqual(citedCopilotSourceKeys(normalized), [
    "SRC-001",
    "SRC-002",
  ]);
  assert.throws(
    () =>
      normalizeCopilotDraft(
        { ...draft, answerSourceKeys: ["INVALID"] },
        ["SRC-001"],
      ),
    /verifiable source citations/,
  );
});

test("Copilot retention expiry uses deterministic UTC calendar days", () => {
  assert.equal(
    calculateCopilotRetentionExpiry(
      new Date("2026-07-25T18:30:00.000Z"),
      90,
    ).toISOString(),
    "2026-10-23T18:30:00.000Z",
  );
});
