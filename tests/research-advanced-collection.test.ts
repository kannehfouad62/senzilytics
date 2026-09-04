import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  calculateResponseIntegrity,
  deterministicFieldOrder,
  resumeCookieName,
} from "../src/modules/research/research-response-integrity";

test("response integrity flags speeding without excluding the response", () => {
  assert.deepEqual(
    calculateResponseIntegrity({
      startedAt: new Date("2026-09-04T12:00:00Z"),
      submittedAt: new Date("2026-09-04T12:00:20Z"),
      minimumCompletionSeconds: 60,
      answerCount: 5,
    }),
    { completionSeconds: 20, flags: ["SPEEDING"], status: "REVIEW" },
  );
  assert.equal(
    calculateResponseIntegrity({
      startedAt: new Date("2026-09-04T12:00:00Z"),
      submittedAt: new Date("2026-09-04T12:02:00Z"),
      minimumCompletionSeconds: 60,
      answerCount: 5,
    }).status,
    "CLEAR",
  );
});

test("question randomization is deterministic and non-mutating", () => {
  const fields = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const first = deterministicFieldOrder(fields, "participant-one");
  assert.deepEqual(first, deterministicFieldOrder(fields, "participant-one"));
  assert.deepEqual(
    fields.map((item) => item.id),
    ["a", "b", "c", "d"],
  );
  assert.match(resumeCookieName("public-token-value"), /^senzilytics_survey_/);
});

test("resumable sessions are hash-only version-bound and tenant governed", async () => {
  const [schema, migration, actions, page, review] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../prisma/migrations/20260906140000_research_advanced_collection/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/features/research/public-survey-actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/app/survey/[token]/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/(platform)/research/datasets/[collectionId]/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(schema, /model ResearchPublicSurveySession/);
  assert.match(migration, /resumeTokenHash/);
  assert.match(actions, /createHash\("sha256"\)/);
  assert.match(actions, /httpOnly: true/);
  assert.match(actions, /sameSite: "lax"/);
  assert.match(actions, /formVersionId: link\.collection\.formVersionId/);
  assert.match(actions, /organizationId: link\.organizationId/);
  assert.match(page, /deterministicFieldOrder/);
  assert.match(review, /Integrity review/);
});
