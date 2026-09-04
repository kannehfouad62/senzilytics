ALTER TABLE "ResearchFieldworkResponse"
ADD COLUMN "backcheckAssignedToId" TEXT;

CREATE INDEX "ResearchFieldworkResponse_backcheckAssignedToId_backcheckStatus_backcheckDueAt_idx"
ON "ResearchFieldworkResponse"("backcheckAssignedToId", "backcheckStatus", "backcheckDueAt");

ALTER TABLE "ResearchFieldworkResponse"
ADD CONSTRAINT "ResearchFieldworkResponse_backcheckAssignedToId_fkey"
FOREIGN KEY ("backcheckAssignedToId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
