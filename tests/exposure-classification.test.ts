import assert from "node:assert/strict";
import test from "node:test";
import { ExposureResultClassification } from "@prisma/client";
import { classifyExposureResult, exposureRatio } from "../src/modules/industrial-hygiene/exposure-classification";

test("exposure results are classified against detection, action and occupational limits", () => {
  assert.equal(classifyExposureResult({ resultValue: null, reportingLimit: 0.1, actionLevel: 0.5, occupationalLimit: 1 }), ExposureResultClassification.NOT_EVALUATED);
  assert.equal(classifyExposureResult({ resultValue: 0.05, reportingLimit: 0.1, actionLevel: 0.5, occupationalLimit: 1 }), ExposureResultClassification.BELOW_DETECTION);
  assert.equal(classifyExposureResult({ resultValue: 0.4, reportingLimit: 0.1, actionLevel: 0.5, occupationalLimit: 1 }), ExposureResultClassification.BELOW_ACTION_LEVEL);
  assert.equal(classifyExposureResult({ resultValue: 0.5, reportingLimit: 0.1, actionLevel: 0.5, occupationalLimit: 1 }), ExposureResultClassification.AT_OR_ABOVE_ACTION_LEVEL);
  assert.equal(classifyExposureResult({ resultValue: 1.01, reportingLimit: 0.1, actionLevel: 0.5, occupationalLimit: 1 }), ExposureResultClassification.ABOVE_LIMIT);
});

test("exposure ratio is stable and rejects unusable limits", () => {
  assert.equal(exposureRatio(88, 85), 1.035);
  assert.equal(exposureRatio(1, 0), null);
  assert.equal(exposureRatio(null, 1), null);
});
