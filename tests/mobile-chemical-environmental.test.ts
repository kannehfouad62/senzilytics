import assert from "node:assert/strict";
import test from "node:test";
import { ChemicalApprovalStatus, PermissionKey } from "@prisma/client";
import {
  getChemicalNextStatuses,
  isChemicalTransitionAllowed,
} from "../src/modules/chemicals/chemical-lifecycle";
import { mobileChemicalEnvironmentalCapabilities } from "../src/modules/mobile/mobile-chemical-environmental.service";

test("mobile chemical and environmental capabilities preserve view and management boundaries", () => {
  assert.deepEqual(
    mobileChemicalEnvironmentalCapabilities([
      PermissionKey.VIEW_CHEMICALS,
      PermissionKey.MANAGE_ENVIRONMENTAL,
    ]),
    {
      canViewChemicals: true,
      canManageChemicals: false,
      canViewEnvironmental: false,
      canManageEnvironmental: true,
    }
  );
  assert.deepEqual(mobileChemicalEnvironmentalCapabilities([]), {
    canViewChemicals: false,
    canManageChemicals: false,
    canViewEnvironmental: false,
    canManageEnvironmental: false,
  });
});

test("chemical approval decisions use governed lifecycle transitions", () => {
  assert.deepEqual(
    getChemicalNextStatuses(ChemicalApprovalStatus.DRAFT),
    [ChemicalApprovalStatus.UNDER_REVIEW, ChemicalApprovalStatus.ARCHIVED]
  );
  assert.equal(
    isChemicalTransitionAllowed(
      ChemicalApprovalStatus.UNDER_REVIEW,
      ChemicalApprovalStatus.APPROVED
    ),
    true
  );
  assert.equal(
    isChemicalTransitionAllowed(
      ChemicalApprovalStatus.DRAFT,
      ChemicalApprovalStatus.APPROVED
    ),
    false
  );
  assert.deepEqual(
    getChemicalNextStatuses(ChemicalApprovalStatus.ARCHIVED),
    []
  );
});

test("chemical lifecycle arrays are defensive copies", () => {
  const statuses = getChemicalNextStatuses(ChemicalApprovalStatus.DRAFT);
  statuses.splice(0);
  assert.equal(
    getChemicalNextStatuses(ChemicalApprovalStatus.DRAFT).length,
    2
  );
});
