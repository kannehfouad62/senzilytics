ALTER TABLE "EsgDisclosurePeriod" ADD COLUMN "publishedById" TEXT;
ALTER TABLE "EsgDisclosurePeriod" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "EsgDataPoint" ADD COLUMN "isAutoCalculated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EsgDataPoint" ADD COLUMN "sourceRecordCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EsgDisclosurePeriod" ADD CONSTRAINT "EsgDisclosurePeriod_publishedById_fkey" FOREIGN KEY("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
