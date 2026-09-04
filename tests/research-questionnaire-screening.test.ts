import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  evaluateScreeningAnswer,
  screeningCookieName,
} from "../src/modules/research/research-screening";

test("screening evaluates governed values case-insensitively", () => {
  assert.equal(evaluateScreeningAnswer("Yes", ["yes", "eligible"]), true);
  assert.equal(evaluateScreeningAnswer(["No", "GHANA"], ["Ghana"]), true);
  assert.equal(evaluateScreeningAnswer("No", ["Yes"]), false);
  assert.equal(evaluateScreeningAnswer("Yes", []), false);
  assert.match(
    screeningCookieName("public-link-token"),
    /^senzilytics_screen_/,
  );
});

test("screening is a tenant-scoped pre-questionnaire gate", async () => {
  const [schema, migration, actions, page, form] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../prisma/migrations/20260906180000_research_questionnaire_screening/migration.sql",
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
        "../src/features/research/public-survey-forms.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(schema, /model ResearchSurveyScreeningRecord/);
  assert.match(schema, /DISQUALIFIED/);
  assert.match(migration, /ResearchSurveyScreeningRecord_invitationId_key/);
  assert.match(actions, /accessTokenHash: tokenHash/);
  assert.match(actions, /invitationId: invitation\?\.id \?\? null/);
  assert.match(actions, /status: "DISQUALIFIED"/);
  assert.match(actions, /Complete eligibility screening first/);
  assert.match(page, /screeningRecord\?\.outcome !== "ELIGIBLE"/);
  assert.match(form, /Screening outcomes are recorded separately/);
});
