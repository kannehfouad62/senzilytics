import { prisma } from "@/lib/prisma";
import {
  deriveTenantOnboardingStatus,
  isOnboardingStepComplete,
  tenantOnboardingStepDefinitions,
} from "@/modules/platform/tenant-onboarding-lifecycle";
import {
  ActivityAction,
  OrganizationStatus,
  ProductionReadinessReviewStatus,
  SubscriptionPlan,
  TenantOnboardingStatus,
  TenantOnboardingStepKey,
  TenantOnboardingStepStatus,
  UserRole,
  type Prisma,
} from "@prisma/client";

type OnboardingActor = {
  id: string;
  isPlatformAdministrator: boolean;
};

type PlanMetadataInput = {
  organizationId: string;
  targetGoLiveAt: Date | null;
  customerOwnerId: string | null;
  tenantVisibleNotes: string | null;
  platformOwnerName?: string | null;
  platformOwnerEmail?: string | null;
  internalNotes?: string | null;
};

type StepUpdateInput = {
  organizationId: string;
  key: TenantOnboardingStepKey;
  status: TenantOnboardingStepStatus;
  ownerId: string | null;
  dueAt: Date | null;
  tenantNotes: string | null;
  blocker: string | null;
};

const activeStepStatuses: readonly TenantOnboardingStepStatus[] = [
  TenantOnboardingStepStatus.COMPLETED,
  TenantOnboardingStepStatus.WAIVED,
];

export async function initializeTenantOnboardingPlan(
  organizationId: string,
  actor: OnboardingActor,
) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!organization) throw new Error("The selected tenant does not exist.");

  const existing = await prisma.tenantOnboardingPlan.findUnique({
    where: { organizationId },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    const plan = await tx.tenantOnboardingPlan.create({
      data: {
        organizationId,
        steps: {
          create: tenantOnboardingStepDefinitions.map((step) => ({
            key: step.key,
            updatedById: actor.id,
          })),
        },
      },
      select: { id: true },
    });
    await tx.activityLog.create({
      data: {
        organizationId,
        userId: actor.id,
        action: ActivityAction.CREATE,
        entityType: "TenantOnboardingPlan",
        entityId: plan.id,
        title: "Tenant implementation plan initialized",
        description: organization.name,
      },
    });
    return plan;
  });
}

export async function updateTenantOnboardingPlanMetadata(
  input: PlanMetadataInput,
  actor: OnboardingActor,
) {
  const plan = await requirePlan(input.organizationId);
  if (plan.status === TenantOnboardingStatus.LIVE) {
    throw new Error("A live implementation plan cannot be changed.");
  }
  await validateTenantUser(input.organizationId, input.customerOwnerId, "customer owner");

  const platformOwnerEmail = input.platformOwnerEmail?.trim().toLowerCase() || null;
  if (
    actor.isPlatformAdministrator &&
    platformOwnerEmail &&
    !platformOwnerEmail.endsWith("@senzilytics.com")
  ) {
    throw new Error("The platform owner must use a senzilytics.com email address.");
  }

  const data: Prisma.TenantOnboardingPlanUpdateInput = {
    targetGoLiveAt: input.targetGoLiveAt,
    customerOwner: input.customerOwnerId
      ? { connect: { id: input.customerOwnerId } }
      : { disconnect: true },
    tenantVisibleNotes: bounded(input.tenantVisibleNotes, 2_000, "Tenant notes"),
  };
  if (actor.isPlatformAdministrator) {
    data.platformOwnerName = bounded(input.platformOwnerName, 120, "Platform owner name");
    data.platformOwnerEmail = platformOwnerEmail;
    data.internalNotes = bounded(input.internalNotes, 4_000, "Internal notes");
  }

  await prisma.$transaction([
    prisma.tenantOnboardingPlan.update({ where: { id: plan.id }, data }),
    prisma.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.UPDATE,
        entityType: "TenantOnboardingPlan",
        entityId: plan.id,
        title: "Tenant implementation plan updated",
      },
    }),
  ]);
}

