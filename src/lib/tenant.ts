import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isApprovedPlatformAdministrator } from "@/lib/platform-admin";
import { getActiveSupportAccess } from "@/modules/platform/support-access.service";

export async function getCurrentUserTenant() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    include: {
      organization: true,
      department: {
        include: {
          site: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const supportAccess = isApprovedPlatformAdministrator(user) ? await getActiveSupportAccess(user.id) : null;
  const effectiveOrganization = supportAccess?.organization ?? user.organization;

  if (!user.isActive || effectiveOrganization?.status === "SUSPENDED") {
    redirect("/unauthorized");
  }

  const organizationId = supportAccess?.organizationId ?? user.organizationId;
  if (!organizationId || !effectiveOrganization) {
    throw new Error("User is not assigned to an organization.");
  }

  return {
    user: supportAccess ? { ...user, organization: effectiveOrganization, departmentId: null, department: null } : user,
    organizationId,
    organization: effectiveOrganization,
    departmentId: supportAccess ? null : user.departmentId,
    siteId: supportAccess ? null : user.department?.siteId ?? null,
    supportAccess,
  };
}
