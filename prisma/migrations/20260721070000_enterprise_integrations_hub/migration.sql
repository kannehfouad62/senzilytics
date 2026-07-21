ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'MANAGE_INTEGRATIONS';

CREATE TYPE "IntegrationApiScope" AS ENUM ('READ_INCIDENTS', 'READ_ACTIONS', 'READ_AUDITS', 'READ_INSPECTIONS', 'READ_RISKS', 'READ_COMPLIANCE', 'READ_TRAINING', 'READ_ASSURANCE');
CREATE TYPE "IntegrationCredentialStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "IntegrationWebhookStatus" AS ENUM ('ACTIVE', 'PAUSED', 'REVOKED');
CREATE TYPE "IntegrationWebhookEvent" AS ENUM ('RECORD_CREATED', 'RECORD_UPDATED', 'RECORD_STATUS_CHANGED', 'RECORD_ASSIGNED', 'RECORD_DELETED', 'SYSTEM_EVENT');
CREATE TYPE "IntegrationDeliveryStatus" AS ENUM ('PENDING', 'FAILED', 'DELIVERED', 'ABANDONED');

CREATE TABLE "IntegrationApiCredential" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tokenPrefix" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenLastFour" TEXT NOT NULL,
  "scopes" "IntegrationApiScope"[],
  "status" "IntegrationCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
  "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 120,
  "expiresAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "revokedById" TEXT,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationApiCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationApiRequestLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationApiRequestLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationWebhookEndpoint" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "status" "IntegrationWebhookStatus" NOT NULL DEFAULT 'ACTIVE',
  "events" "IntegrationWebhookEvent"[],
  "encryptedSecret" TEXT NOT NULL,
  "secretLastFour" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "rotatedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationWebhookEndpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationWebhookDelivery" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "endpointId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "event" "IntegrationWebhookEvent" NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "IntegrationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 7,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "responseStatus" INTEGER,
  "responseBody" TEXT,
  "error" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationWebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationApiCredential_tokenPrefix_key" ON "IntegrationApiCredential"("tokenPrefix");
CREATE INDEX "IntegrationApiCredential_organizationId_status_idx" ON "IntegrationApiCredential"("organizationId", "status");
CREATE INDEX "IntegrationApiCredential_expiresAt_idx" ON "IntegrationApiCredential"("expiresAt");
CREATE UNIQUE INDEX "IntegrationApiRequestLog_requestId_key" ON "IntegrationApiRequestLog"("requestId");
CREATE INDEX "IntegrationApiRequestLog_credentialId_createdAt_idx" ON "IntegrationApiRequestLog"("credentialId", "createdAt");
CREATE INDEX "IntegrationApiRequestLog_organizationId_createdAt_idx" ON "IntegrationApiRequestLog"("organizationId", "createdAt");
CREATE INDEX "IntegrationWebhookEndpoint_organizationId_status_idx" ON "IntegrationWebhookEndpoint"("organizationId", "status");
CREATE UNIQUE INDEX "IntegrationWebhookDelivery_endpointId_activityId_key" ON "IntegrationWebhookDelivery"("endpointId", "activityId");
CREATE INDEX "IntegrationWebhookDelivery_status_nextAttemptAt_idx" ON "IntegrationWebhookDelivery"("status", "nextAttemptAt");
CREATE INDEX "IntegrationWebhookDelivery_organizationId_createdAt_idx" ON "IntegrationWebhookDelivery"("organizationId", "createdAt");

ALTER TABLE "IntegrationApiCredential" ADD CONSTRAINT "IntegrationApiCredential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationApiCredential" ADD CONSTRAINT "IntegrationApiCredential_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IntegrationApiCredential" ADD CONSTRAINT "IntegrationApiCredential_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IntegrationApiRequestLog" ADD CONSTRAINT "IntegrationApiRequestLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationApiRequestLog" ADD CONSTRAINT "IntegrationApiRequestLog_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "IntegrationApiCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationWebhookEndpoint" ADD CONSTRAINT "IntegrationWebhookEndpoint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationWebhookEndpoint" ADD CONSTRAINT "IntegrationWebhookEndpoint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IntegrationWebhookEndpoint" ADD CONSTRAINT "IntegrationWebhookEndpoint_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IntegrationWebhookDelivery" ADD CONSTRAINT "IntegrationWebhookDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationWebhookDelivery" ADD CONSTRAINT "IntegrationWebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "IntegrationWebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationWebhookDelivery" ADD CONSTRAINT "IntegrationWebhookDelivery_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ActivityLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
