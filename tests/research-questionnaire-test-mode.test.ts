import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("draft questionnaire tests use production validation without creating submissions",async()=>{
  const runtime=await readFile(new URL("../src/modules/forms/runtime-form.service.ts",import.meta.url),"utf8");
  const actions=await readFile(new URL("../src/features/research/questionnaire-test-actions.ts",import.meta.url),"utf8");
  assert.match(runtime,/prepareDraftResearchQuestionnaireTest/);
  assert.match(runtime,/status:ConfigurableFormVersionStatus\.DRAFT/);
  assert.match(runtime,/deriveCalculatedValues/);
  assert.match(actions,/requireFormDefinitionManagement/);
  assert.match(actions,/persistedResponse:false/);
  assert.doesNotMatch(actions,/configurableFormSubmission\.create/);
  assert.doesNotMatch(actions,/createPreparedSubmissions/);
});

test("test mode is visibly isolated from publication and production collection",async()=>{
  const page=await readFile(new URL("../src/app/(platform)/form-studio/[id]/test/page.tsx",import.meta.url),"utf8");
  const form=await readFile(new URL("../src/features/research/questionnaire-test-form.tsx",import.meta.url),"utf8");
  assert.match(page,/ConfigurableFormModule\.RESEARCH/);
  assert.match(page,/ConfigurableFormVersionStatus\.DRAFT/);
  assert.match(form,/responses are never collected/);
  assert.match(form,/Answer values are not stored/);
  assert.doesNotMatch(form,/publishConfigurableForm/);
});
