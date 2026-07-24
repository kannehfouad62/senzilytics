import assert from "node:assert/strict";
import test from "node:test";
import {
  EsgDisclosureStatus,
  EsgInitiativeStatus,
  PermissionKey,
} from "@prisma/client";
import {
  getEsgDisclosureNextStatuses,
  getEsgInitiativeNextStatuses,
  isEsgDisclosureTransitionAllowed,
  isEsgInitiativeTransitionAllowed,
} from "../src/modules/esg/esg-lifecycle";
import { mobileEsgCapabilities } from "../src/modules/mobile/mobile-esg.service";

test("mobile ESG permissions preserve view and management boundaries", () => {
  assert.deepEqual(mobileEsgCapabilities([PermissionKey.VIEW_ESG]), {
    canView: true,
    canManage: false,
  });
  assert.deepEqual(mobileEsgCapabilities([PermissionKey.MANAGE_ESG]), {
    canView: false,
    canManage: true,
  });
  assert.deepEqual(
    mobileEsgCapabilities([
      PermissionKey.VIEW_ESG,
      PermissionKey.MANAGE_ESG,
    ]),
    {
      canView: true,
      canManage: true,
    }
  );
});

test("ESG disclosures require governed review before approval", () => {
  assert.deepEqual(
    getEsgDisclosureNextStatuses(EsgDisclosureStatus.DATA_COLLECTION),
    [EsgDisclosureStatus.UNDER_REVIEW, EsgDisclosureStatus.ARCHIVED]
  );
  assert.equal(
    isEsgDisclosureTransitionAllowed(
      EsgDisclosureStatus.DATA_COLLECTION,
      EsgDisclosureStatus.APPROVED
    ),
    false
  );
  assert.equal(
    isEsgDisclosureTransitionAllowed(
      EsgDisclosureStatus.UNDER_REVIEW,
      EsgDisclosureStatus.APPROVED
    ),
    true
  );
  assert.deepEqual(
    getEsgDisclosureNextStatuses(EsgDisclosureStatus.PUBLISHED),
    [EsgDisclosureStatus.ARCHIVED]
  );
});

test("ESG initiatives use controlled status transitions and defensive arrays", () => {
  assert.deepEqual(
    getEsgInitiativeNextStatuses(EsgInitiativeStatus.PLANNED),
    [EsgInitiativeStatus.IN_PROGRESS, EsgInitiativeStatus.CANCELLED]
  );
  assert.equal(
    isEsgInitiativeTransitionAllowed(
      EsgInitiativeStatus.ON_HOLD,
      EsgInitiativeStatus.IN_PROGRESS
    ),
    true
  );
  assert.equal(
    isEsgInitiativeTransitionAllowed(
      EsgInitiativeStatus.COMPLETED,
      EsgInitiativeStatus.IN_PROGRESS
    ),
    false
  );
  const statuses = getEsgInitiativeNextStatuses(
    EsgInitiativeStatus.IN_PROGRESS
  );
  statuses.splice(0);
  assert.equal(
    getEsgInitiativeNextStatuses(EsgInitiativeStatus.IN_PROGRESS).length,
    3
  );
});
