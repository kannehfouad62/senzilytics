ALTER TABLE "ResearchSampleUnit"
ADD COLUMN "assignedToId" TEXT,
ADD COLUMN "assignedAt" TIMESTAMP(3),
ADD COLUMN "dueAt" TIMESTAMP(3),
ADD COLUMN "lastContactedAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "contactAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "dispositionNote" TEXT,
ADD COLUMN "replacementForId" TEXT,
ADD COLUMN "escalationLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastEscalatedAt" TIMESTAMP(3);

CREATE INDEX "ResearchSampleUnit_assignedToId_status_dueAt_idx" ON "ResearchSampleUnit"("assignedToId", "status", "dueAt");
CREATE INDEX "ResearchSampleUnit_executionId_dueAt_escalationLevel_idx" ON "ResearchSampleUnit"("executionId", "dueAt", "escalationLevel");
CREATE INDEX "ResearchSampleUnit_replacementForId_idx" ON "ResearchSampleUnit"("replacementForId");

ALTER TABLE "ResearchSampleUnit" ADD CONSTRAINT "ResearchSampleUnit_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchSampleUnit" ADD CONSTRAINT "ResearchSampleUnit_replacementForId_fkey" FOREIGN KEY ("replacementForId") REFERENCES "ResearchSampleUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
