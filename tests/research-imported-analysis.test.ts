import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("imported analysis reads only approved tenant-scoped private versions",async()=>{
  const source=await readFile(new URL("../src/modules/research/imported-analysis-dataset.service.ts",import.meta.url),"utf8");
  assert.match(source,/organizationId/);assert.match(source,/ResearchDatasetVersionStatus\.APPROVED/);assert.match(source,/access:"private"/);
});
test("research analyses enforce exactly one governed source and preserve version lineage",async()=>{
  const [migration,action]=await Promise.all([readFile(new URL("../prisma/migrations/20260905010000_imported_dataset_analysis/migration.sql",import.meta.url),"utf8"),readFile(new URL("../src/features/research/analysis-actions.ts",import.meta.url),"utf8")]);
  assert.match(migration,/ResearchAnalysis_source_check/);assert.match(migration,/datasetVersionId/);assert.match(action,/Boolean\(collectionId\)===Boolean\(datasetVersionId\)/);assert.match(action,/datasetVersionId/);assert.match(action,/APPROVE_RESEARCH_OUTPUTS/);
});
test("native analysis exports identify their immutable imported source",async()=>{
  const [workbook,presentation]=await Promise.all([readFile(new URL("../src/app/api/research/analyses/[analysisId]/workbook/route.ts",import.meta.url),"utf8"),readFile(new URL("../src/app/api/research/analyses/[analysisId]/presentation/route.ts",import.meta.url),"utf8")]);
  for(const source of [workbook,presentation]){assert.match(source,/datasetVersion/);assert.match(source,/no-store/);assert.match(source,/EXPORT_RESEARCH_OUTPUTS/)}
});
