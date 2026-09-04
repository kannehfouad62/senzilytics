import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { ResearchSamplingDesignType } from "@prisma/client";
import {
  generateSamplingSelection,
  type SamplingFrameRow,
} from "../src/modules/research/research-sampling-execution";
import { validateSamplingFrame } from "../src/modules/research/research-sampling-frame";

const rows: SamplingFrameRow[] = Array.from({ length: 20 }, (_, index) => ({
  frameRowNumber: index + 2,
  unitReference: `UNIT-${index + 1}`,
  stratum: index < 12 ? "A" : "B",
  cluster: `C${Math.floor(index / 5) + 1}`,
}));

test("simple random sampling is deterministic and retains reserve lineage", () => {
  const input = {
    type: ResearchSamplingDesignType.SIMPLE_RANDOM,
    rows,
    targetSampleSize: 8,
    reserveSampleSize: 2,
    seed: "approved-seed-2026",
  };
  const first = generateSamplingSelection(input);
  const second = generateSamplingSelection(input);
  assert.deepEqual(first, second);
  assert.equal(first.units.filter((unit) => !unit.isReserve).length, 8);
  assert.equal(first.units.filter((unit) => unit.isReserve).length, 2);
  assert.equal(new Set(first.units.map((unit) => unit.unitReference)).size, 10);
  assert.ok(first.units.every((unit) => unit.frameRowNumber >= 2));
  assert.equal(first.snapshot.seedFingerprint.length, 64);
});

test("stratified allocation is proportional and calculates design weights", () => {
  const result = generateSamplingSelection({
    type: ResearchSamplingDesignType.STRATIFIED,
    rows,
    targetSampleSize: 10,
    reserveSampleSize: 2,
    seed: "strata-seed",
  });
  assert.equal(
    result.snapshot.allocations.find((item) => item.group === "A")?.primary,
    6,
  );
  assert.equal(
    result.snapshot.allocations.find((item) => item.group === "B")?.primary,
    4,
  );
  assert.ok(
    result.units
      .filter((unit) => !unit.isReserve)
      .every(
        (unit) => unit.inclusionProbability === 0.5 && unit.baseWeight === 2,
      ),
  );
});

test("systematic selection covers the requested sample without duplicates", () => {
  const result = generateSamplingSelection({
    type: ResearchSamplingDesignType.SYSTEMATIC,
    rows,
    targetSampleSize: 5,
    reserveSampleSize: 1,
    seed: "systematic-seed",
  });
  assert.equal(result.units.length, 6);
  assert.equal(new Set(result.units.map((unit) => unit.unitReference)).size, 6);
});

test("sampling frames reject missing and duplicate identifiers", () => {
  const validated = validateSamplingFrame({
    rows: [
      ["id", "stratum", "cluster"],
      ["1", "A", "C1"],
      ["2", "B", "C2"],
    ],
    identifierColumn: "id",
    strataColumn: "stratum",
    clusterColumn: "cluster",
  });
  assert.equal(validated.frameRows.length, 2);
  assert.equal(validated.validation.strataCount, 2);
  assert.throws(
    () =>
      validateSamplingFrame({
        rows: [["id"], ["1"], ["1"]],
        identifierColumn: "id",
      }),
    /must be unique/,
  );
});

test("sampling execution is private tenant scoped audited and independently approved", async () => {
  const [upload, actions, certificate, migration] = await Promise.all([
    readFile(
      new URL(
        "../src/app/api/research/sampling-frames/upload/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/features/research/sampling-execution-actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/api/research/sampling-executions/[executionId]/certificate/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../prisma/migrations/20260905190000_research_sampling_execution/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(upload, /access: "private"/);
  assert.match(upload, /organizationId/);
  assert.match(upload, /ResearchSamplingDesignStatus\.APPROVED/);
  assert.match(actions, /generatedById === user\.id/);
  assert.match(actions, /APPROVE_RESEARCH_OUTPUTS/);
  assert.match(actions, /logActivity/);
  assert.match(certificate, /EXPORT_RESEARCH_OUTPUTS/);
  assert.match(certificate, /Selection Register/);
  assert.match(migration, /ResearchSamplingExecution/);
});
