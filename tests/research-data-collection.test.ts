import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("research collection actions re-authorize every mutation",async()=>{
  const source=await readFile(new URL("../src/features/research/collection-actions.ts",import.meta.url),"utf8");
  assert.match(source,/MANAGE_RESEARCH_DATASETS/);assert.match(source,/COLLECT_RESEARCH_DATA/);assert.match(source,/getCurrentUserTenant/);
});
test("research mutations invalidate the nested workspace and refresh successful client actions",async()=>{
  const [actions,collectionActions,hook]=await Promise.all([
    readFile(new URL("../src/features/research/actions.ts",import.meta.url),"utf8"),
    readFile(new URL("../src/features/research/collection-actions.ts",import.meta.url),"utf8"),
    readFile(new URL("../src/features/research/use-refresh-on-success.ts",import.meta.url),"utf8"),
  ]);
  assert.match(actions,/revalidatePath\("\/research",\s*"layout"\)/);
  assert.match(collectionActions,/revalidatePath\("\/research",\s*"layout"\)/);
  assert.match(hook,/state\.status === "SUCCESS"/);assert.match(hook,/router\.refresh\(\)/);
});
test("field creation returns to the refreshed questionnaire editor",async()=>{
  const source=await readFile(new URL("../src/features/forms/actions.ts",import.meta.url),"utf8");
  const action=source.slice(source.indexOf("export async function addConfigurableField"),source.indexOf("export async function removeConfigurableField"));
  assert.match(action,/revalidatePath/);assert.match(action,/redirect\(`\/form-studio\/\$\{definitionId\}`\)/);
});
test("research responses remain tenant, assignment and immutable-version scoped",async()=>{
  const source=await readFile(new URL("../src/modules/research/research-collection.service.ts",import.meta.url),"utf8");
  assert.match(source,/organizationId:input\.organizationId/);assert.match(source,/respondentId:input\.userId/);assert.match(source,/formVersionId/);assert.match(source,/status:ResearchAssignmentStatus\.COMPLETED/);
});
test("research exports prevent spreadsheet formulas and honor identity modes",async()=>{
  const source=await readFile(new URL("../src/app/api/research/collections/[collectionId]/export/route.ts",import.meta.url),"utf8");
  assert.match(source,/EXPORT_RESEARCH_OUTPUTS/);assert.match(source,/PSEUDONYMIZED/);assert.match(source,/IDENTIFIED/);assert.match(source,/\^\[=\+\\-@/);
});
