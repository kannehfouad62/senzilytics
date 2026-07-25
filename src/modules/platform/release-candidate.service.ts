import { prisma } from "@/lib/prisma";
import {
  assertPlatformReleaseTransition,
  normalizePlatformReleaseCommit,
  normalizePlatformReleaseVersion,
  pilotTenantEligibilityIssues,
  platformReleaseCheckDefinitions,
  platformReleaseProgress,
  platformReleaseSubmissionIssues,
  safePlatformReleaseEvidenceUrl,
  safePlatformReleaseUrl,
} from "@/modules/platform/release-candidate";
import {
  ActivityAction,
  PlatformReleaseCheckStatus,
  PlatformReleasePilotStatus,
  PlatformReleaseStatus,
} from "@prisma/client";

type PlatformActor = {
  id: string;
  organizationId: string | null;
};

export async function createPlatformReleaseCandidate(
  input: {
    version: string;
    commitSha: string;
    deploymentUrl: string;
    targetCertificationAt: Date | null;
  },
  actor: PlatformActor,
) {
  const organizationId = requireActorOrganization(actor);
  const version = normalizePlatformReleaseVersion(input.version);
  const commitSha = normalizePlatformReleaseCommit(input.commitSha);
  const deploymentUrl = safePlatformReleaseUrl(
    input.deploymentUrl,
    "Deployment URL",
  );

  return prisma.$transaction(async (tx) => {
    const release = await tx.platformRelease.create({
      data: {
        version,
        commitSha,
        deploymentUrl,
        targetCertificationAt: input.targetCertificationAt,
        createdById: actor.id,
        checks: {
          create: platformReleaseCheckDefinitions.map((definition) => ({
            key: definition.key,
            updatedById: actor.id,
          })),
        },
      },
      select: { id: true, version: true },
    });
    await tx.activityLog.create({
      data: {
        organizationId,
        userId: actor.id,
        action: ActivityAction.CREATE,
        entityType: "PlatformRelease",
        entityId: release.id,
        title: `Release candidate ${release.version} created`,
        metadata: { commitSha, deploymentUrl },
      },
    });
    return release;
  });
}

export async function updatePlatformReleaseMetadata(
  input: {
    releaseId: string;
    deploymentUrl: string;
    targetCertificationAt: Date | null;
    releaseNotes: string | null;
    riskSummary: string | null;
    rollbackPlan: string | null;
  },
  actor: PlatformActor,
) {
  const organizationId = requireActorOrganization(actor);
  const release = await requireEditableRelease(input.releaseId);
  const deploymentUrl = safePlatformReleaseUrl(
    input.deploymentUrl,
    "Deployment URL",
  );
  const releaseNotes = bounded(input.releaseNotes, 8_000, "Release notes");
  const riskSummary = bounded(input.riskSummary, 4_000, "Risk summary");
  const rollbackPlan = bounded(input.rollbackPlan, 6_000, "Rollback plan");

  await prisma.$transaction([
    prisma.platformRelease.update({
      where: { id: release.id },
      data: {
        deploymentUrl,
        targetCertificationAt: input.targetCertificationAt,
        releaseNotes,
        riskSummary,
        rollbackPlan,
        ...(release.status === PlatformReleaseStatus.REJECTED
          ? resetRejectedRelease()
          : {}),
      },
    }),
    prisma.activityLog.create({
      data: {
        organizationId,
        userId: actor.id,
        action: ActivityAction.UPDATE,
        entityType: "PlatformRelease",
        entityId: release.id,
        title: `Release candidate ${release.version} updated`,
      },
    }),
  ]);
}

