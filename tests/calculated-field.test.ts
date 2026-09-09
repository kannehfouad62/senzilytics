import assert from "node:assert/strict";
import test from "node:test";
import { ConfigurableFieldType } from "@prisma/client";
import { calculateConfiguredField, calculatedFieldConfig, parseCalculationSources, parseScoreBands } from "../src/modules/forms/calculated-field.service";
import { deriveCalculatedValues } from "../src/modules/forms/runtime-form.service";

test("calculated fields support governed weighted scores and interpretation bands", () => {
  const config = calculatedFieldConfig({ operation: "WEIGHTED_SUM", sources: parseCalculationSources("quality | 0.6\ntimeliness | 0.4"), decimalPlaces: 1, bands: parseScoreBands("0 | 49.9 | Needs improvement\n50 | 79.9 | Satisfactory\n80 | 100 | Excellent") });
  assert.ok(config);
  assert.deepEqual(calculateConfiguredField(config, new Map([["quality", 90], ["timeliness", 70]])), { value: 82, band: "Excellent" });
});

test("server derivation overwrites a submitted calculated value", () => {
  const fields = [
    { id: "a", key: "quality", label: "Quality", fieldType: ConfigurableFieldType.NUMBER, isRequired: true, options: null, visibilityRule: null },
    { id: "b", key: "score", label: "Score", fieldType: ConfigurableFieldType.CALCULATED, isRequired: true, options: { operation: "SUM", sources: [{ fieldKey: "quality", weight: 1 }], decimalPlaces: 0, bands: [] }, visibilityRule: null },
  ];
  const values = new Map<string, unknown>([["quality", 42], ["score", 999]]);
  deriveCalculatedValues(fields, values);
  assert.equal(values.get("score"), 42);
});

test("calculation sources and score bands reject unsafe configurations", () => {
  assert.throws(() => parseCalculationSources("quality | not-a-number"));
  assert.throws(() => parseScoreBands("0 | 60 | Low\n50 | 100 | High"), /must not overlap/);
});

test("an unanswered source never becomes a misleading zero score", () => {
  const config = calculatedFieldConfig({ operation: "SUM", sources: [{ fieldKey: "quality", weight: 1 }], decimalPlaces: 0, bands: [] });
  assert.ok(config);
  assert.equal(calculateConfiguredField(config, new Map([["quality", ""]])), null);
});
