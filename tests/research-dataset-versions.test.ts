import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createDatasetQualitySnapshot, researchRowsToCsv } from "../src/modules/research/research-dataset-version";

test("dataset quality snapshots are deterministic",()=>{
  assert.deepEqual(createDatasetQualitySnapshot([{a:1},{a:2}],[{a:1,score_outlier:false},{a:"",score_outlier:true}],["a","score_outlier"]),{sourceRows:2,outputRows:2,removedRows:0,missingCells:1,outlierFlags:1});
});

test("materialized CSV escapes content and neutralizes spreadsheet formulas",()=>{
  const csv=researchRowsToCsv([{name:"Ada, Inc.",note:"=HYPERLINK(\"bad\")"}],["name","note"]);
  assert.match(csv,/"Ada, Inc\."/);
  assert.match(csv,/'=HYPERLINK/);
});

test("dataset version governance is tenant scoped, private, audited, and independently approved",async()=>{
  const [action,route]=await Promise.all([
    readFile(new URL("../src/features/research/dataset-version-actions.ts",import.meta.url),"utf8"),
    readFile(new URL("../src/app/api/research/imports/versions/[versionId]/download/route.ts",import.meta.url),"utf8"),
  ]);
  assert.match(action,/MANAGE_RESEARCH_DATASETS/);
  assert.match(action,/organizationId/);
  assert.match(action,/createdById\s*===\s*user\.id/);
  assert.match(action,/SUPERSEDED/);
  assert.match(action,/logActivity/);
  assert.match(route,/EXPORT_RESEARCH_OUTPUTS/);
  assert.match(route,/access:"private"/);
  assert.match(route,/no-store/);
});
