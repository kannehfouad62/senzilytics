import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("questionnaire templates are published tenant-scoped snapshots",async()=>{
  const service=await readFile(new URL("../src/modules/research/research-questionnaire.service.ts",import.meta.url),"utf8");
  assert.match(service,/listResearchQuestionnaireTemplates/);
  assert.match(service,/status:ConfigurableFormVersionStatus\.PUBLISHED/);
  assert.match(service,/organizationId:input\.organizationId/);
  assert.match(service,/template\.fields\.map/);
  assert.match(service,/templateVersionId:template\?\.id/);
});

test("individual library questions remain tenant-bound draft copies with audit evidence",async()=>{
  const service=await readFile(new URL("../src/modules/forms/configurable-form.service.ts",import.meta.url),"utf8");
  assert.match(service,/copyResearchLibraryField/);
  assert.match(service,/organizationId:input\.organizationId,module:ConfigurableFormModule\.RESEARCH/);
  assert.match(service,/status:ConfigurableFormVersionStatus\.PUBLISHED/);
  assert.match(service,/status:ConfigurableFormVersionStatus\.DRAFT/);
  assert.match(service,/Research library question copied/);
  assert.match(service,/visibilityRule:Prisma\.JsonNull/);
});

test("template and library actions preserve questionnaire design authorization",async()=>{
  const actions=await readFile(new URL("../src/features/forms/actions.ts",import.meta.url),"utf8");
  const researchActions=await readFile(new URL("../src/features/research/actions.ts",import.meta.url),"utf8");
  const page=await readFile(new URL("../src/app/(platform)/research/projects/[id]/questionnaires/page.tsx",import.meta.url),"utf8");
  assert.match(actions,/requireFormDefinitionManagement\(definitionId\)/);
  assert.match(researchActions,/DESIGN_RESEARCH_QUESTIONNAIRES/);
  assert.match(page,/Reusable|templates=\{templates\}/);
  assert.doesNotMatch(actions,/organizationId\s*=\s*required\(data/);
});
