import { SupportAccessStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const supportAccessCookie = "senzilytics-support-access";
export const supportAccessDurations = [30, 60, 120, 240, 480] as const;

export function supportAccessTransitionAllowed(current: SupportAccessStatus, next: SupportAccessStatus) {
  const allowed: Partial<Record<SupportAccessStatus, SupportAccessStatus[]>> = {
    REQUESTED: [SupportAccessStatus.APPROVED, SupportAccessStatus.DENIED, SupportAccessStatus.REVOKED],
    APPROVED: [SupportAccessStatus.ACTIVE, SupportAccessStatus.REVOKED, SupportAccessStatus.EXPIRED],
    ACTIVE: [SupportAccessStatus.COMPLETED, SupportAccessStatus.REVOKED, SupportAccessStatus.EXPIRED],
  };
  return allowed[current]?.includes(next) ?? false;
}

export async function getActiveSupportAccess(requestedById: string) {
  const grantId = (await cookies()).get(supportAccessCookie)?.value;
  if (!grantId) return null;
  return prisma.supportAccessGrant.findFirst({
    where: { id: grantId, requestedById, status: SupportAccessStatus.ACTIVE, expiresAt: { gt: new Date() }, organization: { status: "ACTIVE" } },
    include: { organization: true },
  });
}