export async function updateTenantOnboardingStep(
  input: StepUpdateInput,
  actor: OnboardingActor,
) {
  const plan = await requirePlan(input.organizationId);
  if (plan.status === TenantOnboardingStatus.LIVE) {
    throw new Error("This tenant is already live. The launch record is locked.");
  }
  if (
    input.key === TenantOnboardingStepKey.GO_LIVE_APPROVAL &&
    !actor.isPlatformAdministrator
  ) {
    throw new Error("Only a Senzilytics platform administrator can approve go-live.");
  }
  await validateTenantUser(input.organizationId, input.ownerId, "step owner");

  const tenantNotes = bounded(input.tenantNotes, 2_000, "Step notes");
  const blocker = bounded(input.blocker, 1_000, "Blocker");
  if (input.status === TenantOnboardingStepStatus.BLOCKED && !blocker) {
    throw new Error("Describe the blocker before marking this step blocked.");
  }
  if (input.status === TenantOnboardingStepStatus.WAIVED && !tenantNotes) {
    throw new Error("Document the approved rationale before waiving this step.");
  }
  if (input.status === TenantOnboardingStepStatus.COMPLETED) {
    await validateCompletionGate(input.organizationId, input.key, plan.steps);
  }

  await prisma.$transaction(async (tx) => {
    const step = await tx.tenantOnboardingStep.findUnique({
      where: { planId_key: { planId: plan.id, key: input.key } },
      select: { id: true },
    });
    if (!step) throw new Error("The onboarding step could not be found.");

    await tx.tenantOnboardingStep.update({
      where: { id: step.id },
      data: {
        status: input.status,
        ownerId: input.ownerId,
        dueAt: input.dueAt,
        tenantNotes,
        blocker:
          input.status === TenantOnboardingStepStatus.BLOCKED ? blocker : null,
        completedAt: activeStepStatuses.includes(input.status) ? new Date() : null,
        completedById: activeStepStatuses.includes(input.status) ? actor.id : null,
        updatedById: actor.id,
      },
    });

    const steps = await tx.tenantOnboardingStep.findMany({
      where: { planId: plan.id },
      select: { key: true, status: true },
    });
    const nextStatus = deriveTenantOnboardingStatus(steps);
    const now = new Date();
    await tx.tenantOnboardingPlan.update({
      where: { id: plan.id },
      data: {
        status: nextStatus,
        startedAt:
          nextStatus !== TenantOnboardingStatus.NOT_STARTED
            ? plan.startedAt ?? now
            : plan.startedAt,
        readyForReviewAt:
          nextStatus === TenantOnboardingStatus.READY_FOR_REVIEW
            ? plan.readyForReviewAt ?? now
            : plan.readyForReviewAt,
        goLiveApprovedAt:
          nextStatus === TenantOnboardingStatus.LIVE ? now : null,
        goLiveApprovedById:
          nextStatus === TenantOnboardingStatus.LIVE ? actor.id : null,
        liveAt: nextStatus === TenantOnboardingStatus.LIVE ? now : null,
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.STATUS_CHANGE,
        entityType: "TenantOnboardingStep",
        entityId: step.id,
        title: `${labelFor(input.key)} updated`,
        description: input.status.replaceAll("_", " ").toLowerCase(),
        metadata: { key: input.key, status: input.status },
      },
    });
  });
}

async function requirePlan(organizationId: string) {
  const plan = await prisma.tenantOnboardingPlan.findUnique({
    where: { organizationId },
    include: { steps: { select: { key: true, status: true } } },
  });
  if (!plan) throw new Error("Initialize the tenant implementation plan first.");
  return plan;
}

async function validateTenantUser(
  organizationId: string,
  userId: string | null,
  label: string,
) {
  if (!userId) return;
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId, isActive: true },
    select: { id: true },
  });
  if (!user) throw new Error(`Select an active ${label} from this tenant.`);
}

async function validateCompletionGate(
  organizationId: string,
  key: TenantOnboardingStepKey,
  currentSteps: readonly { key: TenantOnboardingStepKey; status: TenantOnboardingStepStatus }[],
) {
  if (key === TenantOnboardingStepKey.GO_LIVE_APPROVAL) {
    const incomplete = currentSteps.filter(
      (step) =>
        step.key !== TenantOnboardingStepKey.GO_LIVE_APPROVAL &&
        !isOnboardingStepComplete(step.status),
    );
    if (incomplete.length) {
      throw new Error(
        `${incomplete.length} implementation prerequisite${incomplete.length === 1 ? "" : "s"} remain incomplete.`,
      );
    }
    const latestReadinessReview =
      await prisma.productionReadinessReview.findFirst({
        where: { organizationId },
        orderBy: { version: "desc" },
        select: { status: true, version: true },
      });
    if (
      latestReadinessReview?.status !==
      ProductionReadinessReviewStatus.APPROVED
    ) {
      throw new Error(
        "Approve the latest Production Assurance review before tenant go-live.",
      );
    }
    return;
  }

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      status: true,
      allowedEmailDomains: true,
      subscriptionPlan: true,
      _count: { select: { sites: true } },
    },
  });

  if (key === TenantOnboardingStepKey.DOMAIN_AND_AUTH) {
    if (
      organization.status !== OrganizationStatus.ACTIVE ||
      organization.allowedEmailDomains.length === 0
    ) {
      throw new Error("Activate the tenant and register an approved email domain first.");
    }
  }
  if (key === TenantOnboardingStepKey.ORGANIZATION_STRUCTURE) {
    const departments = await prisma.department.count({
      where: { site: { organizationId } },
    });
    if (organization._count.sites === 0 || departments === 0) {
      throw new Error("Create at least one site and one department first.");
    }
  }
  if (key === TenantOnboardingStepKey.SSO_CONFIGURATION) {
    const identityProvider = await prisma.organizationIdentityProvider.findFirst({
      where: { organizationId, isEnabled: true },
      select: { id: true },
    });
    if (!identityProvider) {
      throw new Error("Enable Microsoft Entra ID or Okta, or waive this step with a rationale.");
    }
  }
  if (key === TenantOnboardingStepKey.USER_ACCESS) {
    const administrator = await prisma.user.findFirst({
      where: { organizationId, role: UserRole.ORG_ADMIN, isActive: true },
      select: { id: true },
    });
    if (!administrator) {
      throw new Error("Activate at least one tenant Organization Administrator first.");
    }
  }
  if (
    key === TenantOnboardingStepKey.MOBILE_READINESS &&
    organization.subscriptionPlan === SubscriptionPlan.PREMIUM
  ) {
    const activeMobileSession = await prisma.mobileSession.findFirst({
      where: { organizationId, status: "ACTIVE", expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (!activeMobileSession) {
      throw new Error("Validate at least one active Premium mobile session first.");
    }
  }
}

function bounded(value: string | null | undefined, max: number, label: string) {
  const normalized = value?.trim() || null;
  if (normalized && normalized.length > max) {
    throw new Error(`${label} must be ${max} characters or fewer.`);
  }
  return normalized;
}

function labelFor(key: TenantOnboardingStepKey) {
  return (
    tenantOnboardingStepDefinitions.find((step) => step.key === key)?.label ??
    "Implementation step"
  );
}
