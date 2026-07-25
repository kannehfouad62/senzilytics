import { prisma } from "@/lib/prisma";
import {
  assertProductionReadinessTransition,
  productionReadinessApprovalIssues,
  productionReadinessControlDefinitions,
  productionReadinessProgress,
  productionReadinessSubmissionIssues,
} from "@/modules/platform/production-readiness";
import {
  ActivityAction,
  ProductionReadinessControlStatus,
  ProductionReadinessReviewStatus,
} from "@prisma/client";

type PlatformActor = { id: string };

export type ProductionReadinessControlInput = {
  organizationId: string;
  controlId: string;
  status: ProductionReadinessControlStatus;
  ownerId: string | null;
  dueAt: Date | null;
  testMethod: string | null;
  evidenceSummary: string | null;
  resultNotes: string | null;
  evidenceUrl: string | null;
  testedAt: Date | null;
};

export async function initializeProductionReadinessReview(
  organizationId: string,
  actor: PlatformActor,
) {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, isDemo: false },
    select: { id: true, name: true },
  });
  if (!organization) throw new Error("The selected production tenant was not found.");
  const latest = await prisma.productionReadinessReview.findFirst({
    where: { organizationId },
    orderBy: { version: "desc" },
    select: { id: true, version: true, status: true },
  });
  if (
    latest &&
    latest.status !== ProductionReadinessReviewStatus.APPROVED
  ) {
    return latest;
  }

  return prisma.$transaction(async (tx) => {
    const review = await tx.productionReadinessReview.create({
      data: {
        organizationId,
        version: (latest?.version ?? 0) + 1,
        createdById: actor.id,
        controls: {
          create: productionReadinessControlDefinitions.map((definition) => ({
            key: definition.key,
            updatedById: actor.id,
          })),
        },
      },
      select: { id: true, version: true, status: true },
    });
    await tx.activityLog.create({
      data: {
        organizationId,
        userId: actor.id,
        action: ActivityAction.CREATE,
        entityType: "ProductionReadinessReview",
        entityId: review.id,
        title: `Production readiness review v${review.version} initialized`,
        description: organization.name,
      },
    });
    return review;
  });
}

export async function updateProductionReadinessMetadata(
  input: {
    organizationId: string;
    reviewId: string;
    targetReviewAt: Date | null;
    executiveSummary: string | null;
  },
  actor: PlatformActor,
) {
  const review = await requireEditableReview(input.organizationId, input.reviewId);
  const executiveSummary = bounded(
    input.executiveSummary,
    4_000,
    "Executive summary",
  );
  await prisma.$transaction([
    prisma.productionReadinessReview.update({
      where: { id: review.id },
      data: {
        targetReviewAt: input.targetReviewAt,
        executiveSummary,
        ...(review.status === ProductionReadinessReviewStatus.REJECTED
          ? {
              status: ProductionReadinessReviewStatus.DRAFT,
              reviewedById: null,
              reviewedAt: null,
              reviewNotes: null,
              rejectedAt: null,
            }
          : {}),
      },
    }),
    prisma.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.UPDATE,
        entityType: "ProductionReadinessReview",
        entityId: review.id,
        title: `Production readiness review v${review.version} updated`,
      },
    }),
  ]);
}

