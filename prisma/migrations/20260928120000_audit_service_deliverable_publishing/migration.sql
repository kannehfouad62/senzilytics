ALTER TABLE "AuditServiceExternalAccess" ADD COLUMN "deliverableId" TEXT;

CREATE TABLE "AuditServiceDeliverableDownload" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "deliverableId" TEXT NOT NULL,
  "accessId" TEXT,
  "representativeName" TEXT,
  "representativeEmail" TEXT,
  "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditServiceDeliverableDownload_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditServiceExternalAccess_deliverableId_idx" ON "AuditServiceExternalAccess"("deliverableId");
CREATE INDEX "AuditServiceDeliverableDownload_organizationId_downloadedAt_idx" ON "AuditServiceDeliverableDownload"("organizationId", "downloadedAt");
CREATE INDEX "AuditServiceDeliverableDownload_deliverableId_downloadedAt_idx" ON "AuditServiceDeliverableDownload"("deliverableId", "downloadedAt");
CREATE INDEX "AuditServiceDeliverableDownload_accessId_idx" ON "AuditServiceDeliverableDownload"("accessId");

ALTER TABLE "AuditServiceExternalAccess" ADD CONSTRAINT "AuditServiceExternalAccess_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "AuditServiceDeliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditServiceDeliverableDownload" ADD CONSTRAINT "AuditServiceDeliverableDownload_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditServiceDeliverableDownload" ADD CONSTRAINT "AuditServiceDeliverableDownload_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "AuditServiceDeliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditServiceDeliverableDownload" ADD CONSTRAINT "AuditServiceDeliverableDownload_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "AuditServiceExternalAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
