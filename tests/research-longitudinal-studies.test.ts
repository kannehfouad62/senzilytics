import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ResearchLongitudinalParticipantStatus,
  ResearchLongitudinalStudyStatus,
} from "@prisma/client";
import {
  longitudinalTransitions,
  participantLongitudinalStatus,
  summarizeLongitudinalRetention,
} from "../src/modules/research/research-longitudinal";

test("longitudinal lifecycle prevents governance shortcuts", () => {
  assert.deepEqual(
    longitudinalTransitions[ResearchLongitudinalStudyStatus.DRAFT],
    [
      ResearchLongitudinalStudyStatus.ACTIVE,
      ResearchLongitudinalStudyStatus.CANCELLED,
    ],
  );
  assert.deepEqual(
    longitudinalTransitions[ResearchLongitudinalStudyStatus.COMPLETED],
    [],
  );
});

test("retention and participant completion are deterministic", () => {
  assert.deepEqual(
    summarizeLongitudinalRetention({
      enrolled: 100,
      completedBaseline: 90,
      completedCurrent: 72,
      withdrawn: 8,
      lost: 10,
      targetPercent: 80,
    }),
    {
      denominator: 90,
      retained: 72,
      attrition: 18,
      retentionPercent: 80,
      meetsTarget: true,
      withdrawn: 8,
      lost: 10,
    },
  );
  assert.equal(
    participantLongitudinalStatus(
      ResearchLongitudinalParticipantStatus.ENROLLED,
      3,
      3,
    ),
    ResearchLongitudinalParticipantStatus.COMPLETED,
  );
  assert.equal(
    participantLongitudinalStatus(
      ResearchLongitudinalParticipantStatus.WITHDRAWN,
      3,
      3,
    ),
    ResearchLongitudinalParticipantStatus.WITHDRAWN,
  );
});

test("longitudinal operations preserve tenant consent and response lineage", async () => {
  const [schema, migration, actions, page] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../prisma/migrations/20260906100000_research_longitudinal_studies/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/features/research/research-longitudinal-actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/(platform)/research/longitudinal/[studyId]/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(schema, /model ResearchLongitudinalStudy/);
  assert.match(schema, /model ResearchLongitudinalWave/);
  assert.match(schema, /model ResearchLongitudinalParticipant/);
  assert.match(
    migration,
    /ResearchLongitudinalParticipant_studyId_panelMemberId_key/,
  );
  assert.match(actions, /MANAGE_RESEARCH_DATASETS/);
  assert.match(actions, /organizationId/);
  assert.match(actions, /ResearchConsentEventType\.WITHDRAWN/);
  assert.match(actions, /consentExpiresAt: \{ gt: new Date\(\) \}/);
  assert.match(actions, /slice\(0, 500\)/);
  assert.match(page, /Cross-wave participant matrix/);
  assert.match(page, /Pseudonymous subject codes/);
});
