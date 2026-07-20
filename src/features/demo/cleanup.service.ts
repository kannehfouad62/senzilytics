import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function cleanupExpiredDemoUsers() {
  const result = await prisma.user.deleteMany({
    where: {
      role: UserRole.DEMO_VIEWER,
      demoExpiresAt: { lt: new Date() },
    },
  });

  return { deletedUsers: result.count };
}
