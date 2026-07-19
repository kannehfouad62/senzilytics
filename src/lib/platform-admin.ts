import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const PLATFORM_ADMIN_DOMAIN = "senzilytics.com";

export function isApprovedPlatformAdministrator(user: {
  email: string;
  role: string;
  isActive: boolean;
  isPlatformAdmin: boolean;
}) {
  const domain = user.email.trim().toLowerCase().split("@")[1];

  return (
    user.isActive &&
    user.isPlatformAdmin &&
    user.role === "SUPER_ADMIN" &&
    domain === PLATFORM_ADMIN_DOMAIN
  );
}

export async function getPlatformAdministrator() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      isPlatformAdmin: true,
    },
  });

  return user && isApprovedPlatformAdministrator(user) ? user : null;
}

export async function requirePlatformAdministrator() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await getPlatformAdministrator();
  if (!user) redirect("/unauthorized");

  return user;
}
