import assert from "node:assert/strict";
import test from "node:test";
import { CompetencyProficiency } from "@prisma/client";
import {
  addCompetencyMonths,
  classifyCompetencyGap,
  meetsCompetencyLevel,
} from "../src/modules/training/competency-level";

test("competency proficiency satisfies equal and lower requirements", () => {
  assert.equal(meetsCompetencyLevel(CompetencyProficiency.ADVANCED, CompetencyProficiency.PRACTITIONER), true);
  assert.equal(meetsCompetencyLevel(CompetencyProficiency.WORKING, CompetencyProficiency.WORKING), true);
  assert.equal(meetsCompetencyLevel(CompetencyProficiency.AWARENESS, CompetencyProficiency.WORKING), false);
  assert.equal(meetsCompetencyLevel(null, CompetencyProficiency.AWARENESS), false);
});

test("competency validity preserves month end safely", () => {
  assert.equal(addCompetencyMonths(new Date("2028-01-31T12:00:00.000Z"), 1).toISOString(), "2028-02-29T12:00:00.000Z");
  assert.equal(addCompetencyMonths(new Date("2027-01-31T12:00:00.000Z"), 1).toISOString(), "2027-02-28T12:00:00.000Z");
});

test("competency gaps distinguish missing, expired, expiring and current evidence", () => {
  const now = new Date("2028-01-01T00:00:00.000Z");
  const expiryHorizon = new Date("2028-03-01T00:00:00.000Z");
  const base = { requiredLevel: CompetencyProficiency.WORKING, now, expiryHorizon };

  assert.equal(classifyCompetencyGap({ ...base, actualLevel: null, expiresAt: null, hadExpiredEvidence: false }), "GAP");
  assert.equal(classifyCompetencyGap({ ...base, actualLevel: null, expiresAt: null, hadExpiredEvidence: true }), "EXPIRED");
  assert.equal(classifyCompetencyGap({ ...base, actualLevel: CompetencyProficiency.PRACTITIONER, expiresAt: new Date("2028-02-01T00:00:00.000Z"), hadExpiredEvidence: false }), "EXPIRING");
  assert.equal(classifyCompetencyGap({ ...base, actualLevel: CompetencyProficiency.ADVANCED, expiresAt: new Date("2029-01-01T00:00:00.000Z"), hadExpiredEvidence: false }), "SATISFIED");
  assert.equal(classifyCompetencyGap({ ...base, actualLevel: CompetencyProficiency.AWARENESS, expiresAt: new Date("2029-01-01T00:00:00.000Z"), hadExpiredEvidence: false }), "GAP");
});
