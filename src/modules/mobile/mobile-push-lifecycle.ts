import { MobilePushDeliveryStatus } from "@prisma/client";

export const MOBILE_PUSH_RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000] as const;

export function nextMobilePushAttempt(attemptCount: number, maxAttempts: number, now = new Date()) {
  if (attemptCount >= maxAttempts) return { status: MobilePushDeliveryStatus.ABANDONED, nextAttemptAt: now };
  const delay = MOBILE_PUSH_RETRY_DELAYS_MS[Math.min(Math.max(attemptCount - 1, 0), MOBILE_PUSH_RETRY_DELAYS_MS.length - 1)];
  return { status: MobilePushDeliveryStatus.FAILED, nextAttemptAt: new Date(now.getTime() + delay) };
}