export async function updatePlatformReleaseCheck(
  input: {
    releaseId: string;
    checkId: string;
    status: PlatformReleaseCheckStatus;
    testMethod: string | null;
    evidenceSummary: string | null;
    resultNotes: string | null;
    evidenceUrl: string | null;
    testedAt: Date | null;
  },
  actor: PlatformActor,
) {
  const organizationId = requireActorOrganization(actor);
  const check = await prisma.platformReleaseCheck.findFirst({
    where: { id: input.checkId, releaseId: input.releaseId },
    include: {
      release: { select: { id: true, version: true, status: true } },
    },
  });
  if (!check) throw new Error("The release certification check was not found.");
  assertEditableStatus(check.release.status);

  const testMethod = bounded(input.testMethod, 1_000, "Test method");
  const evidenceSummary = bounded(
    input.evidenceSummary,
    3_000,
    "Evidence summary",
  );
  const resultNotes = bounded(input.resultNotes, 2_000, "Result notes");
  const evidenceUrl = safePlatformReleaseEvidenceUrl(input.evidenceUrl);
  validateCheckEvidence({
    status: input.status,
    testMethod,
    evidenceSummary,
    resultNotes,
    testedAt: input.testedAt,
  });

  await prisma.$transaction([
    prisma.platformReleaseCheck.update({
      where: { id: check.id },
      data: {
        status: input.status,
        testMethod,
        evidenceSummary,
        resultNotes,
        evidenceUrl,
        testedAt:
          input.status === PlatformReleaseCheckStatus.NOT_RUN
            ? null
            : input.testedAt,
        testedById:
          input.status === PlatformReleaseCheckStatus.NOT_RUN ? null : actor.id,
        updatedById: actor.id,
      },
    }),
    prisma.platformRelease.update({
      where: { id: check.release.id },
      data:
        check.release.status === PlatformReleaseStatus.REJECTED
          ? resetRejectedRelease()
          : { updatedAt: new Date() },
    }),
    prisma.activityLog.create({
      data: {
        organizationId,
        userId: actor.id,
        action: ActivityAction.STATUS_CHANGE,
        entityType: "PlatformReleaseCheck",
        entityId: check.id,
        title: `${releaseCheckLabel(check.key)} updated`,
        description: input.status.replaceAll("_", " ").toLowerCase(),
        metadata: {
          releaseId: check.release.id,
          releaseVersion: check.release.version,
          key: check.key,
          status: input.status,
          hasEvidenceReference: Boolean(evidenceUrl),
        },
      },
    }),
  ]);
}

export async function assignPlatformReleasePilot(
  input: {
    releaseId: string;
    organizationId: string;
    plannedStartAt: Date | null;
    exitCriteria: string;
  },
  actor: PlatformActor,
) {
  const release = await requireEditableRelease(input.releaseId);
  const tenant = await getPilotTenantState(input.organizationId);
  if (!tenant) throw new Error("The selected production tenant was not found.");
  const issues = pilotTenantEligibilityIssues({
    organizationStatus: tenant.status,
    isDemo: tenant.isDemo,
    onboardingStatus: tenant.onboardingPlan?.status ?? null,
    readinessStatus: tenant.productionReadinessReviews[0]?.status ?? null,
    requireLive: false,
  });
  if (issues.length) throw new Error(issues.join(" "));
  const exitCriteria = bounded(
    input.exitCriteria,
    3_000,
    "Pilot exit criteria",
  );
  if ((exitCriteria?.length ?? 0) < 30) {
    throw new Error("Document at least 30 characters of pilot exit criteria.");
  }

  await prisma.$transaction([
    prisma.platformReleasePilot.upsert({
      where: {
        releaseId_organizationId: {
          releaseId: release.id,
          organizationId: tenant.id,
        },
      },
      update: {
        plannedStartAt: input.plannedStartAt,
        exitCriteria: exitCriteria!,
        updatedById: actor.id,
      },
      create: {
        releaseId: release.id,
        organizationId: tenant.id,
        plannedStartAt: input.plannedStartAt,
        exitCriteria: exitCriteria!,
        updatedById: actor.id,
      },
    }),
    prisma.activityLog.create({
      data: {
        organizationId: tenant.id,
        userId: actor.id,
        action: ActivityAction.ASSIGN,
        entityType: "PlatformReleasePilot",
        entityId: release.id,
        title: `Pilot release candidate ${release.version} assigned`,
        metadata: { releaseId: release.id, plannedStartAt: input.plannedStartAt },
      },
    }),
  ]);
}

