import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ResearchCampaignQuotaStatus,
  ResearchPanelMemberStatus,
} from "@prisma/client";

import {
  calculatePanelQualityScore,
  isPanelMemberEligible,
  summarizeQuota,
} from "../src/modules/research/research-panel-governance";

test("panel eligibility requires active non-expired consent", () => {
  const now = new Date("2026-09-04T12:00:00Z");
  assert.equal(
    isPanelMemberEligible(ResearchPanelMemberStatus.ACTIVE, null, now),
    true,
  );
  assert.equal(
    isPanelMemberEligible(
      ResearchPanelMemberStatus.ACTIVE,
      new Date("2026-09-05T00:00:00Z"),
      now,
    ),
    true,
  );
  assert.equal(
    isPanelMemberEligible(
      ResearchPanelMemberStatus.ACTIVE,
      new Date("2026-09-03T00:00:00Z"),
      now,
    ),
    false,
  );
  assert.equal(
    isPanelMemberEligible(ResearchPanelMemberStatus.OPTED_OUT, null, now),
    false,
  );
});

test("quality scoring and quota progress remain bounded", () => {
  assert.equal(
    calculatePanelQualityScore({ sent: 0, opened: 0, completed: 0, failed: 0 }),
    100,
  );
  assert.equal(
    calculatePanelQualityScore({
      sent: 10,
      opened: 8,
      completed: 6,
      failed: 1,
    }),
    65,
  );
  assert.deepEqual(summarizeQuota(20, 7), {
    completed: 7,
    remaining: 13,
    percentage: 35,
    status: ResearchCampaignQuotaStatus.OPEN,
  });
  assert.equal(
    summarizeQuota(20, 21).status,
    ResearchCampaignQuotaStatus.FILLED,
  );
});

test("participant panels preserve tenant consent and quota governance", async () => {
  const [schema, migration, actions, submission, page] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../prisma/migrations/20260906060000_research_panels_and_quotas/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/features/research/research-panel-actions.ts",
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
      new URL(
        "../src/app/(platform)/research/panels/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(schema, /model ResearchPanel /);
  assert.match(schema, /model ResearchPanelConsentEvent/);
  assert.match(schema, /model ResearchCampaignQuota/);
  assert.match(migration, /ResearchPanelMember_panelId_email_key/);
  assert.match(actions, /MANAGE_RESEARCH_DATASETS/);
  assert.match(actions, /organizationId/);
  assert.match(actions, /ResearchConsentEventType\.WITHDRAWN/);
  assert.match(actions, /ResearchConsentEventType\.RENEWED/);
  assert.match(actions, /quota\.target \* 3/);
  assert.match(submission, /isPanelMemberEligible/);
  assert.match(submission, /TransactionIsolationLevel\.Serializable/);
  assert.match(submission, /ResearchCampaignQuotaStatus\.FILLED/);
  assert.match(page, /Research Panels & Quotas/);
  assert.match(page, /Quality \{quality\}\/100/);
});
