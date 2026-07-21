import assert from "node:assert/strict";
import test from "node:test";
import { PermitToWorkStatus } from "@prisma/client";
import { getPermitToWorkNextStatuses, isPermitToWorkTransitionAllowed } from "../src/modules/permits-to-work/permit-to-work-lifecycle";

test("permit lifecycle allows governed progression and operational suspension", () => {
  assert.equal(isPermitToWorkTransitionAllowed(PermitToWorkStatus.DRAFT, PermitToWorkStatus.PENDING_APPROVAL), true);
  assert.equal(isPermitToWorkTransitionAllowed(PermitToWorkStatus.PENDING_APPROVAL, PermitToWorkStatus.APPROVED), true);
  assert.equal(isPermitToWorkTransitionAllowed(PermitToWorkStatus.APPROVED, PermitToWorkStatus.ACTIVE), true);
  assert.equal(isPermitToWorkTransitionAllowed(PermitToWorkStatus.ACTIVE, PermitToWorkStatus.SUSPENDED), true);
  assert.equal(isPermitToWorkTransitionAllowed(PermitToWorkStatus.SUSPENDED, PermitToWorkStatus.ACTIVE), true);
  assert.equal(isPermitToWorkTransitionAllowed(PermitToWorkStatus.ACTIVE, PermitToWorkStatus.CLOSED), true);
});

test("permit lifecycle blocks bypasses and terminal-state changes", () => {
  assert.equal(isPermitToWorkTransitionAllowed(PermitToWorkStatus.DRAFT, PermitToWorkStatus.ACTIVE), false);
  assert.equal(isPermitToWorkTransitionAllowed(PermitToWorkStatus.PENDING_APPROVAL, PermitToWorkStatus.ACTIVE), false);
  assert.deepEqual(getPermitToWorkNextStatuses(PermitToWorkStatus.CLOSED), []);
  assert.deepEqual(getPermitToWorkNextStatuses(PermitToWorkStatus.REJECTED), [PermitToWorkStatus.DRAFT]);
});
