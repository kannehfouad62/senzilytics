import assert from "node:assert/strict";
import test from "node:test";
import { configurableFormDeletionBlocker } from "../src/modules/forms/form-definition-lifecycle";

test("unused configurable forms may be permanently deleted", () => {
  assert.equal(configurableFormDeletionBlocker(0), null);
});

test("historical submissions block destructive form deletion", () => {
  assert.match(
    configurableFormDeletionBlocker(1) ?? "",
    /cannot be permanently deleted[\s\S]*Unassign it instead/i,
  );
  assert.match(
    configurableFormDeletionBlocker(4) ?? "",
    /4 historical submissions/i,
  );
});

test("invalid submission counts fail closed", () => {
  assert.match(configurableFormDeletionBlocker(-1) ?? "", /invalid/i);
  assert.match(configurableFormDeletionBlocker(1.5) ?? "", /invalid/i);
});
