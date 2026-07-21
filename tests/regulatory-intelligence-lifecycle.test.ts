import assert from "node:assert/strict";
import test from "node:test";
import { RegulatoryChangeStatus, RegulatorySourceStatus } from "@prisma/client";
import { canTransitionRegulatoryChange, canTransitionRegulatorySource, isRegulatoryChangeTerminal } from "../src/modules/compliance/regulatory-intelligence-lifecycle";

test("regulatory changes follow governed human-review transitions", () => {
  assert.equal(canTransitionRegulatoryChange(RegulatoryChangeStatus.DETECTED, RegulatoryChangeStatus.UNDER_REVIEW), true);
  assert.equal(canTransitionRegulatoryChange(RegulatoryChangeStatus.DETECTED, RegulatoryChangeStatus.IMPLEMENTED), false);
  assert.equal(canTransitionRegulatoryChange(RegulatoryChangeStatus.ACTION_REQUIRED, RegulatoryChangeStatus.CLOSED), false);
  assert.equal(canTransitionRegulatoryChange(RegulatoryChangeStatus.IMPLEMENTED, RegulatoryChangeStatus.CLOSED), true);
});

test("closed changes and retired sources are terminal", () => {
  assert.equal(isRegulatoryChangeTerminal(RegulatoryChangeStatus.CLOSED), true);
  assert.equal(canTransitionRegulatoryChange(RegulatoryChangeStatus.CLOSED, RegulatoryChangeStatus.UNDER_REVIEW), false);
  assert.equal(canTransitionRegulatorySource(RegulatorySourceStatus.RETIRED, RegulatorySourceStatus.ACTIVE), false);
});