export async function removePlatformReleasePilot(
  releaseId: string,
  pilotId: string,
  actor: PlatformActor,
) {
  const release = await requireEditableRelease(releaseId);
  const pilot = await prisma.platformReleasePilot.findFirst({
    where: { id: pilotId, releaseId: release.id },
    select: { id: true, organizationId: true, status: true },
  });
  if (!pilot) throw new Error("The pilot assignment was not found.");
  if (pilot.status !== PlatformReleasePilotStatus.PLANNED) {
    throw new Error("Only a planned pilot assignment can be removed.");
  }
  await prisma.$transaction([
    prisma.platformReleasePilot.delete({ where: { id: pilot.id } }),
    prisma.activityLog.create({
      data: {
        organizationId: pilot.organizationId,
        userId: actor.id,
        action: ActivityAction.DELETE,
        entityType: "PlatformReleasePilot",
        entityId: pilot.id,
        title: `Pilot release candidate ${release.version} unassigned`,
      },
    }),
  ]);
}

export async function submitPlatformReleaseCandidate(
  input: { releaseId: string; submissionNotes: string | null },
  actor: PlatformActor,
) {
  const organizationId = requireActorOrganization(actor);
  const release = await prisma.platformRelease.findUnique({
    where: { id: input.releaseId },
    include: {
      checks: { select: { status: true } },
      pilots: {
        select: {
          organizationId: true,
          organization: {
            select: {
              name: true,
              status: true,
              isDemo: true,
              onboardingPlan: { select: { status: true } },
              productionReadinessReviews: {
                orderBy: { version: "desc" },
                take: 1,
                select: { status: true },
              },
            },
          },
        },
      },
    },
  });
  if (!release) throw new Error("The release candidate was not found.");
  assertPlatformReleaseTransition(
    release.status,
    PlatformReleaseStatus.IN_REVIEW,
  );
  const issues = platformReleaseSubmissionIssues({
    releaseNotes: release.releaseNotes,
    riskSummary: release.riskSummary,
    rollbackPlan: release.rollbackPlan,
    checks: release.checks,
    pilotCount: release.pilots.length,
  });
  for (const pilot of release.pilots) {
    issues.push(
      ...pilotTenantEligibilityIssues({
        organizationStatus: pilot.organization.status,
        isDemo: pilot.organization.isDemo,
        onboardingStatus: pilot.organization.onboardingPlan?.status ?? null,
        readinessStatus:
          pilot.organization.productionReadinessReviews[0]?.status ?? null,
        requireLive: false,
      }).map((issue) => `${pilot.organization.name}: ${issue}`),
    );
  }
  if (issues.length) throw new Error(issues.join(" "));
  const submissionNotes = bounded(
    input.submissionNotes,
    2_000,
    "Submission notes",
  );
  const now = new Date();
  await prisma.$transaction([
    prisma.platformRelease.update({
      where: { id: release.id },
      data: {
        status: PlatformReleaseStatus.IN_REVIEW,
        submissionNotes,
        submittedById: actor.id,
        submittedAt: now,
        reviewedById: null,
        reviewedAt: null,
        reviewNotes: null,
        approvedAt: null,
        rejectedAt: null,
      },
    }),
    prisma.activityLog.create({
      data: {
        organizationId,
        userId: actor.id,
        action: ActivityAction.STATUS_CHANGE,
        entityType: "PlatformRelease",
        entityId: release.id,
        title: `Release candidate ${release.version} submitted`,
      },
    }),
  ]);
}

export async function decidePlatformReleaseCandidate(
  input: {
    releaseId: string;
    decision: PlatformReleaseStatus;
    reviewNotes: string | null;
  },
  actor: PlatformActor,
) {
  const organizationId = requireActorOrganization(actor);
  const release = await prisma.platformRelease.findUnique({
    where: { id: input.releaseId },
    include: { checks: { select: { status: true } }, pilots: { select: { id: true } } },
  });
  if (!release) throw new Error("The release candidate was not found.");
  assertPlatformReleaseTransition(release.status, input.decision);
  const reviewNotes = bounded(input.reviewNotes, 3_000, "Review notes");
  if ((reviewNotes?.length ?? 0) < 20) {
    throw new Error("Document at least 20 characters of release-review rationale.");
  }
  if (input.decision === PlatformReleaseStatus.APPROVED) {
    const issues = platformReleaseSubmissionIssues({
      releaseNotes: release.releaseNotes,
      riskSummary: release.riskSummary,
      rollbackPlan: release.rollbackPlan,
      checks: release.checks,
      pilotCount: release.pilots.length,
    });
    if (issues.length) throw new Error(issues.join(" "));
  }
  const now = new Date();
  await prisma.$transaction([
    prisma.platformRelease.update({
      where: { id: release.id },
      data: {
        status: input.decision,
        reviewNotes,
        reviewedById: actor.id,
        reviewedAt: now,
        approvedAt:
          input.decision === PlatformReleaseStatus.APPROVED ? now : null,
        rejectedAt:
          input.decision === PlatformReleaseStatus.REJECTED ? now : null,
      },
    }),
    prisma.activityLog.create({
      data: {
        organizationId,
        userId: actor.id,
        action: ActivityAction.STATUS_CHANGE,
        entityType: "PlatformRelease",
        entityId: release.id,
        title: `Release candidate ${release.version} ${input.decision.toLowerCase()}`,
        description: reviewNotes,
        metadata: { decision: input.decision },
      },
    }),
  ]);
}

