import assert from "node:assert/strict";
import test from "node:test";
import { PermissionKey } from "@prisma/client";
import { mobileRiskCapabilities } from "../src/modules/mobile/mobile-risk-field.service";

test("native field risk separates authorized visibility from management", () => {
  assert.deepEqual(mobileRiskCapabilities([]), {
    canView: false,
    canManage: false,
  });
  assert.deepEqual(
    mobileRiskCapabilities([PermissionKey.VIEW_RISKS]),
    {
      canView: true,
      canManage: false,
    }
  );
  assert.deepEqual(
    mobileRiskCapabilities([
      PermissionKey.VIEW_RISKS,
      PermissionKey.MANAGE_RISKS,
    ]),
    {
      canView: true,
      canManage: true,
    }
  );
});
