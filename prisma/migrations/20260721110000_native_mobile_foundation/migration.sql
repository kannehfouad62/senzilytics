CREATE TYPE "MobilePlatform" AS ENUM ('IOS', 'ANDROID');
CREATE TYPE "MobileSessionStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "MobilePushDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'ABANDONED');

CREATE TABLE "MobileAuthChallenge" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "requestFingerprintHash" TEXT NOT NULL,
  "clientState" TEXT NOT NULL,
  "codeChallenge" TEXT NOT NULL,
  "redirectUri" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT,
  "authorizedById" TEXT,
  "authorizationCodeHash" TEXT,
  "authorizedAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MobileAuthChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MobileSession" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "deviceName" TEXT NOT NULL,
  "platform" "MobilePlatform" NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "refreshTokenLastFour" TEXT NOT NULL,
  "status" "MobileSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "userSessionVersion" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MobileSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MobilePushToken" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" "MobilePlatform" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastRegisteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MobilePushToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MobilePushDelivery" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "pushTokenId" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "MobilePushDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 6,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ticketId" TEXT,
  "error" TEXT,
  "lastAttemptAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MobilePushDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobileAuthChallenge_tokenHash_key" ON "MobileAuthChallenge"("tokenHash");
CREATE UNIQUE INDEX "MobileAuthChallenge_authorizationCodeHash_key" ON "MobileAuthChallenge"("authorizationCodeHash");
CREATE INDEX "MobileAuthChallenge_expiresAt_usedAt_idx" ON "MobileAuthChallenge"("expiresAt", "usedAt");
CREATE INDEX "MobileAuthChallenge_requestFingerprintHash_createdAt_idx" ON "MobileAuthChallenge"("requestFingerprintHash", "createdAt");
CREATE UNIQUE INDEX "MobileSession_refreshTokenHash_key" ON "MobileSession"("refreshTokenHash");
CREATE UNIQUE INDEX "MobileSession_userId_deviceId_key" ON "MobileSession"("userId", "deviceId");
CREATE INDEX "MobileSession_organizationId_status_idx" ON "MobileSession"("organizationId", "status");
CREATE INDEX "MobileSession_expiresAt_idx" ON "MobileSession"("expiresAt");
CREATE UNIQUE INDEX "MobilePushToken_token_key" ON "MobilePushToken"("token");
CREATE INDEX "MobilePushToken_userId_enabled_idx" ON "MobilePushToken"("userId", "enabled");
CREATE INDEX "MobilePushToken_organizationId_enabled_idx" ON "MobilePushToken"("organizationId", "enabled");
CREATE UNIQUE INDEX "MobilePushDelivery_pushTokenId_notificationId_key" ON "MobilePushDelivery"("pushTokenId", "notificationId");
CREATE INDEX "MobilePushDelivery_status_nextAttemptAt_idx" ON "MobilePushDelivery"("status", "nextAttemptAt");
CREATE INDEX "MobilePushDelivery_organizationId_createdAt_idx" ON "MobilePushDelivery"("organizationId", "createdAt");

ALTER TABLE "MobileAuthChallenge" ADD CONSTRAINT "MobileAuthChallenge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobileAuthChallenge" ADD CONSTRAINT "MobileAuthChallenge_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MobileSession" ADD CONSTRAINT "MobileSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobileSession" ADD CONSTRAINT "MobileSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobilePushToken" ADD CONSTRAINT "MobilePushToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobilePushToken" ADD CONSTRAINT "MobilePushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobilePushToken" ADD CONSTRAINT "MobilePushToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MobileSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobilePushDelivery" ADD CONSTRAINT "MobilePushDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobilePushDelivery" ADD CONSTRAINT "MobilePushDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobilePushDelivery" ADD CONSTRAINT "MobilePushDelivery_pushTokenId_fkey" FOREIGN KEY ("pushTokenId") REFERENCES "MobilePushToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobilePushDelivery" ADD CONSTRAINT "MobilePushDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
