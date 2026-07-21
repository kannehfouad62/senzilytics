import assert from "node:assert/strict";
import test from "node:test";
import { ExposureAssessmentStatus } from "@prisma/client";
import { getExposureAssessmentNextStatuses, isExposureAssessmentTransitionAllowed } from "../src/modules/industrial-hygiene/exposure-assessment-lifecycle";

test("exposure assessment lifecycle permits governed forward transitions", () => {
  assert.deepEqual(getExposureAssessmentNextStatuses(ExposureAssessmentStatus.DRAFT), [ExposureAssessmentStatus.PLANNED, ExposureAssessmentStatus.CANCELLED]);
  assert.equal(isExposureAssessmentTransitionAllowed(ExposureAssessmentStatus.PLANNED, ExposureAssessmentStatus.IN_PROGRESS), true);
  assert.equal(isExposureAssessmentTransitionAllowed(ExposureAssessmentStatus.UNDER_REVIEW, ExposureAssessmentStatus.COMPLETED), true);
});

test("terminal exposure assessments cannot be reopened", () => {
  assert.deepEqual(getExposureAssessmentNextStatuses(ExposureAssessmentStatus.COMPLETED), []);
  assert.equal(isExposureAssessmentTransitionAllowed(ExposureAssessmentStatus.COMPLETED, ExposureAssessmentStatus.IN_PROGRESS), false);
});
