ALTER TABLE "TrainingRequirement" ADD COLUMN "renewalLeadDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "TrainingRecord" ADD COLUMN "requirementId" TEXT;
ALTER TABLE "TrainingRecord" ADD COLUMN "generationKey" TEXT;
ALTER TABLE "TrainingRecord" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "TrainingRecord_generationKey_key" ON "TrainingRecord"("generationKey");
CREATE INDEX "TrainingRecord_requirementId_status_idx" ON "TrainingRecord"("requirementId", "status");
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "TrainingRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
