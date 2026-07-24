import assert from "node:assert/strict";
import test from "node:test";
import {
  MocStatus,
  PermissionKey,
  PermitToWorkStatus,
} from "@prisma/client";
import { mobileMocPermitCapabilities } from "../src/modules/mobile/mobile-moc-permit.service";
import { getMocNextStatuses } from "../src/modules/moc/moc.service";
import { getPermitToWorkNextStatuses } from "../src/modules/permits-to-work/permit-to-work-lifecycle";

test("mobile MOC and permit capabilities remain independently permission scoped", () => {
  assert.deepEqual(
    mobileMocPermitCapabilities([
      PermissionKey.VIEW_MOC,
      PermissionKey.MANAGE_PERMITS_TO_WORK,
    ]),
    {
      canViewMoc: true,
      canManageMoc: false,
      canViewPermits: false,
      canManagePermits: true,
    }
  );
});

test("mobile controlled-work lifecycle choices use the governed server transitions", () => {
  assert.deepEqual(getMocNextStatuses(MocStatus.IMPLEMENTATION), [
    MocStatus.VERIFICATION,
    MocStatus.CANCELLED,
  ]);
  assert.deepEqual(getMocNextStatuses(MocStatus.CLOSED), []);
  assert.deepEqual(getPermitToWorkNextStatuses(PermitToWorkStatus.ACTIVE), [
    PermitToWorkStatus.SUSPENDED,
    PermitToWorkStatus.CLOSED,
  ]);
  assert.deepEqual(getPermitToWorkNextStatuses(PermitToWorkStatus.CANCELLED), []);
});
