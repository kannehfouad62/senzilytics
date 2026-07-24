import assert from "node:assert/strict";
import test from "node:test";
import { PermissionKey } from "@prisma/client";
import { mobileComplianceTrainingCapabilities } from "../src/modules/mobile/mobile-compliance-training.service";

test("native compliance and training capabilities preserve read/write separation", () => {
  assert.deepEqual(mobileComplianceTrainingCapabilities([]), {
    canViewCompliance: false,
    canManageCompliance: false,
    canViewTraining: false,
    canManageTraining: false,
  });

  assert.deepEqual(
    mobileComplianceTrainingCapabilities([
      PermissionKey.VIEW_COMPLIANCE,
      PermissionKey.VIEW_TRAINING,
    ]),
    {
      canViewCompliance: true,
      canManageCompliance: false,
      canViewTraining: true,
      canManageTraining: false,
    }
  );

  assert.deepEqual(
    mobileComplianceTrainingCapabilities([
      PermissionKey.VIEW_COMPLIANCE,
      PermissionKey.MANAGE_COMPLIANCE,
      PermissionKey.VIEW_TRAINING,
      PermissionKey.MANAGE_TRAINING,
    ]),
    {
      canViewCompliance: true,
      canManageCompliance: true,
      canViewTraining: true,
      canManageTraining: true,
    }
  );
});
