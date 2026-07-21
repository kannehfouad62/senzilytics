import assert from "node:assert/strict";
import test from "node:test";
import { AssetMaintenanceStatus, AssetStatus } from "@prisma/client";
import { canTransitionAssetStatus, canTransitionMaintenanceStatus, nextAssetDueDate } from "../src/modules/assets/asset-lifecycle";

test("asset lifecycle supports controlled removal and return to service",()=>{assert.equal(canTransitionAssetStatus(AssetStatus.ACTIVE,AssetStatus.OUT_OF_SERVICE),true);assert.equal(canTransitionAssetStatus(AssetStatus.OUT_OF_SERVICE,AssetStatus.ACTIVE),true);assert.equal(canTransitionAssetStatus(AssetStatus.RETIRED,AssetStatus.ACTIVE),false)});
test("completed maintenance is terminal",()=>{assert.equal(canTransitionMaintenanceStatus(AssetMaintenanceStatus.SCHEDULED,AssetMaintenanceStatus.COMPLETED),true);assert.equal(canTransitionMaintenanceStatus(AssetMaintenanceStatus.COMPLETED,AssetMaintenanceStatus.IN_PROGRESS),false)});
test("asset recurrence uses deterministic day intervals",()=>{assert.equal(nextAssetDueDate(new Date("2026-07-20T00:00:00.000Z"),30).toISOString(),"2026-08-19T00:00:00.000Z");assert.throws(()=>nextAssetDueDate(new Date(),0))});
