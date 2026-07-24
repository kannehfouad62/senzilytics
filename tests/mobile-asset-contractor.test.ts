import assert from "node:assert/strict";
import test from "node:test";
import {
  AssetDefectStatus,
  AssetMaintenanceStatus,
  AssetStatus,
  PermissionKey,
} from "@prisma/client";
import {
  getAssetNextStatuses,
  getMaintenanceNextStatuses,
} from "../src/modules/assets/asset-lifecycle";
import { getAssetDefectNextStatuses } from "../src/modules/assets/asset.service";
import { mobileAssetContractorCapabilities } from "../src/modules/mobile/mobile-asset-contractor.service";

test("mobile asset and contractor capabilities preserve view and management boundaries", () => {
  assert.deepEqual(
    mobileAssetContractorCapabilities([
      PermissionKey.VIEW_ASSETS,
      PermissionKey.MANAGE_CONTRACTORS,
    ]),
    {
      canViewAssets: true,
      canManageAssets: false,
      canViewContractors: false,
      canManageContractors: true,
    }
  );
  assert.deepEqual(mobileAssetContractorCapabilities([]), {
    canViewAssets: false,
    canManageAssets: false,
    canViewContractors: false,
    canManageContractors: false,
  });
});

test("mobile asset decisions expose only governed lifecycle transitions", () => {
  assert.deepEqual(getAssetNextStatuses(AssetStatus.RETIRED), []);
  assert.deepEqual(getAssetNextStatuses(AssetStatus.ACTIVE), [
    AssetStatus.OUT_OF_SERVICE,
    AssetStatus.UNDER_MAINTENANCE,
    AssetStatus.QUARANTINED,
    AssetStatus.RETIRED,
  ]);
  assert.deepEqual(
    getMaintenanceNextStatuses(AssetMaintenanceStatus.IN_PROGRESS),
    [AssetMaintenanceStatus.COMPLETED, AssetMaintenanceStatus.CANCELLED]
  );
  assert.deepEqual(
    getAssetDefectNextStatuses(AssetDefectStatus.REPAIRED),
    [AssetDefectStatus.VERIFIED]
  );
  assert.deepEqual(
    getAssetDefectNextStatuses(AssetDefectStatus.VERIFIED),
    [AssetDefectStatus.CLOSED]
  );
});

test("asset transition arrays are defensive copies for mobile consumers", () => {
  const statuses = getAssetNextStatuses(AssetStatus.ACTIVE);
  statuses.splice(0);
  assert.equal(getAssetNextStatuses(AssetStatus.ACTIVE).length, 4);

  const defects = getAssetDefectNextStatuses(AssetDefectStatus.OPEN);
  defects.splice(0);
  assert.equal(getAssetDefectNextStatuses(AssetDefectStatus.OPEN).length, 3);
});
