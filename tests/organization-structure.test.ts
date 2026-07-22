import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeStructureName,
  validateStructureName,
} from "../src/modules/organization/organization-structure";

test("organization structure names are trimmed and whitespace-normalized", () => {
  assert.equal(
    normalizeStructureName("  Environmental   Health & Safety  "),
    "Environmental Health & Safety",
  );
});

test("organization structure names reject empty and oversized values", () => {
  assert.throws(() => validateStructureName("   ", "Department name"));
  assert.throws(() => validateStructureName("x".repeat(101), "Site name"));
});
