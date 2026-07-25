import {
  ProductionReadinessControlKey,
  ProductionReadinessControlStatus,
  ProductionReadinessReviewStatus,
} from "@prisma/client";

export const productionReadinessControlDefinitions = [
  {
    key: ProductionReadinessControlKey.TENANT_ISOLATION,
    label: "Tenant isolation",
    description:
      "Verify tenant-derived organization scope prevents cross-company reads, writes, exports, files, and search results.",
  },
  {
    key: ProductionReadinessControlKey.ROLE_ACCESS_REVIEW,
    label: "Role and access review",
    description:
      "Validate least-privilege navigation, page authorization, server actions, administrative roles, and offboarding.",
  },
  {
    key: ProductionReadinessControlKey.AUTHENTICATION_RECOVERY,
    label: "Authentication and recovery",
    description:
      "Test credentials, password reset, session invalidation, invitation expiry, and recovery ownership.",
  },
  {
    key: ProductionReadinessControlKey.SSO_VALIDATION,
    label: "SSO validation",
    description:
      "Validate Microsoft Entra ID or Okta callbacks, approved domains, account mapping, and safe rollback before enforcement.",
  },
  {
    key: ProductionReadinessControlKey.DOCUMENT_SECURITY,
    label: "Document security",
    description:
      "Confirm private storage, tenant ownership, file validation, download authorization, versioning, and retention controls.",
  },
  {
    key: ProductionReadinessControlKey.SCHEDULED_PROCESSING,
    label: "Scheduled processing",
    description:
      "Verify protected cron authorization, job heartbeat, retry behavior, duplicate prevention, and overdue processing.",
  },
  {
    key: ProductionReadinessControlKey.NOTIFICATION_DELIVERY,
    label: "Notification delivery",
    description:
      "Test in-app, email, and mobile push delivery, failure handling, recipient scope, and escalation content.",
  },
  {
    key: ProductionReadinessControlKey.DATA_QUALITY,
    label: "Data quality and reporting",
    description:
      "Verify required reference data, KPI provenance, empty-denominator handling, exports, and management-report reconciliation.",
  },
  {
    key: ProductionReadinessControlKey.BACKUP_RESTORE,
    label: "Backup and restore",
    description:
      "Record provider backup settings and evidence from a successful, time-bounded restore drill.",
  },
  {
    key: ProductionReadinessControlKey.DISASTER_RECOVERY,
    label: "Disaster recovery",
    description:
      "Confirm recovery owners, communications, dependencies, recovery objectives, and a tested service-restoration exercise.",
  },
  {
    key: ProductionReadinessControlKey.MOBILE_RELEASE,
    label: "Mobile release controls",
    description:
      "Validate signed iOS and Android builds, store ownership, release policy, minimum versions, offline encryption, and login/logout.",
  },
  {
    key: ProductionReadinessControlKey.SUPPORT_ESCALATION,
    label: "Support and escalation",
    description:
      "Confirm customer contacts, severity definitions, response ownership, monitoring triage, and incident communications.",
  },
] as const;

export type ProductionReadinessControlState = {
  status: ProductionReadinessControlStatus;
};

export function productionReadinessProgress(
  controls: readonly ProductionReadinessControlState[],
) {
  if (!controls.length) return 0;
  const points = controls.reduce((total, control) => {
    if (
      control.status === ProductionReadinessControlStatus.PASS ||
      control.status === ProductionReadinessControlStatus.NOT_APPLICABLE
    ) {
      return total + 1;
    }
    if (control.status === ProductionReadinessControlStatus.CONDITIONAL) {
      return total + 0.5;
    }
    return total;
  }, 0);
  return Math.round((points / controls.length) * 100);
}

export function productionReadinessSubmissionIssues(
  controls: readonly ProductionReadinessControlState[],
) {
  const issues: string[] = [];
  if (controls.length !== productionReadinessControlDefinitions.length) {
    issues.push("The governed control set is incomplete.");
  }
  const unassessed = controls.filter(
    (control) =>
      control.status === ProductionReadinessControlStatus.NOT_ASSESSED,
  ).length;
  const failed = controls.filter(
    (control) => control.status === ProductionReadinessControlStatus.FAIL,
  ).length;
  if (unassessed) issues.push(`${unassessed} control${unassessed === 1 ? "" : "s"} remain unassessed.`);
  if (failed) issues.push(`${failed} failed control${failed === 1 ? "" : "s"} must be remediated.`);
  return issues;
}

export function productionReadinessApprovalIssues(
  controls: readonly ProductionReadinessControlState[],
) {
  const issues = productionReadinessSubmissionIssues(controls);
  const conditional = controls.filter(
    (control) =>
      control.status === ProductionReadinessControlStatus.CONDITIONAL,
  ).length;
  if (conditional) {
    issues.push(
      `${conditional} conditional control${conditional === 1 ? "" : "s"} must pass or be formally marked not applicable.`,
    );
  }
  return issues;
}

export function assertProductionReadinessTransition(
  current: ProductionReadinessReviewStatus,
  next: ProductionReadinessReviewStatus,
) {
  const allowed: Record<
    ProductionReadinessReviewStatus,
    readonly ProductionReadinessReviewStatus[]
  > = {
    [ProductionReadinessReviewStatus.DRAFT]: [
      ProductionReadinessReviewStatus.IN_REVIEW,
    ],
    [ProductionReadinessReviewStatus.IN_REVIEW]: [
      ProductionReadinessReviewStatus.APPROVED,
      ProductionReadinessReviewStatus.REJECTED,
    ],
    [ProductionReadinessReviewStatus.REJECTED]: [
      ProductionReadinessReviewStatus.IN_REVIEW,
    ],
    [ProductionReadinessReviewStatus.APPROVED]: [],
  };
  if (!allowed[current].includes(next)) {
    throw new Error(
      `Production readiness cannot move from ${current} to ${next}.`,
    );
  }
}
