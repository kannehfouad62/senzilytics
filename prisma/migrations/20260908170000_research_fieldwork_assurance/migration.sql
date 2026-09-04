ALTER TYPE "ResearchFieldworkBackcheckStatus" ADD VALUE 'RECONTACT_REQUIRED';

ALTER TABLE "ResearchFieldworkResponse"
ADD COLUMN "backcheckRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "backcheckSelectedAt" TIMESTAMP(3),
ADD COLUMN "backcheckDueAt" TIMESTAMP(3);

CREATE INDEX "ResearchFieldworkResponse_organizationId_backcheckRequired_backcheckDueAt_idx"
ON "ResearchFieldworkResponse"("organizationId", "backcheckRequired", "backcheckDueAt");
