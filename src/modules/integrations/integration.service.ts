import { randomUUID } from "node:crypto";
import {
  ActivityAction,
  IntegrationApiScope,
  IntegrationCredentialStatus,
  IntegrationDeliveryStatus,
  IntegrationWebhookEvent,
  IntegrationWebhookStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  encryptWebhookSecret,
  generateApiCredential,
  generateWebhookSecret,
  parseApiCredential,
  secureTokenMatch,
  validateWebhookUrl,
} from "@/modules/integrations/integration-security";

export class IntegrationApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) { super(message); }
}

export async function listIntegrationWorkspaceService(organizationId: string) {
  const [credentials, endpoints, deliveries, requestCount] = await Promise.all([
    prisma.integrationApiCredential.findMany({ where: { organizationId }, include: { createdBy: { select: { name: true } }, revokedBy: { select: { name: true } }, _count: { select: { requestLogs: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.integrationWebhookEndpoint.findMany({ where: { organizationId }, include: { createdBy: { select: { name: true } }, _count: { select: { deliveries: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.integrationWebhookDelivery.findMany({ where: { organizationId }, include: { endpoint: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.integrationApiRequestLog.count({ where: { organizationId, createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
  ]);
  return { credentials, endpoints, deliveries, requestCount };
}

export async function createApiCredentialService(input: { organizationId: string; userId: string; name: string; scopes: IntegrationApiScope[]; rateLimitPerMinute: number; expiresAt?: Date | null }) {
  if (!input.name.trim()) throw new Error("Credential name is required.");
  if (!input.scopes.length) throw new Error("Select at least one API scope.");
  if (input.rateLimitPerMinute < 10 || input.rateLimitPerMinute > 600) throw new Error("Rate limit must be between 10 and 600 requests per minute.");
  if (input.expiresAt && (Number.isNaN(input.expiresAt.getTime()) || input.expiresAt <= new Date())) throw new Error("Expiration must be a valid future date.");
  const generated = generateApiCredential();
  const credential = await prisma.integrationApiCredential.create({ data: { organizationId: input.organizationId, createdById: input.userId, name: input.name.trim(), scopes: input.scopes, rateLimitPerMinute: input.rateLimitPerMinute, expiresAt: input.expiresAt, tokenPrefix: generated.prefix, tokenHash: generated.hash, tokenLastFour: generated.lastFour } });
  await recordIntegrationActivity(input.organizationId, input.userId, ActivityAction.CREATE, "IntegrationApiCredential", credential.id, `Created API credential ${credential.name}`);
  return { credential, secret: generated.token };
}

export async function revokeApiCredentialService(input: { organizationId: string; userId: string; credentialId: string }) {
  const credential = await prisma.integrationApiCredential.findFirst({ where: { id: input.credentialId, organizationId: input.organizationId } });
  if (!credential) throw new Error("API credential was not found.");
  if (credential.status === IntegrationCredentialStatus.REVOKED) return credential;
  const updated = await prisma.integrationApiCredential.update({ where: { id: credential.id }, data: { status: IntegrationCredentialStatus.REVOKED, revokedAt: new Date(), revokedById: input.userId } });
  await recordIntegrationActivity(input.organizationId, input.userId, ActivityAction.STATUS_CHANGE, "IntegrationApiCredential", credential.id, `Revoked API credential ${credential.name}`);
  return updated;
}

export async function createWebhookEndpointService(input: { organizationId: string; userId: string; name: string; url: string; events: IntegrationWebhookEvent[] }) {
  if (!input.name.trim()) throw new Error("Webhook name is required.");
  if (!input.events.length) throw new Error("Select at least one webhook event.");
  const url = await validateWebhookUrl(input.url);
  const secret = generateWebhookSecret();
  const endpoint = await prisma.integrationWebhookEndpoint.create({ data: { organizationId: input.organizationId, createdById: input.userId, name: input.name.trim(), url, events: input.events, encryptedSecret: encryptWebhookSecret(secret), secretLastFour: secret.slice(-4) } });
  await recordIntegrationActivity(input.organizationId, input.userId, ActivityAction.CREATE, "IntegrationWebhookEndpoint", endpoint.id, `Created webhook ${endpoint.name}`);
  return { endpoint, secret };
}

export async function updateWebhookStatusService(input: { organizationId: string; userId: string; endpointId: string; status: IntegrationWebhookStatus }) {
  const endpoint = await prisma.integrationWebhookEndpoint.findFirst({ where: { id: input.endpointId, organizationId: input.organizationId } });
  if (!endpoint) throw new Error("Webhook endpoint was not found.");
  if (endpoint.status === IntegrationWebhookStatus.REVOKED) throw new Error("A revoked webhook cannot be changed.");
  if (input.status === IntegrationWebhookStatus.REVOKED) throw new Error("Use the revoke action to revoke this webhook.");
  const updated = await prisma.integrationWebhookEndpoint.update({ where: { id: endpoint.id }, data: { status: input.status } });
  await recordIntegrationActivity(input.organizationId, input.userId, ActivityAction.STATUS_CHANGE, "IntegrationWebhookEndpoint", endpoint.id, `${input.status === IntegrationWebhookStatus.ACTIVE ? "Activated" : "Paused"} webhook ${endpoint.name}`);
  return updated;
}

export async function rotateWebhookSecretService(input: { organizationId: string; userId: string; endpointId: string }) {
  const endpoint = await prisma.integrationWebhookEndpoint.findFirst({ where: { id: input.endpointId, organizationId: input.organizationId, status: { not: IntegrationWebhookStatus.REVOKED } } });
  if (!endpoint) throw new Error("Active or paused webhook endpoint was not found.");
  const secret = generateWebhookSecret();
  await prisma.integrationWebhookEndpoint.update({ where: { id: endpoint.id }, data: { encryptedSecret: encryptWebhookSecret(secret), secretLastFour: secret.slice(-4), rotatedAt: new Date() } });
  await recordIntegrationActivity(input.organizationId, input.userId, ActivityAction.UPDATE, "IntegrationWebhookEndpoint", endpoint.id, `Rotated signing secret for webhook ${endpoint.name}`);
  return { endpointId: endpoint.id, secret };
}

export async function revokeWebhookEndpointService(input: { organizationId: string; userId: string; endpointId: string }) {
  const endpoint = await prisma.integrationWebhookEndpoint.findFirst({ where: { id: input.endpointId, organizationId: input.organizationId } });
  if (!endpoint) throw new Error("Webhook endpoint was not found.");
  if (endpoint.status === IntegrationWebhookStatus.REVOKED) return endpoint;
  const updated = await prisma.integrationWebhookEndpoint.update({ where: { id: endpoint.id }, data: { status: IntegrationWebhookStatus.REVOKED, revokedAt: new Date(), revokedById: input.userId } });
  await recordIntegrationActivity(input.organizationId, input.userId, ActivityAction.STATUS_CHANGE, "IntegrationWebhookEndpoint", endpoint.id, `Revoked webhook ${endpoint.name}`);
  return updated;
}

export async function retryWebhookDeliveryService(input: { organizationId: string; userId: string; deliveryId: string }) {
  const delivery = await prisma.integrationWebhookDelivery.findFirst({ where: { id: input.deliveryId, organizationId: input.organizationId }, include: { endpoint: true } });
  if (!delivery) throw new Error("Webhook delivery was not found.");
  if (delivery.endpoint.status !== IntegrationWebhookStatus.ACTIVE) throw new Error("Activate the webhook endpoint before retrying this delivery.");
  if (delivery.status === IntegrationDeliveryStatus.DELIVERED) throw new Error("A delivered webhook cannot be retried.");
  const updated = await prisma.integrationWebhookDelivery.update({ where: { id: delivery.id }, data: { status: IntegrationDeliveryStatus.PENDING, attemptCount: 0, nextAttemptAt: new Date(), responseStatus: null, responseBody: null, error: null, deliveredAt: null, lastAttemptAt: null } });
  await recordIntegrationActivity(input.organizationId, input.userId, ActivityAction.UPDATE, "IntegrationWebhookDelivery", delivery.id, `Requeued webhook delivery for ${delivery.endpoint.name}`);
  return updated;
}

export async function authenticateIntegrationRequest(request: Request, requiredScope: IntegrationApiScope) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new IntegrationApiError("Bearer API credential is required.", 401, "unauthorized");
  const parsed = parseApiCredential(authorization.slice(7));
  if (!parsed) throw new IntegrationApiError("API credential is invalid.", 401, "unauthorized");
  const credential = await prisma.integrationApiCredential.findUnique({ where: { tokenPrefix: parsed.prefix } });
  if (!credential || !secureTokenMatch(parsed.token, credential.tokenHash) || credential.status !== IntegrationCredentialStatus.ACTIVE) throw new IntegrationApiError("API credential is invalid or revoked.", 401, "unauthorized");
  if (credential.expiresAt && credential.expiresAt <= new Date()) throw new IntegrationApiError("API credential has expired.", 401, "credential_expired");
  if (!credential.scopes.includes(requiredScope)) throw new IntegrationApiError("API credential does not include the required scope.", 403, "insufficient_scope");
  const since = new Date(Date.now() - 60_000);
  const requests = await prisma.integrationApiRequestLog.count({ where: { credentialId: credential.id, createdAt: { gte: since } } });
  if (requests >= credential.rateLimitPerMinute) {
    await prisma.integrationApiRequestLog.create({ data: { organizationId: credential.organizationId, credentialId: credential.id, requestId: randomUUID(), route: new URL(request.url).pathname, method: request.method, statusCode: 429, durationMs: 0 } });
    throw new IntegrationApiError("API rate limit exceeded.", 429, "rate_limit_exceeded");
  }
  await prisma.integrationApiCredential.update({ where: { id: credential.id }, data: { lastUsedAt: new Date() } });
  const suppliedRequestId = request.headers.get("x-request-id")?.trim();
  const requestId = suppliedRequestId && /^[A-Za-z0-9._:-]{1,100}$/.test(suppliedRequestId) ? suppliedRequestId : randomUUID();
  return { credential, requestId };
}

export async function logIntegrationRequest(input: { organizationId: string; credentialId: string; requestId: string; route: string; method: string; statusCode: number; durationMs: number }) {
  await prisma.integrationApiRequestLog.create({ data: input }).catch((error) => console.error("Integration request audit logging failed:", error));
}

async function recordIntegrationActivity(organizationId: string, userId: string, action: ActivityAction, entityType: string, entityId: string, title: string) {
  return prisma.activityLog.create({ data: { organizationId, userId, action, entityType, entityId, title, metadata: Prisma.JsonNull } });
}