export async function startPlatformReleasePilot(
  releaseId: string,
  actor: PlatformActor,
) {
  const organizationId = requireActorOrganization(actor);
  const release = await prisma.platformRelease.findUnique({
    where: { id: releaseId },
    include: {
      pilots: {
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              status: true,
              isDemo: true,
              onboardingPlan: { select: { status: true } },
              productionReadinessReviews: {
                orderBy: { version: "desc" },
                take: 1,
                select: { status: true },
              },
            },
          },
        },
      },
    },
  });
  if (!release) throw new Error("The release candidate was not found.");
  assertPlatformReleaseTransition(
    release.status,
    PlatformReleaseStatus.PILOT_ACTIVE,
  );
  if (!release.pilots.length) throw new Error("Assign at least one pilot tenant.");
  const issues = release.pilots.flatMap((pilot) =>
    pilotTenantEligibilityIssues({
      organizationStatus: pilot.organization.status,
      isDemo: pilot.organization.isDemo,
      onboardingStatus: pilot.organization.onboardingPlan?.status ?? null,
      readinessStatus:
        pilot.organization.productionReadinessReviews[0]?.status ?? null,
      requireLive: true,
    }).map((issue) => `${pilot.organization.name}: ${issue}`),
  );
  if (issues.length) throw new Error(issues.join(" "));
  if (
    release.pilots.some(
      (pilot) => pilot.status !== PlatformReleasePilotStatus.PLANNED,
    )
  ) {
    throw new Error("Every pilot tenant must be in the planned state.");
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.platformRelease.update({
      where: { id: release.id },
      data: {
        status: PlatformReleaseStatus.PILOT_ACTIVE,
        pilotStartedAt: now,
      },
    });
    await tx.platformReleasePilot.updateMany({
      where: { releaseId: release.id },
      data: {
        status: PlatformReleasePilotStatus.ACTIVE,
        startedAt: now,
        updatedById: actor.id,
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId,
        userId: actor.id,
        action: ActivityAction.STATUS_CHANGE,
        entityType: "PlatformRelease",
        entityId: release.id,
        title: `Release candidate ${release.version} pilot started`,
        metadata: { pilotTenantCount: release.pilots.length },
      },
    });
    for (const pilot of release.pilots) {
      await tx.activityLog.create({
        data: {
          organizationId: pilot.organization.id,
          userId: actor.id,
          action: ActivityAction.STATUS_CHANGE,
          entityType: "PlatformReleasePilot",
          entityId: pilot.id,
          title: `Pilot release ${release.version} started`,
        },
      });
    }
  });
}

