import { OnboardingWorkspace } from "@/features/identity/onboarding-workspace";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";

export default async function TenantImplementationPage() {
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const { organizationId } = await getCurrentUserTenant();
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
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

  const plan = organization.onboardingPlan
    ? { ...organization.onboardingPlan, internalNotes: null }
    : null;

  return (
    <div>
      <p className="text-sm text-cyan-300">Customer Implementation</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Launch readiness</h1>
      <p className="mb-8 mt-2 max-w-3xl text-slate-400">
        Coordinate configuration, validation, ownership, and formal production
        approval with the Senzilytics implementation team.
      </p>
      <OnboardingWorkspace
        organization={organization}
        plan={plan}
        users={organization.users}
        platform={false}
      />
    </div>
  );
}
