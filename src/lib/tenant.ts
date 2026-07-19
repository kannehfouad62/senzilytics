import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

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

  if (!user.isActive || user.organization?.status === "SUSPENDED") {
    redirect("/unauthorized");
  }

  if (!user.organizationId) {
    throw new Error("User is not assigned to an organization.");
  }

  return {
    user,
    organizationId: user.organizationId,
    organization: user.organization,
    departmentId: user.departmentId,
    siteId: user.department?.siteId ?? null,
  };
}