export async function recordPlatformReleasePilotOutcome(
  input: {
    releaseId: string;
    pilotId: string;
    outcome: PlatformReleasePilotStatus;
    resultSummary: string;
  },
  actor: PlatformActor,
) {
  const platformOrganizationId = requireActorOrganization(actor);
  const finalOutcomes = new Set<PlatformReleasePilotStatus>([
      PlatformReleasePilotStatus.PASSED,
      PlatformReleasePilotStatus.FAILED,
      PlatformReleasePilotStatus.ROLLED_BACK,
  ]);
  if (!finalOutcomes.has(input.outcome)) {
    throw new Error("Select a final pilot outcome.");
  }
  const resultSummary = bounded(
    input.resultSummary,
    4_000,
    "Pilot result summary",
  );
  if ((resultSummary?.length ?? 0) < 30) {
    throw new Error("Document at least 30 characters of pilot results.");
  }
  const pilot = await prisma.platformReleasePilot.findFirst({
    where: { id: input.pilotId, releaseId: input.releaseId },
    include: {
      release: { select: { id: true, version: true, status: true } },
      organization: { select: { id: true, name: true } },
    },
  });
  if (!pilot) throw new Error("The pilot assignment was not found.");
  if (pilot.release.status !== PlatformReleaseStatus.PILOT_ACTIVE) {
    throw new Error("The release candidate does not have an active pilot.");
  }
  if (pilot.status !== PlatformReleasePilotStatus.ACTIVE) {
    throw new Error("Only an active pilot can record a final outcome.");
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.platformReleasePilot.update({
      where: { id: pilot.id },
      data: {
        status: input.outcome,
        resultSummary: resultSummary!,
        completedAt: now,
        updatedById: actor.id,
      },
    });
    const pilots = await tx.platformReleasePilot.findMany({
      where: { releaseId: pilot.release.id },
      select: { status: true },
    });
    const unsuccessfulStatuses = new Set<PlatformReleasePilotStatus>([
        PlatformReleasePilotStatus.FAILED,
        PlatformReleasePilotStatus.ROLLED_BACK,
    ]);
    const unsuccessful = pilots.some((item) =>
      unsuccessfulStatuses.has(item.status),
    );
    const allPassed = pilots.every(
      (item) => item.status === PlatformReleasePilotStatus.PASSED,
    );
    const nextStatus = unsuccessful
      ? PlatformReleaseStatus.ROLLED_BACK
      : allPassed
        ? PlatformReleaseStatus.RELEASED
        : PlatformReleaseStatus.PILOT_ACTIVE;

    if (nextStatus !== PlatformReleaseStatus.PILOT_ACTIVE) {
      assertPlatformReleaseTransition(pilot.release.status, nextStatus);
      await tx.platformRelease.update({
        where: { id: pilot.release.id },
        data: {
          status: nextStatus,
          releasedAt:
            nextStatus === PlatformReleaseStatus.RELEASED ? now : null,
          rolledBackAt:
            nextStatus === PlatformReleaseStatus.ROLLED_BACK ? now : null,
        },
      });
      if (nextStatus === PlatformReleaseStatus.ROLLED_BACK) {
        await tx.platformReleasePilot.updateMany({
          where: {
            releaseId: pilot.release.id,
            status: PlatformReleasePilotStatus.ACTIVE,
          },
          data: {
            status: PlatformReleasePilotStatus.ROLLED_BACK,
            resultSummary:
              "Pilot rollout stopped after another pilot recorded an unsuccessful outcome.",
            completedAt: now,
            updatedById: actor.id,
          },
        });
      }
      await tx.activityLog.create({
        data: {
          organizationId: platformOrganizationId,
          userId: actor.id,
          action: ActivityAction.STATUS_CHANGE,
          entityType: "PlatformRelease",
          entityId: pilot.release.id,
          title: `Release candidate ${pilot.release.version} ${nextStatus.toLowerCase()}`,
          metadata: { status: nextStatus },
        },
      });
    }
    await tx.activityLog.create({
      data: {
        organizationId: pilot.organization.id,
        userId: actor.id,
        action: ActivityAction.STATUS_CHANGE,
        entityType: "PlatformReleasePilot",
        entityId: pilot.id,
        title: `Pilot release ${pilot.release.version} ${input.outcome.toLowerCase()}`,
        description: resultSummary,
        metadata: { outcome: input.outcome },
      },
    });
  });
}

