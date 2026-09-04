ALTER TABLE "ResearchFieldworkResponse"
ADD COLUMN "backcheckEscalationLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "backcheckLastEscalatedAt" TIMESTAMP(3);
