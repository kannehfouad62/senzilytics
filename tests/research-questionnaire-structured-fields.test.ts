import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { matrixAnswer, rankingPosition } from "../src/modules/research/research-dataset.service";

test("matrix answers expand deterministically for analysis", () => {
  const value = [JSON.stringify(["Timeliness", "Excellent"]), JSON.stringify(["Accuracy", "Good"])];
  assert.equal(matrixAnswer(value, "Timeliness"), "Excellent");
  assert.equal(matrixAnswer(value, "Missing row"), null);
});

test("ranking answers expose numeric positions for analysis", () => {
  const value = ["Safety", "Quality", "Cost"];
  assert.equal(rankingPosition(value, "Safety"), 1);
  assert.equal(rankingPosition(value, "Cost"), 3);
  assert.equal(rankingPosition(value, "Unknown"), null);
});

test("matrix and ranking questions span governed web mobile localization and export paths", async () => {
  const [schema, migration, service, runtime, studio, mobile, mobileTypes, dataset, csv, localization] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20260911120000_research_matrix_ranking_questions/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/forms/configurable-form.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/forms/runtime-form.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(platform)/form-studio/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/mobile/App.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/mobile/src/types.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/research/research-dataset.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/research/collections/[collectionId]/export/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/research/questionnaire-localization-actions.ts", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /MATRIX\s+RANKING/);
  assert.match(migration, /ADD VALUE IF NOT EXISTS 'MATRIX'/);
  assert.match(service, /Matrix fields require at least two rows and two columns/);
  assert.match(runtime, /requires each option to have a unique rank/);
  assert.match(studio, /Matrix configuration/);
  assert.match(mobile, /MobileMatrixField/);
  assert.match(mobile, /Confirm displayed ranking/);
  assert.match(mobileTypes, /"MATRIX" \| "RANKING"/);
  assert.match(dataset, /type: "NUMBER"/);
  assert.match(csv, /displayAnswer/);
  assert.match(localization, /translatableOptions/);
});
