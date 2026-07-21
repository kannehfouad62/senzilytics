import assert from "node:assert/strict";
import test from "node:test";
import { CriticalControlVerificationResult, RiskLevel, SifExposureCategory } from "@prisma/client";
import { inferSifExposureCategory, preventionPressureBand, scoreWeakSignal, weakSignalTrend } from "../src/modules/assurance/sif-intelligence";

test("SIF category inference uses transparent operational keywords", () => {
  assert.equal(inferSifExposureCategory("Forklift reversing toward a pedestrian crossing"), SifExposureCategory.MOBILE_EQUIPMENT);
  assert.equal(inferSifExposureCategory("Lockout tagout was not applied to stored energy"), SifExposureCategory.ENERGY_ISOLATION);
  assert.equal(inferSifExposureCategory("Hot work near flammable material"), SifExposureCategory.FIRE_EXPLOSION);
  assert.equal(inferSifExposureCategory("General housekeeping issue"), SifExposureCategory.OTHER);
});

test("weak-signal scoring increases for credible precursor and control evidence", () => {
  const baseline = scoreWeakSignal({ riskLevel: RiskLevel.HIGH });
  const precursor = scoreWeakSignal({ riskLevel: RiskLevel.HIGH, nearMiss: true, overdue: true, missingAction: true, controlResult: CriticalControlVerificationResult.FAILED });
  assert.equal(baseline.score, 4);
  assert.equal(baseline.confidence, "LOW");
  assert.equal(precursor.score, 14);
  assert.equal(precursor.confidence, "HIGH");
  assert.ok(precursor.reasons.includes("critical control failed verification"));
});

test("pressure and trend bands remain deterministic and explainable", () => {
  assert.equal(preventionPressureBand({ score: 8, count: 2, failedControls: 0 }), "WATCH");
  assert.equal(preventionPressureBand({ score: 10, count: 2, failedControls: 0 }), "ELEVATED");
  assert.equal(preventionPressureBand({ score: 4, count: 1, failedControls: 1 }), "CRITICAL");
  assert.equal(weakSignalTrend(5, 2), "RISING");
  assert.equal(weakSignalTrend(1, 4), "FALLING");
  assert.equal(weakSignalTrend(3, 3), "STABLE");
});
