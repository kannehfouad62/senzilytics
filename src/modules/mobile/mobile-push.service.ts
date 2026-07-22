import { ActivityAction, MobilePlatform, MobilePushDeliveryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mobilePushIdentityMatches, nextMobilePushAttempt } from "@/modules/mobile/mobile-push-lifecycle";

const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPT_URL = "https://exp.host/--/api/v2/push/getReceipts";

export async function registerMobilePushTokenService(input: { organizationId: string; userId: string; sessionId: string; sessionPlatform: MobilePlatform; token: string; platform: MobilePlatform }) {
  if (!/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(input.token) || input.token.length > 200) throw new Error("Expo push token is invalid.");
  if (input.platform !== input.sessionPlatform) throw new Error("Push-token platform does not match this mobile session.");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.mobilePushToken.findUnique({ where: { token: input.token }, select: { id: true, organizationId: true, userId: true, sessionId: true } });
    if (existing && (existing.organizationId !== input.organizationId || existing.userId !== input.userId || existing.sessionId !== input.sessionId)) {
      await tx.mobilePushDelivery.updateMany({ where: { pushTokenId: existing.id, status: { in: [MobilePushDeliveryStatus.PENDING, MobilePushDeliveryStatus.FAILED, MobilePushDeliveryStatus.SENT] } }, data: { status: MobilePushDeliveryStatus.ABANDONED, error: "Push token was securely reassigned to a different mobile session." } });
    }
    await tx.mobilePushToken.updateMany({ where: { sessionId: input.sessionId, token: { not: input.token } }, data: { enabled: false } });
    const token = await tx.mobilePushToken.upsert({ where: { token: input.token }, update: { organizationId: input.organizationId, userId: input.userId, sessionId: input.sessionId, platform: input.platform, enabled: true, lastRegisteredAt: new Date() }, create: { organizationId: input.organizationId, userId: input.userId, sessionId: input.sessionId, token: input.token, platform: input.platform } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.UPDATE, entityType: "MobilePushToken", entityId: token.id, title: "Native push notifications registered", metadata: { platform: input.platform } } });
    return token;
  });
}

export async function disableMobilePushTokenService(input: { organizationId: string; userId: string; sessionId: string }) {
  return prisma.mobilePushToken.updateMany({ where: { organizationId: input.organizationId, userId: input.userId, sessionId: input.sessionId }, data: { enabled: false } });
}

export async function processMobilePushDeliveries() {
  const now = new Date();
  const receiptResult = await processReceipts(now);
  const due = await prisma.mobilePushDelivery.findMany({ where: { status: { in: [MobilePushDeliveryStatus.PENDING, MobilePushDeliveryStatus.FAILED] }, nextAttemptAt: { lte: now }, pushToken: { enabled: true, session: { status: "ACTIVE", expiresAt: { gt: now } } } }, include: { pushToken: true }, orderBy: { nextAttemptAt: "asc" }, take: 50 });
  const claimed: typeof due = [];
  let abandoned = 0;
  for (const delivery of due) {
    if (!mobilePushIdentityMatches(delivery, delivery.pushToken)) {
      const rejected = await prisma.mobilePushDelivery.updateMany({ where: { id: delivery.id, status: delivery.status }, data: { status: MobilePushDeliveryStatus.ABANDONED, error: "Push-token tenant or user ownership no longer matches this delivery." } });
      abandoned += rejected.count;
      continue;
    }
    const changed = await prisma.mobilePushDelivery.updateMany({ where: { id: delivery.id, status: delivery.status, attemptCount: delivery.attemptCount, nextAttemptAt: { lte: now } }, data: { attemptCount: delivery.attemptCount + 1, lastAttemptAt: now, nextAttemptAt: new Date(now.getTime() + 5 * 60_000) } });
    if (changed.count) claimed.push(delivery);
  }
  if (!claimed.length) return { queued: 0, accepted: 0, failed: 0, abandoned, receipts: receiptResult };
  let accepted = 0, failed = 0;
  try {
    const response = await expoFetch(EXPO_SEND_URL, claimed.map((delivery) => ({ to: delivery.pushToken.token, sound: "default", title: "Senzilytics action required", body: "Open the app to review a new notification.", data: delivery.payload, priority: "high" })));
    const body = await response.json() as { data?: Array<{ status?: string; id?: string; message?: string; details?: { error?: string } }> };
    if (!response.ok || !Array.isArray(body.data) || body.data.length !== claimed.length) throw new Error(`Expo push service returned HTTP ${response.status}.`);
    for (let index = 0; index < claimed.length; index++) {
      const delivery = claimed[index], ticket = body.data[index];
      if (ticket.status === "ok" && ticket.id) { await prisma.mobilePushDelivery.update({ where: { id: delivery.id }, data: { status: MobilePushDeliveryStatus.SENT, ticketId: ticket.id, error: null, nextAttemptAt: new Date(Date.now() + 5 * 60_000) } }); accepted++; }
      else if (ticket.details?.error === "DeviceNotRegistered") { await abandonUnregistered(delivery.id, delivery.pushTokenId, ticket.message); abandoned++; }
      else { const next = nextMobilePushAttempt(delivery.attemptCount + 1, delivery.maxAttempts); await prisma.mobilePushDelivery.update({ where: { id: delivery.id }, data: { ...next, error: (ticket.message || "Expo rejected the push message.").slice(0, 1000) } }); if (next.status === MobilePushDeliveryStatus.ABANDONED) abandoned++; else failed++; }
    }
  } catch (error) {
    for (const delivery of claimed) { const next = nextMobilePushAttempt(delivery.attemptCount + 1, delivery.maxAttempts); await prisma.mobilePushDelivery.update({ where: { id: delivery.id }, data: { ...next, error: error instanceof Error ? error.message.slice(0, 1000) : "Push delivery failed." } }); if (next.status === MobilePushDeliveryStatus.ABANDONED) abandoned++; else failed++; }
  }
  return { queued: claimed.length, accepted, failed, abandoned, receipts: receiptResult };
}

