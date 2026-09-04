import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("survey campaigns use unique single-use recipient invitations", async () => {
  const [schema, migration, actions, submission, page] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../prisma/migrations/20260906020000_research_survey_campaigns/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/features/research/survey-campaign-actions.ts",
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
  ]);
  assert.match(schema, /model ResearchSurveyCampaign/);
  assert.match(schema, /model ResearchSurveyInvitation/);
  assert.match(schema, /@@unique\(\[campaignId, participantEmail\]\)/);
  assert.match(migration, /ResearchPublicResponse_invitationId_key/);
  assert.match(actions, /randomBytes\(32\)/);
  assert.match(actions, /MANAGE_RESEARCH_DATASETS/);
  assert.match(actions, /organizationId/);
  assert.match(actions, /reminderLimit/);
  assert.match(submission, /currentInvitation/);
  assert.match(submission, /status: "COMPLETED"/);
  assert.match(page, /status: \{ in: \["SENT", "OPENED"\] \}/);
});

test("campaign workspace exposes delivery funnel and completion timing", async () => {
  const source = await readFile(
    new URL(
      "../src/app/(platform)/research/collections/[collectionId]/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /Invitation campaigns/);
  assert.match(source, /Open\s+rate/);
  assert.match(source, /Average completion/);
  assert.match(source, /CampaignReminderButton/);
});
