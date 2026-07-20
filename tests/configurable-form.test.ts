import assert from "node:assert/strict";import test from "node:test";import { parseOptionList,slugifyFormName } from "../src/modules/forms/configurable-form.service";
test("form slugs are stable and URL safe",()=>{assert.equal(slugifyFormName("  Incident Investigation / Europe  "),"incident-investigation-europe")});
test("select options are trimmed, deduplicated and accept lines or commas",()=>{assert.deepEqual(parseOptionList("Pass\nFail, Not applicable\nPass"),["Pass","Fail","Not applicable"])});
