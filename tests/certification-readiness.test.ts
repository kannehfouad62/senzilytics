import assert from "node:assert/strict";
import test from "node:test";
import { calculateCertificationReadiness, operationalControlScore, protocolFoundationScore } from "../src/modules/assurance/certification-readiness";

test("certification readiness uses transparent weighted dimensions", () => {
  const result = calculateCertificationReadiness({ protocolFoundation: 100, auditCoverage: 100, conformance: 90, evidenceAndClosure: 80, operationalControl: 70, managementReview: 100 });
  assert.equal(result.total, 91);
  assert.equal(result.band, "READY_FOR_FORMAL_REVIEW");
  assert.equal(result.dimensions.reduce((sum, row) => sum + row.weight, 0), 100);
});

test("readiness band never claims certification", () => {
  assert.equal(calculateCertificationReadiness({ protocolFoundation: 100, auditCoverage: 100, conformance: 100, evidenceAndClosure: 100, operationalControl: 100, managementReview: 100 }).band, "READY_FOR_FORMAL_REVIEW");
  assert.equal(calculateCertificationReadiness({ protocolFoundation: 60, auditCoverage: 60, conformance: 60, evidenceAndClosure: 60, operationalControl: 60, managementReview: 60 }).band, "NOT_READY");
});

test("protocol and operational calculations are deterministic", () => {
  assert.equal(protocolFoundationScore({ active: true, sections: 4, questions: 10, clauseMapped: 8 }), 90);
  assert.equal(protocolFoundationScore({ active: false, sections: 4, questions: 10, clauseMapped: 8 }), 0);
  assert.equal(operationalControlScore({ highRisks: 1, overdueCompliance: 2, overdueTraining: 3, overdueCapas: 1, failedCriticalControls: 1 }), 64);
});
