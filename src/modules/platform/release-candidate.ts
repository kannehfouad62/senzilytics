import {
  OrganizationStatus,
  PlatformReleaseCheckKey,
  PlatformReleaseCheckStatus,
  PlatformReleaseStatus,
  ProductionReadinessReviewStatus,
  TenantOnboardingStatus,
} from "@prisma/client";

export const platformReleaseCheckDefinitions = [
  {
    key: PlatformReleaseCheckKey.CODE_QUALITY,
    label: "Code quality and automated validation",
    description:
      "Record lint, automated test, TypeScript, production-build, and dependency-review evidence for the exact candidate commit.",
  },
  {
    key: PlatformReleaseCheckKey.DATABASE_MIGRATION,
    label: "Database migration safety",
    description:
      "Validate forward migration, retained tenant data, deployment order, compatibility, and the documented recovery procedure.",
  },
  {
    key: PlatformReleaseCheckKey.SECURITY_ACCESS,
    label: "Security and access controls",
    description:
      "Reconfirm authorization, platform-administrator restrictions, secret handling, protected jobs, exports, and private documents.",
  },
  {
    key: PlatformReleaseCheckKey.TENANT_ISOLATION,
    label: "Tenant isolation regression",
    description:
      "Exercise cross-tenant reads, writes, search, files, reporting, mobile synchronization, and configurable-form boundaries.",
  },
  {
    key: PlatformReleaseCheckKey.AUTHENTICATION_RECOVERY,
    label: "Authentication and recovery journeys",
    description:
      "Test credentials, Microsoft Entra ID or Okta where configured, logout, password reset, invitation expiry, and session revocation.",
  },
  {
    key: PlatformReleaseCheckKey.CRITICAL_WORKFLOWS,
    label: "Critical EHS workflow smoke tests",
    description:
      "Complete representative incident, CAPA, audit, inspection, compliance, training, workflow, notification, and reporting journeys.",
  },
  {
    key: PlatformReleaseCheckKey.MOBILE_COMPATIBILITY,
    label: "Native mobile compatibility",
    description:
      "Validate supported iOS and Android builds, login and logout, permissions, online and offline synchronization, files, and release policy.",
  },
  {
    key: PlatformReleaseCheckKey.OPERATIONS_RECOVERY,
    label: "Operations, monitoring, and rollback",
    description:
      "Verify runtime configuration, health endpoint, scheduled-job heartbeat, monitoring ownership, backup evidence, and rollback readiness.",
  },
] as const;

export type PlatformReleaseCheckState = {
  status: PlatformReleaseCheckStatus;
};

export type PlatformReleaseSubmissionState = {
  releaseNotes: string | null;
  riskSummary: string | null;
  rollbackPlan: string | null;
  checks: readonly PlatformReleaseCheckState[];
  pilotCount: number;
};

export function platformReleaseProgress(
  checks: readonly PlatformReleaseCheckState[],
) {
  if (!checks.length) return 0;
  const completed = checks.filter(
    (check) =>
      check.status === PlatformReleaseCheckStatus.PASS ||
      check.status === PlatformReleaseCheckStatus.NOT_APPLICABLE,
  ).length;
  return Math.round((completed / checks.length) * 100);
}

export function platformReleaseSubmissionIssues(
  release: PlatformReleaseSubmissionState,
) {
  const issues: string[] = [];
  if (release.checks.length !== platformReleaseCheckDefinitions.length) {
    issues.push("The governed release check set is incomplete.");
  }
  const notRun = release.checks.filter(
    (check) => check.status === PlatformReleaseCheckStatus.NOT_RUN,
  ).length;
  const failed = release.checks.filter(
    (check) => check.status === PlatformReleaseCheckStatus.FAIL,
  ).length;
  if (notRun) {
    issues.push(
      `${notRun} release check${notRun === 1 ? "" : "s"} remain unassessed.`,
    );
  }
  if (failed) {
    issues.push(
      `${failed} failed release check${failed === 1 ? "" : "s"} must be resolved.`,
    );
  }
  if ((release.releaseNotes?.trim().length ?? 0) < 40) {
    issues.push("Add release notes of at least 40 characters.");
  }
  if ((release.riskSummary?.trim().length ?? 0) < 30) {
    issues.push("Add a release risk summary of at least 30 characters.");
  }
  if ((release.rollbackPlan?.trim().length ?? 0) < 40) {
    issues.push("Add a rollback plan of at least 40 characters.");
  }
  if (release.pilotCount < 1) {
    issues.push("Assign at least one eligible pilot tenant.");
  }
  return issues;
}

