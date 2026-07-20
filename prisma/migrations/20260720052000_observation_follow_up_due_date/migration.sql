ALTER TABLE "SafetyObservation" ADD COLUMN "followUpDueDate" TIMESTAMP(3);

CREATE INDEX "SafetyObservation_organizationId_followUpDueDate_idx"
ON "SafetyObservation"("organizationId", "followUpDueDate");