async function processReceipts(now: Date) {
  const deliveries = await prisma.mobilePushDelivery.findMany({ where: { status: MobilePushDeliveryStatus.SENT, ticketId: { not: null }, nextAttemptAt: { lte: now } }, include: { pushToken: true }, take: 50 });
  if (!deliveries.length) return { checked: 0, delivered: 0, failed: 0 };
  try {
    const response = await expoFetch(EXPO_RECEIPT_URL, { ids: deliveries.map((item) => item.ticketId!) });
    const body = await response.json() as { data?: Record<string, { status?: string; message?: string; details?: { error?: string } }> };
    if (!response.ok || !body.data) throw new Error(`Expo receipt service returned HTTP ${response.status}.`);
    let delivered = 0, failed = 0;
    for (const delivery of deliveries) {
      const receipt = body.data[delivery.ticketId!];
      if (!receipt) { await prisma.mobilePushDelivery.update({ where: { id: delivery.id }, data: { nextAttemptAt: new Date(now.getTime() + 15 * 60_000) } }); continue; }
      if (receipt.status === "ok") { await prisma.mobilePushDelivery.update({ where: { id: delivery.id }, data: { status: MobilePushDeliveryStatus.DELIVERED, sentAt: now, error: null } }); delivered++; }
      else if (receipt.details?.error === "DeviceNotRegistered") { await abandonUnregistered(delivery.id, delivery.pushTokenId, receipt.message); failed++; }
      else { await prisma.mobilePushDelivery.update({ where: { id: delivery.id }, data: { status: MobilePushDeliveryStatus.ABANDONED, error: (receipt.message || "Push delivery receipt reported an error.").slice(0, 1000) } }); failed++; }
    }
    return { checked: deliveries.length, delivered, failed };
  } catch (error) {
    await prisma.mobilePushDelivery.updateMany({ where: { id: { in: deliveries.map((item) => item.id) }, status: MobilePushDeliveryStatus.SENT }, data: { nextAttemptAt: new Date(now.getTime() + 15 * 60_000), error: error instanceof Error ? error.message.slice(0, 1000) : "Push receipt check failed." } });
    return { checked: deliveries.length, delivered: 0, failed: deliveries.length };
  }
}

async function abandonUnregistered(deliveryId: string, pushTokenId: string, message?: string) { await prisma.$transaction([prisma.mobilePushDelivery.update({ where: { id: deliveryId }, data: { status: MobilePushDeliveryStatus.ABANDONED, error: (message || "Device is no longer registered for push notifications.").slice(0, 1000) } }), prisma.mobilePushToken.update({ where: { id: pushTokenId }, data: { enabled: false } })]); }
async function expoFetch(url: string, body: unknown) { const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim(); return fetch(url, { method: "POST", signal: AbortSignal.timeout(10_000), headers: { "content-type": "application/json", accept: "application/json", ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) }, body: JSON.stringify(body) }); }
