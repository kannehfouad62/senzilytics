import type { Prisma } from "@prisma/client";

export type MobileOfflineSubmission = {
  id: string;
  capturedAt: Date;
  payloadHash: string;
};

export async function recordMobileOfflineSubmission(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    userId: string;
    offlineSubmission?: MobileOfflineSubmission;
  },
  recordType: string,
  recordId: string
) {
  if (!input.offlineSubmission) return;
  await tx.offlineSubmission.create({
    data: {
      id: input.offlineSubmission.id,
      organizationId: input.organizationId,
      userId: input.userId,
      recordType,
      recordId,
      capturedAt: input.offlineSubmission.capturedAt,
      payloadHash: input.offlineSubmission.payloadHash,
    },
  });
}
