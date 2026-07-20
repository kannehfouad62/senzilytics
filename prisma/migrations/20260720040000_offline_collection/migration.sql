CREATE TABLE "OfflineSubmission" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "userId" TEXT NOT NULL, "recordType" TEXT NOT NULL, "recordId" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL, "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "payloadHash" TEXT NOT NULL,
  CONSTRAINT "OfflineSubmission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OfflineSubmission_organizationId_syncedAt_idx" ON "OfflineSubmission"("organizationId", "syncedAt");
CREATE INDEX "OfflineSubmission_userId_capturedAt_idx" ON "OfflineSubmission"("userId", "capturedAt");
ALTER TABLE "OfflineSubmission" ADD CONSTRAINT "OfflineSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfflineSubmission" ADD CONSTRAINT "OfflineSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
