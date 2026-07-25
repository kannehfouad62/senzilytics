import { OnboardingWorkspace } from "@/features/identity/onboarding-workspace";
import { ProductionReadinessWorkspace } from "@/features/platform/production-readiness-forms";
import { requirePlatformAdministrator } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { productionReadinessProgress } from "@/modules/platform/production-readiness";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function PlatformTenantImplementationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdministrator();
  const { id } = await params;
  const organization = await prisma.organization.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      subscriptionPlan: true,
      users: {
        where: { isActive: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      },
      onboardingPlan: {
        select: {
          status: true,
          targetGoLiveAt: true,
          customerOwnerId: true,
          platformOwnerName: true,
          platformOwnerEmail: true,
          tenantVisibleNotes: true,
          internalNotes: true,
          liveAt: true,
          goLiveApprovedAt: true,
          steps: {
            select: {
              key: true,
              status: true,
              ownerId: true,
              dueAt: true,
              tenantNotes: true,
              blocker: true,
              owner: { select: { name: true } },
            },
          },
        },
      },
      productionReadinessReviews: {
        orderBy: { version: "desc" },
        take: 1,
        select: {
          id: true,
          version: true,
          status: true,
          targetReviewAt: true,
          executiveSummary: true,
          submissionNotes: true,
          reviewNotes: true,
          submittedAt: true,
          reviewedAt: true,
          approvedAt: true,
          rejectedAt: true,
          controls: {
            orderBy: { key: "asc" },
            select: {
              id: true,
              key: true,
              status: true,
              ownerId: true,
              dueAt: true,
              testMethod: true,
              evidenceSummary: true,
              resultNotes: true,
              evidenceUrl: true,
              testedAt: true,
              owner: { select: { name: true } },
              testedBy: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!organization) notFound();
  const readiness = organization.productionReadinessReviews[0] ?? null;

  return (
    <div>
      <Link href="/platform/tenants" className="text-sm text-cyan-300">
        ← Tenant Provisioning
      </Link>
      <h1 className="mt-3 text-4xl font-bold tracking-tight">
        Implementation control
      </h1>
      <p className="mb-8 mt-2 max-w-3xl text-slate-400">
        Govern customer onboarding, readiness evidence, blockers, and the final
        platform go-live decision.
      </p>
      <OnboardingWorkspace
        organization={organization}
        plan={organization.onboardingPlan}
        users={organization.users}
        platform
      />
      <div className="my-10 border-t border-white/10" />
      <ProductionReadinessWorkspace
        organization={{ id: organization.id, name: organization.name }}
        users={organization.users}
        progress={readiness ? productionReadinessProgress(readiness.controls) : 0}
        review={
          readiness
            ? {
                ...readiness,
                targetReviewAt: dateValue(readiness.targetReviewAt),
                submittedAt: dateTimeValue(readiness.submittedAt),
                reviewedAt: dateTimeValue(readiness.reviewedAt),
                approvedAt: dateTimeValue(readiness.approvedAt),
                rejectedAt: dateTimeValue(readiness.rejectedAt),
                controls: readiness.controls.map((control) => ({
                  ...control,
                  dueAt: dateValue(control.dueAt),
                  testedAt: dateValue(control.testedAt),
                })),
              }
            : null
        }
      />
    </div>
  );
}

function dateValue(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function dateTimeValue(value: Date | null) {
  return value?.toLocaleString("en-US", { timeZone: "UTC" }) ?? null;
}