export async function updateProductionReadinessControl(
  input: ProductionReadinessControlInput,
  actor: PlatformActor,
) {
  const control = await prisma.productionReadinessControl.findFirst({
    where: {
      id: input.controlId,
      review: { organizationId: input.organizationId },
    },
    include: {
      review: { select: { id: true, version: true, status: true } },
    },
  });
  if (!control) throw new Error("The production readiness control was not found.");
  if (
    control.review.status !== ProductionReadinessReviewStatus.DRAFT &&
    control.review.status !== ProductionReadinessReviewStatus.REJECTED
  ) {
    throw new Error("Controls are locked while the review is pending or approved.");
  }
  await validateTenantUser(input.organizationId, input.ownerId);

  const testMethod = bounded(input.testMethod, 1_000, "Test method");
  const evidenceSummary = bounded(
    input.evidenceSummary,
    3_000,
    "Evidence summary",
  );
  const resultNotes = bounded(input.resultNotes, 2_000, "Result notes");
  const evidenceUrl = safeEvidenceUrl(input.evidenceUrl);
  validateControlEvidence({
    status: input.status,
    ownerId: input.ownerId,
    dueAt: input.dueAt,
    testMethod,
    evidenceSummary,
    resultNotes,
    testedAt: input.testedAt,
  });

  await prisma.$transaction([
    prisma.productionReadinessControl.update({
      where: { id: control.id },
      data: {
        status: input.status,
        ownerId: input.ownerId,
        dueAt: input.dueAt,
        testMethod,
        evidenceSummary,
        resultNotes,
        evidenceUrl,
        testedAt: input.testedAt,
        testedById: input.testedAt ? actor.id : null,
        updatedById: actor.id,
      },
    }),
    prisma.productionReadinessReview.update({
      where: { id: control.review.id },
      data:
        control.review.status === ProductionReadinessReviewStatus.REJECTED
          ? {
              status: ProductionReadinessReviewStatus.DRAFT,
              reviewedById: null,
              reviewedAt: null,
              reviewNotes: null,
              rejectedAt: null,
            }
          : { updatedAt: new Date() },
    }),
    prisma.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.STATUS_CHANGE,
        entityType: "ProductionReadinessControl",
        entityId: control.id,
        title: `${labelFor(control.key)} control updated`,
        description: input.status.replaceAll("_", " ").toLowerCase(),
        metadata: {
          reviewId: control.review.id,
          version: control.review.version,
          key: control.key,
          status: input.status,
          hasEvidenceReference: Boolean(evidenceUrl),
        },
      },
    }),
  ]);
}

export async function submitProductionReadinessReview(
  input: {
    organizationId: string;
    reviewId: string;
    submissionNotes: string | null;
  },
  actor: PlatformActor,
) {
  const review = await prisma.productionReadinessReview.findFirst({
    where: { id: input.reviewId, organizationId: input.organizationId },
    include: { controls: { select: { status: true } } },
  });
  if (!review) throw new Error("The production readiness review was not found.");
  assertProductionReadinessTransition(
    review.status,
    ProductionReadinessReviewStatus.IN_REVIEW,
  );
  if ((review.executiveSummary?.trim().length ?? 0) < 40) {
    throw new Error("Add an executive readiness summary of at least 40 characters.");
  }
  const issues = productionReadinessSubmissionIssues(review.controls);
  if (issues.length) throw new Error(issues.join(" "));
  const submissionNotes = bounded(
    input.submissionNotes,
    2_000,
    "Submission notes",
  );
  const now = new Date();
  await prisma.$transaction([
    prisma.productionReadinessReview.update({
      where: { id: review.id },
      data: {
        status: ProductionReadinessReviewStatus.IN_REVIEW,
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
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.STATUS_CHANGE,
        entityType: "ProductionReadinessReview",
        entityId: review.id,
        title: `Production readiness review v${review.version} submitted`,
      },
    }),
  ]);
}

export async function decideProductionReadinessReview(
  input: {
    organizationId: string;
    reviewId: string;
    decision: ProductionReadinessReviewStatus;
    reviewNotes: string | null;
  },
  actor: PlatformActor,
) {
  const review = await prisma.productionReadinessReview.findFirst({
    where: { id: input.reviewId, organizationId: input.organizationId },
    include: { controls: { select: { status: true } } },
  });
  if (!review) throw new Error("The production readiness review was not found.");
  assertProductionReadinessTransition(review.status, input.decision);
  const reviewNotes = bounded(input.reviewNotes, 3_000, "Review notes");
  if ((reviewNotes?.length ?? 0) < 20) {
    throw new Error("Document at least 20 characters of review rationale.");
  }
  if (input.decision === ProductionReadinessReviewStatus.APPROVED) {
    const issues = productionReadinessApprovalIssues(review.controls);
    if (issues.length) throw new Error(issues.join(" "));
  }
  const now = new Date();
  await prisma.$transaction([
    prisma.productionReadinessReview.update({
      where: { id: review.id },
      data: {
        status: input.decision,
        reviewNotes,
        reviewedById: actor.id,
        reviewedAt: now,
        approvedAt:
          input.decision === ProductionReadinessReviewStatus.APPROVED
            ? now
            : null,
        rejectedAt:
          input.decision === ProductionReadinessReviewStatus.REJECTED
            ? now
            : null,
      },
    }),
    prisma.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.STATUS_CHANGE,
        entityType: "ProductionReadinessReview",
        entityId: review.id,
        title: `Production readiness review v${review.version} ${input.decision.toLowerCase()}`,
        description: reviewNotes,
        metadata: { decision: input.decision, version: review.version },
      },
    }),
  ]);
}

