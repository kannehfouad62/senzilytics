import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRegisterQuery, registerPageCount, REGISTER_PAGE_SIZE } from "../src/core/register/register-query";

test("register queries are bounded and reject invalid page values", () => {
  assert.deepEqual(normalizeRegisterQuery({ search: "  pump  ", page: "3" }), { search: "pump", page: 3, skip: REGISTER_PAGE_SIZE * 2, take: REGISTER_PAGE_SIZE });
  assert.equal(normalizeRegisterQuery({ page: "-9" }).page, 1);
  assert.equal(normalizeRegisterQuery({ page: "1.5" }).page, 1);
  assert.equal(normalizeRegisterQuery({ search: "x".repeat(200) }).search.length, 120);
});

test("register page counts remain safe for empty and partial pages", () => {
  assert.equal(registerPageCount(0), 1);
  assert.equal(registerPageCount(50), 1);
  assert.equal(registerPageCount(51), 2);
});
