import assert from "node:assert/strict";
import test from "node:test";
import {
  BehaviorProgramStatus,
  PermissionKey,
} from "@prisma/client";
import { getBehaviorProgramNextStatuses } from "../src/modules/behavior-safety/behavior-safety-lifecycle";
import { mobileBehaviorAssuranceCapabilities } from "../src/modules/mobile/mobile-behavior-assurance.service";

test("mobile behavior and assurance capabilities separate visibility from governed writes", () => {
  const viewer = mobileBehaviorAssuranceCapabilities([
    PermissionKey.VIEW_BEHAVIOR_SAFETY,
    PermissionKey.VIEW_SIF_INTELLIGENCE,
    PermissionKey.VIEW_CERTIFICATION_READINESS,
  ]);

  assert.deepEqual(viewer, {
    canViewBehavior: true,
    canRecordBehavior: false,
    canManageBehavior: false,
    canViewSif: true,
    canManageCriticalControls: false,
    canViewCertification: true,
    canManageCertification: false,
  });

  const operator = mobileBehaviorAssuranceCapabilities([
    PermissionKey.VIEW_BEHAVIOR_SAFETY,
    PermissionKey.RECORD_BEHAVIOR_COACHING,
    PermissionKey.MANAGE_BEHAVIOR_SAFETY,
    PermissionKey.VIEW_SIF_INTELLIGENCE,
    PermissionKey.MANAGE_CRITICAL_CONTROLS,
    PermissionKey.VIEW_CERTIFICATION_READINESS,
    PermissionKey.MANAGE_CERTIFICATION_READINESS,
  ]);

  assert.equal(operator.canRecordBehavior, true);
  assert.equal(operator.canManageBehavior, true);
  assert.equal(operator.canManageCriticalControls, true);
  assert.equal(operator.canManageCertification, true);
});

test("mobile behavior program actions expose only controlled next statuses", () => {
  const draftTransitions = getBehaviorProgramNextStatuses(
    BehaviorProgramStatus.DRAFT
  );
  assert.deepEqual(
    draftTransitions,
    [BehaviorProgramStatus.ACTIVE, BehaviorProgramStatus.ARCHIVED]
  );
  draftTransitions.length = 0;
  assert.deepEqual(
    getBehaviorProgramNextStatuses(BehaviorProgramStatus.DRAFT),
    [BehaviorProgramStatus.ACTIVE, BehaviorProgramStatus.ARCHIVED]
  );
  assert.deepEqual(
    getBehaviorProgramNextStatuses(BehaviorProgramStatus.ACTIVE),
    [BehaviorProgramStatus.PAUSED, BehaviorProgramStatus.ARCHIVED]
  );
  assert.deepEqual(
    getBehaviorProgramNextStatuses(BehaviorProgramStatus.ARCHIVED),
    []
  );
});
