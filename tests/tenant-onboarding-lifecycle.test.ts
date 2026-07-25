import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveTenantOnboardingStatus,
  tenantOnboardingProgress,
  tenantOnboardingStepDefinitions,
} from "../src/modules/platform/tenant-onboarding-lifecycle";
import {
  TenantOnboardingStatus,
  TenantOnboardingStepKey,
  TenantOnboardingStepStatus,
} from "@prisma/client";

const steps = (status: TenantOnboardingStepStatus) =>
  tenantOnboardingStepDefinitions.map((step) => ({ key: step.key, status }));

test("an untouched onboarding plan remains not started", () => {
  assert.equal(
    deriveTenantOnboardingStatus(
      steps(TenantOnboardingStepStatus.NOT_STARTED),
    ),
    TenantOnboardingStatus.NOT_STARTED,
  );
});

test("a blocker takes precedence over implementation progress", () => {
  const plan = steps(TenantOnboardingStepStatus.IN_PROGRESS);
  plan[2] = {
    key: TenantOnboardingStepKey.SSO_CONFIGURATION,
    status: TenantOnboardingStepStatus.BLOCKED,
  };
  assert.equal(
    deriveTenantOnboardingStatus(plan),
    TenantOnboardingStatus.BLOCKED,
  );
});

test("completed prerequisites require platform go-live approval", () => {
  const plan = steps(TenantOnboardingStepStatus.COMPLETED);
  plan[plan.length - 1] = {
    key: TenantOnboardingStepKey.GO_LIVE_APPROVAL,
    status: TenantOnboardingStepStatus.NOT_STARTED,
  };
  assert.equal(
    deriveTenantOnboardingStatus(plan),
    TenantOnboardingStatus.READY_FOR_REVIEW,
  );
  assert.equal(tenantOnboardingProgress(plan), 89);
});

test("completed go-live approval moves the tenant live", () => {
  assert.equal(
    deriveTenantOnboardingStatus(
      steps(TenantOnboardingStepStatus.COMPLETED),
    ),
    TenantOnboardingStatus.LIVE,
  );
});
