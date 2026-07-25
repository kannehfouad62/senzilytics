import {
  TenantOnboardingStatus,
  TenantOnboardingStepKey,
  TenantOnboardingStepStatus,
} from "@prisma/client";

export const tenantOnboardingStepDefinitions = [
  {
    key: TenantOnboardingStepKey.DOMAIN_AND_AUTH,
    label: "Domain & authentication",
    description: "Confirm the tenant is active and its approved email domain is registered.",
  },
  {
    key: TenantOnboardingStepKey.ORGANIZATION_STRUCTURE,
    label: "Organization structure",
    description: "Configure at least one site and one department.",
  },
  {
    key: TenantOnboardingStepKey.SSO_CONFIGURATION,
    label: "SSO configuration",
    description: "Enable Microsoft Entra ID or Okta, or document an approved waiver.",
  },
  {
    key: TenantOnboardingStepKey.USER_ACCESS,
    label: "User access",
    description: "Activate at least one tenant Organization Administrator.",
  },
  {
    key: TenantOnboardingStepKey.GOVERNANCE_FOUNDATION,
    label: "Governance foundation",
    description: "Confirm owners, responsibilities, policies, and escalation paths.",
  },
  {
    key: TenantOnboardingStepKey.DATA_FOUNDATION,
    label: "Data foundation",
    description: "Validate reference data, imports, retention expectations, and initial records.",
  },
  {
    key: TenantOnboardingStepKey.WORKFLOW_VALIDATION,
    label: "Workflow validation",
    description: "Complete tenant acceptance testing for assigned workflows and notifications.",
  },
  {
    key: TenantOnboardingStepKey.MOBILE_READINESS,
    label: "Mobile readiness",
    description: "Validate Premium mobile access, or record why mobile is not applicable.",
  },
  {
    key: TenantOnboardingStepKey.GO_LIVE_APPROVAL,
    label: "Go-live approval",
    description: "Senzilytics platform approval after every prerequisite is complete.",
  },
] as const;

export type OnboardingLifecycleStep = {
  key: TenantOnboardingStepKey;
  status: TenantOnboardingStepStatus;
};

const completedStepStatuses: readonly TenantOnboardingStepStatus[] = [
  TenantOnboardingStepStatus.COMPLETED,
  TenantOnboardingStepStatus.WAIVED,
];

export function deriveTenantOnboardingStatus(
  steps: readonly OnboardingLifecycleStep[],
): TenantOnboardingStatus {
  if (
    steps.length === 0 ||
    steps.every((step) => step.status === TenantOnboardingStepStatus.NOT_STARTED)
  ) {
    return TenantOnboardingStatus.NOT_STARTED;
  }
  if (steps.some((step) => step.status === TenantOnboardingStepStatus.BLOCKED)) {
    return TenantOnboardingStatus.BLOCKED;
  }

  const goLive = steps.find(
    (step) => step.key === TenantOnboardingStepKey.GO_LIVE_APPROVAL,
  );
  if (goLive?.status === TenantOnboardingStepStatus.COMPLETED) {
    return TenantOnboardingStatus.LIVE;
  }

  const prerequisites = steps.filter(
    (step) => step.key !== TenantOnboardingStepKey.GO_LIVE_APPROVAL,
  );
  if (
    prerequisites.length > 0 &&
    prerequisites.every((step) =>
      completedStepStatuses.includes(step.status),
    )
  ) {
    return TenantOnboardingStatus.READY_FOR_REVIEW;
  }
  return TenantOnboardingStatus.IN_PROGRESS;
}

export function tenantOnboardingProgress(
  steps: readonly OnboardingLifecycleStep[],
) {
  if (steps.length === 0) return 0;
  const complete = steps.filter((step) =>
    completedStepStatuses.includes(step.status),
  ).length;
  return Math.round((complete / steps.length) * 100);
}

export function isOnboardingStepComplete(status: TenantOnboardingStepStatus) {
  return completedStepStatuses.includes(status);
}
