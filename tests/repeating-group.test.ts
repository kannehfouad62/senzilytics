import assert from "node:assert/strict";
import test from "node:test";
import { parseRepeatingGroupColumns, repeatingGroupConfig, validateRepeatingGroup } from "../src/modules/forms/repeating-group.service";

test("roster configuration preserves stable columns, choices and conditional fields", () => {
  const columns=parseRepeatingGroupColumns("name | Member name | SHORT_TEXT | required\nrelationship | Relationship | SINGLE_SELECT | required | Head;Child;Other\nother | Specify | SHORT_TEXT | required | | relationship=Other");
  const config=repeatingGroupConfig({minRows:1,maxRows:5,columns});
  assert.equal(config?.columns.length,3);
  assert.deepEqual(config?.columns[1].options,["Head","Child","Other"]);
  assert.deepEqual(config?.columns[2].showWhen,{columnKey:"relationship",value:"Other"});
});

test("roster answers enforce bounds, stable row identifiers and visible required columns", () => {
  const columns=parseRepeatingGroupColumns("name | Member name | SHORT_TEXT | required\nrelationship | Relationship | SINGLE_SELECT | required | Head;Other\nother | Specify | SHORT_TEXT | required | | relationship=Other");
  const config={minRows:1,maxRows:3,columns};
  assert.deepEqual(validateRepeatingGroup([{id:"member_001",values:{name:"Aminata",relationship:"Head"}}],config,"Household"),[{id:"member_001",values:{name:"Aminata",relationship:"Head"}}]);
  assert.throws(()=>validateRepeatingGroup([{id:"member_001",values:{name:"Aminata",relationship:"Other"}}],config,"Household"),/Specify is required/);
  assert.throws(()=>validateRepeatingGroup([{id:"same_row",values:{name:"A",relationship:"Head"}},{id:"same_row",values:{name:"B",relationship:"Head"}}],config,"Household"),/duplicate row identifier/);
});
