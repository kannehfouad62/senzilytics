import assert from "node:assert/strict";
import test from "node:test";
import {
  ExposureAssessmentStatus,
  PermissionKey,
  SurveillanceProgramStatus,
} from "@prisma/client";
import { getExposureAssessmentNextStatuses } from "../src/modules/industrial-hygiene/exposure-assessment-lifecycle";
import { mobileHygieneHealthCapabilities } from "../src/modules/mobile/mobile-hygiene-health.service";
import { getSurveillanceProgramNextStatuses } from "../src/modules/occupational-health/surveillance-program-lifecycle";

test("mobile hygiene and health capabilities preserve view and management boundaries", () => {
  assert.deepEqual(
    mobileHygieneHealthCapabilities([
      PermissionKey.VIEW_INDUSTRIAL_HYGIENE,
      PermissionKey.MANAGE_OCCUPATIONAL_HEALTH,
    ]),
    {
      canViewIndustrialHygiene: true,
      canManageIndustrialHygiene: false,
      canViewOccupationalHealth: false,
      canManageOccupationalHealth: true,
    }
  );
  assert.deepEqual(mobileHygieneHealthCapabilities([]), {
    canViewIndustrialHygiene: false,
    canManageIndustrialHygiene: false,
    canViewOccupationalHealth: false,
    canManageOccupationalHealth: false,
  });
});

test("native exposure and surveillance decisions use governed lifecycle transitions", () => {
  assert.deepEqual(
    getExposureAssessmentNextStatuses(ExposureAssessmentStatus.IN_PROGRESS),
    [
      ExposureAssessmentStatus.UNDER_REVIEW,
      ExposureAssessmentStatus.CANCELLED,
    ]
  );
  assert.deepEqual(
    getSurveillanceProgramNextStatuses(SurveillanceProgramStatus.ACTIVE),
    [
      SurveillanceProgramStatus.PAUSED,
      SurveillanceProgramStatus.ARCHIVED,
    ]
  );
  assert.deepEqual(
    getSurveillanceProgramNextStatuses(SurveillanceProgramStatus.ARCHIVED),
    []
  );
});

test("hygiene and health lifecycle arrays are defensive copies", () => {
  const assessments = getExposureAssessmentNextStatuses(
    ExposureAssessmentStatus.DRAFT
  );
  assessments.splice(0);
  assert.equal(
    getExposureAssessmentNextStatuses(ExposureAssessmentStatus.DRAFT).length,
    2
  );

  const programs = getSurveillanceProgramNextStatuses(
    SurveillanceProgramStatus.ACTIVE
  );
  programs.splice(0);
  assert.equal(
    getSurveillanceProgramNextStatuses(SurveillanceProgramStatus.ACTIVE)
      .length,
    2
  );
});
