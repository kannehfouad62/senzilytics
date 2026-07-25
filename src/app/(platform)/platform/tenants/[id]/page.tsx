import { OnboardingWorkspace } from "@/features/identity/onboarding-workspace";
import { requirePlatformAdministrator } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
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
    },
  });
  if (!organization) notFound();

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
    </div>
  );
}