export async function getPlatformReleasePortfolio() {
  const releases = await prisma.platformRelease.findMany({
    include: {
      checks: { select: { status: true } },
      pilots: {
        select: {
          status: true,
          organization: { select: { id: true, name: true } },
        },
      },
      createdBy: { select: { name: true } },
      reviewedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return releases.map((release) => ({
    ...release,
    progress: platformReleaseProgress(release.checks),
    failedChecks: release.checks.filter(
      (check) => check.status === PlatformReleaseCheckStatus.FAIL,
    ).length,
    passedPilots: release.pilots.filter(
      (pilot) => pilot.status === PlatformReleasePilotStatus.PASSED,
    ).length,
  }));
}

export async function getPlatformReleaseMetrics() {
  const groups = await prisma.platformRelease.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const counts = new Map(
    groups.map((group) => [group.status, group._count._all]),
  );
  const activeStatuses = [
    PlatformReleaseStatus.DRAFT,
    PlatformReleaseStatus.IN_REVIEW,
    PlatformReleaseStatus.APPROVED,
    PlatformReleaseStatus.PILOT_ACTIVE,
  ];
  return {
    total: groups.reduce((total, group) => total + group._count._all, 0),
    active: activeStatuses.reduce(
      (total, status) => total + (counts.get(status) ?? 0),
      0,
    ),
    rolledBack: counts.get(PlatformReleaseStatus.ROLLED_BACK) ?? 0,
  };
}

export async function getPilotTenantOptions() {
  const tenants = await prisma.organization.findMany({
    where: { isDemo: false },
    select: {
      id: true,
      name: true,
      status: true,
      isDemo: true,
      onboardingPlan: { select: { status: true } },
      productionReadinessReviews: {
        orderBy: { version: "desc" },
        take: 1,
        select: { status: true, version: true },
      },
    },
    orderBy: { name: "asc" },
  });
  return tenants.map((tenant) => ({
    ...tenant,
    eligibilityIssues: pilotTenantEligibilityIssues({
      organizationStatus: tenant.status,
      isDemo: tenant.isDemo,
      onboardingStatus: tenant.onboardingPlan?.status ?? null,
      readinessStatus: tenant.productionReadinessReviews[0]?.status ?? null,
      requireLive: false,
    }),
  }));
}

async function getPilotTenantState(organizationId: string) {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      status: true,
      isDemo: true,
      onboardingPlan: { select: { status: true } },
      productionReadinessReviews: {
        orderBy: { version: "desc" },
        take: 1,
        select: { status: true },
      },
    },
  });
}

async function requireEditableRelease(releaseId: string) {
  const release = await prisma.platformRelease.findUnique({
    where: { id: releaseId },
    select: { id: true, version: true, status: true },
  });
  if (!release) throw new Error("The release candidate was not found.");
  assertEditableStatus(release.status);
  return release;
}

function assertEditableStatus(status: PlatformReleaseStatus) {
  if (
    status !== PlatformReleaseStatus.DRAFT &&
    status !== PlatformReleaseStatus.REJECTED
  ) {
    throw new Error("This release candidate is locked.");
  }
}

function resetRejectedRelease() {
  return {
    status: PlatformReleaseStatus.DRAFT,
    submittedById: null,
    submittedAt: null,
    reviewedById: null,
    reviewedAt: null,
    reviewNotes: null,
    approvedAt: null,
    rejectedAt: null,
  } as const;
}

function validateCheckEvidence(input: {
  status: PlatformReleaseCheckStatus;
  testMethod: string | null;
  evidenceSummary: string | null;
  resultNotes: string | null;
  testedAt: Date | null;
}) {
  if (input.status === PlatformReleaseCheckStatus.NOT_RUN) return;
  if ((input.evidenceSummary?.length ?? 0) < 20) {
    throw new Error("Document at least 20 characters of certification evidence.");
  }
  if (input.status === PlatformReleaseCheckStatus.NOT_APPLICABLE) {
    if ((input.resultNotes?.length ?? 0) < 12) {
      throw new Error("Document why this release check is not applicable.");
    }
    return;
  }
  if ((input.testMethod?.length ?? 0) < 8 || !input.testedAt) {
    throw new Error("Record the test method and test date.");
  }
  if (
    input.status === PlatformReleaseCheckStatus.FAIL &&
    (input.resultNotes?.length ?? 0) < 12
  ) {
    throw new Error("Document the failed result and required remediation.");
  }
}

function releaseCheckLabel(key: string) {
  return (
    platformReleaseCheckDefinitions.find((item) => item.key === key)?.label ??
    "Release certification check"
  );
}

function bounded(value: string | null | undefined, max: number, label: string) {
  const normalized = value?.trim() || null;
  if (normalized && normalized.length > max) {
    throw new Error(`${label} must be ${max.toLocaleString()} characters or fewer.`);
  }
  return normalized;
}

function requireActorOrganization(actor: PlatformActor) {
  if (!actor.organizationId) {
    throw new Error(
      "Assign the platform administrator to the internal Senzilytics organization before managing releases.",
    );
  }
  return actor.organizationId;
}
