import { ActivityAction, IntegrationDeliveryStatus, IntegrationWebhookEvent, IntegrationWebhookStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nextWebhookAttempt } from "@/modules/integrations/integration-lifecycle";
import { decryptWebhookSecret, signWebhookPayload, validateWebhookUrl } from "@/modules/integrations/integration-security";

const eventByAction: Partial<Record<ActivityAction, IntegrationWebhookEvent>> = {
  CREATE: IntegrationWebhookEvent.RECORD_CREATED,
  UPDATE: IntegrationWebhookEvent.RECORD_UPDATED,
  STATUS_CHANGE: IntegrationWebhookEvent.RECORD_STATUS_CHANGED,
  ASSIGN: IntegrationWebhookEvent.RECORD_ASSIGNED,
  DELETE: IntegrationWebhookEvent.RECORD_DELETED,
  COMMENT: IntegrationWebhookEvent.RECORD_UPDATED,
  SYSTEM: IntegrationWebhookEvent.SYSTEM_EVENT,
};

type WebhookActivity = { id: string; organizationId: string; action: ActivityAction; entityType: string; entityId: string | null; title: string; createdAt: Date };

export async function enqueueActivityWebhooks(activity: WebhookActivity) {
  const event = eventByAction[activity.action];
  if (!event || activity.entityType.startsWith("Integration")) return 0;
  const endpoints = await prisma.integrationWebhookEndpoint.findMany({ where: { organizationId: activity.organizationId, status: IntegrationWebhookStatus.ACTIVE, events: { has: event } }, select: { id: true } });
  if (!endpoints.length) return 0;
  const payload: Prisma.InputJsonValue = { schemaVersion: "2026-07-21", id: activity.id, organizationId: activity.organizationId, event, entity: { type: activity.entityType, id: activity.entityId }, title: activity.title, occurredAt: activity.createdAt.toISOString() };
  const result = await prisma.integrationWebhookDelivery.createMany({ data: endpoints.map((endpoint) => ({ organizationId: activity.organizationId, endpointId: endpoint.id, activityId: activity.id, event, payload })), skipDuplicates: true });
  return result.count;
}

export async function processIntegrationWebhookDeliveries() {
  const now = new Date();
  const due = await prisma.integrationWebhookDelivery.findMany({ where: { status: { in: [IntegrationDeliveryStatus.PENDING, IntegrationDeliveryStatus.FAILED] }, nextAttemptAt: { lte: now }, endpoint: { status: IntegrationWebhookStatus.ACTIVE } }, include: { endpoint: true }, orderBy: { nextAttemptAt: "asc" }, take: 25 });
  let delivered = 0, failed = 0, abandoned = 0;
  for (let offset = 0; offset < due.length; offset += 10) {
    const outcomes = await Promise.all(due.slice(offset, offset + 10).map(async (delivery) => {
      const attempt = delivery.attemptCount + 1;
      const claimed = await prisma.integrationWebhookDelivery.updateMany({ where: { id: delivery.id, attemptCount: delivery.attemptCount, status: delivery.status, nextAttemptAt: { lte: now } }, data: { attemptCount: attempt, lastAttemptAt: now, nextAttemptAt: new Date(now.getTime() + 300_000) } });
      if (!claimed.count) return "skipped" as const;
      try {
        const url = await validateWebhookUrl(delivery.endpoint.url);
        const body = JSON.stringify(delivery.payload);
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const secret = decryptWebhookSecret(delivery.endpoint.encryptedSecret);
        const response = await fetch(url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000), headers: { "content-type": "application/json", "user-agent": "Senzilytics-Webhooks/1.0", "senzilytics-event": delivery.event, "senzilytics-delivery": delivery.id, "senzilytics-timestamp": timestamp, "senzilytics-signature": signWebhookPayload(secret, timestamp, body) }, body });
        const responseBody = await readResponseSnippet(response);
        if (!response.ok) throw Object.assign(new Error(`Endpoint returned HTTP ${response.status}.`), { responseStatus: response.status, responseBody });
        await prisma.integrationWebhookDelivery.update({ where: { id: delivery.id }, data: { status: IntegrationDeliveryStatus.DELIVERED, deliveredAt: new Date(), responseStatus: response.status, responseBody, error: null } });
        return "delivered" as const;
      } catch (error) {
        const next = nextWebhookAttempt(attempt, delivery.maxAttempts);
        await prisma.integrationWebhookDelivery.update({ where: { id: delivery.id }, data: { ...next, responseStatus: getErrorNumber(error, "responseStatus"), responseBody: getErrorString(error, "responseBody")?.slice(0, 2_000), error: error instanceof Error ? error.message.slice(0, 1_000) : "Webhook delivery failed." } });
        return next.status === IntegrationDeliveryStatus.ABANDONED ? "abandoned" as const : "failed" as const;
      }
    }));
    for (const outcome of outcomes) {
      if (outcome === "delivered") delivered++;
      else if (outcome === "abandoned") abandoned++;
      else if (outcome === "failed") failed++;
    }
  }
  return { examined: due.length, delivered, failed, abandoned };
}

function getErrorNumber(error: unknown, key: string) { return typeof error === "object" && error !== null && key in error && typeof (error as Record<string, unknown>)[key] === "number" ? (error as Record<string, number>)[key] : null; }
function getErrorString(error: unknown, key: string) { return typeof error === "object" && error !== null && key in error && typeof (error as Record<string, unknown>)[key] === "string" ? (error as Record<string, string>)[key] : null; }

async function readResponseSnippet(response: Response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (length < 2_000) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = 2_000 - length;
    const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value;
    chunks.push(chunk);
    length += chunk.byteLength;
    if (value.byteLength > remaining) { await reader.cancel(); break; }
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