export async function getProductionReadinessPortfolio() {
  const reviews = await prisma.productionReadinessReview.findMany({
    include: {
      organization: { select: { id: true, name: true } },
      controls: { select: { status: true, dueAt: true } },
      reviewedBy: { select: { name: true } },
    },
    orderBy: [{ organizationId: "asc" }, { version: "desc" }],
  });
  const latest = new Map<string, (typeof reviews)[number]>();
  for (const review of reviews) {
    if (!latest.has(review.organizationId)) latest.set(review.organizationId, review);
  }
  return Array.from(latest.values())
    .map((review) => ({
      ...review,
      progress: productionReadinessProgress(review.controls),
      failedControls: review.controls.filter(
        (control) => control.status === ProductionReadinessControlStatus.FAIL,
      ).length,
      conditionalControls: review.controls.filter(
        (control) =>
          control.status === ProductionReadinessControlStatus.CONDITIONAL,
      ).length,
      overdueControls: review.controls.filter(
        (control) =>
          control.dueAt &&
          control.dueAt < new Date() &&
          control.status !== ProductionReadinessControlStatus.PASS &&
          control.status !==
            ProductionReadinessControlStatus.NOT_APPLICABLE,
      ).length,
    }))
    .sort((left, right) => left.organization.name.localeCompare(right.organization.name));
}

async function requireEditableReview(organizationId: string, reviewId: string) {
  const review = await prisma.productionReadinessReview.findFirst({
    where: { id: reviewId, organizationId },
    select: { id: true, version: true, status: true },
  });
  if (!review) throw new Error("The production readiness review was not found.");
  if (
    review.status !== ProductionReadinessReviewStatus.DRAFT &&
    review.status !== ProductionReadinessReviewStatus.REJECTED
  ) {
    throw new Error("This production readiness review is locked.");
  }
  return review;
}

async function validateTenantUser(
  organizationId: string,
  userId: string | null,
) {
  if (!userId) return;
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId, isActive: true },
    select: { id: true },
  });
  if (!user) throw new Error("Select an active control owner from this tenant.");
}

function validateControlEvidence(input: {
  status: ProductionReadinessControlStatus;
  ownerId: string | null;
  dueAt: Date | null;
  testMethod: string | null;
  evidenceSummary: string | null;
  resultNotes: string | null;
  testedAt: Date | null;
}) {
  if (input.status === ProductionReadinessControlStatus.NOT_ASSESSED) return;
  if ((input.evidenceSummary?.length ?? 0) < 20) {
    throw new Error("Document at least 20 characters of control evidence.");
  }
  if (input.status === ProductionReadinessControlStatus.NOT_APPLICABLE) {
    if ((input.resultNotes?.length ?? 0) < 12) {
      throw new Error("Document why this control is not applicable.");
    }
    return;
  }
  if ((input.testMethod?.length ?? 0) < 8 || !input.testedAt) {
    throw new Error("Record the test method and test date.");
  }
  if (
    (input.status === ProductionReadinessControlStatus.CONDITIONAL ||
      input.status === ProductionReadinessControlStatus.FAIL) &&
    (!input.ownerId || !input.dueAt)
  ) {
    throw new Error("Assign a remediation owner and due date.");
  }
}

export function safeProductionEvidenceUrl(value: string | null | undefined) {
  return safeEvidenceUrl(value);
}

function safeEvidenceUrl(value: string | null | undefined) {
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
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("Evidence reference must be an approved path or HTTPS URL.");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.hostname === "localhost"
  ) {
    throw new Error("External evidence references must use a safe HTTPS URL.");
  }
  return parsed.toString();
}

function bounded(value: string | null | undefined, max: number, label: string) {
  const normalized = value?.trim() || null;
  if (normalized && normalized.length > max) {
    throw new Error(`${label} must be ${max} characters or fewer.`);
  }
  return normalized;
}

function labelFor(key: string) {
  return (
    productionReadinessControlDefinitions.find(
      (definition) => definition.key === key,
    )?.label ?? "Production readiness"
  );
}