export function assertPlatformReleaseTransition(
  current: PlatformReleaseStatus,
  next: PlatformReleaseStatus,
) {
  const allowed: Record<
    PlatformReleaseStatus,
    readonly PlatformReleaseStatus[]
  > = {
    [PlatformReleaseStatus.DRAFT]: [PlatformReleaseStatus.IN_REVIEW],
    [PlatformReleaseStatus.IN_REVIEW]: [
      PlatformReleaseStatus.APPROVED,
      PlatformReleaseStatus.REJECTED,
    ],
    [PlatformReleaseStatus.REJECTED]: [PlatformReleaseStatus.IN_REVIEW],
    [PlatformReleaseStatus.APPROVED]: [PlatformReleaseStatus.PILOT_ACTIVE],
    [PlatformReleaseStatus.PILOT_ACTIVE]: [
      PlatformReleaseStatus.RELEASED,
      PlatformReleaseStatus.ROLLED_BACK,
    ],
    [PlatformReleaseStatus.RELEASED]: [],
    [PlatformReleaseStatus.ROLLED_BACK]: [],
  };
  if (!allowed[current].includes(next)) {
    throw new Error(
      `Release candidate cannot move from ${current} to ${next}.`,
    );
  }
}

export function pilotTenantEligibilityIssues(input: {
  organizationStatus: OrganizationStatus;
  isDemo: boolean;
  onboardingStatus: TenantOnboardingStatus | null;
  readinessStatus: ProductionReadinessReviewStatus | null;
  requireLive: boolean;
}) {
  const issues: string[] = [];
  if (input.isDemo) issues.push("Demo tenants cannot be production pilots.");
  if (input.organizationStatus !== OrganizationStatus.ACTIVE) {
    issues.push("The tenant must be active.");
  }
  const allowedOnboarding: readonly TenantOnboardingStatus[] = input.requireLive
    ? [TenantOnboardingStatus.LIVE]
    : [
        TenantOnboardingStatus.READY_FOR_REVIEW,
        TenantOnboardingStatus.LIVE,
      ];
  if (
    !input.onboardingStatus ||
    !allowedOnboarding.includes(input.onboardingStatus)
  ) {
    issues.push(
      input.requireLive
        ? "The tenant must have completed go-live approval."
        : "The tenant must be ready for review or already live.",
    );
  }
  if (
    input.readinessStatus !== ProductionReadinessReviewStatus.APPROVED
  ) {
    issues.push("The tenant's latest Production Assurance review must be approved.");
  }
  return issues;
}

export function normalizePlatformReleaseVersion(value: string) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._+-]{0,39}$/.test(normalized)) {
    throw new Error(
      "Release version must contain 1–40 letters, numbers, periods, underscores, plus signs, or hyphens.",
    );
  }
  return normalized;
}

export function normalizePlatformReleaseCommit(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{7,64}$/.test(normalized)) {
    throw new Error("Commit SHA must contain 7–64 hexadecimal characters.");
  }
  return normalized;
}

export function safePlatformReleaseUrl(value: string, label: string) {
  if (value.trim().length > 1_000) {
    throw new Error(`${label} must be 1,000 characters or fewer.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error(`${label} must be a valid HTTPS URL.`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.hostname === "localhost"
  ) {
    throw new Error(`${label} must be a safe HTTPS URL.`);
  }
  return parsed.toString();
}

export function safePlatformReleaseEvidenceUrl(
  value: string | null | undefined,
) {
  const normalized = value?.trim() || null;
  if (!normalized) return null;
  if (normalized.length > 1_000) {
    throw new Error("Evidence reference must be 1,000 characters or fewer.");
  }
  if (normalized.startsWith("/")) {
    if (
      ![
        "/documents",
        "/activity",
        "/platform/",
        "/reports",
        "/integrations",
      ].some((prefix) => normalized.startsWith(prefix))
    ) {
      throw new Error("Use an approved internal evidence path.");
    }
    return normalized;
  }
  return safePlatformReleaseUrl(normalized, "Evidence reference");
}
