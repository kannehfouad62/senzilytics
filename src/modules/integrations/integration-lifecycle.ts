import { IntegrationDeliveryStatus } from "@prisma/client";

export const WEBHOOK_RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000, 86_400_000] as const;

export function nextWebhookAttempt(attemptCount: number, maxAttempts: number, now = new Date()) {
  if (attemptCount >= maxAttempts) return { status: IntegrationDeliveryStatus.ABANDONED, nextAttemptAt: now };
  const delay = WEBHOOK_RETRY_DELAYS_MS[Math.min(Math.max(attemptCount - 1, 0), WEBHOOK_RETRY_DELAYS_MS.length - 1)];
  return { status: IntegrationDeliveryStatus.FAILED, nextAttemptAt: new Date(now.getTime() + delay) };
}
