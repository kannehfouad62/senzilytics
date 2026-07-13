-- AlterTable
ALTER TABLE "CorrectiveAction" ADD COLUMN     "overdueNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CorrectiveAction_status_dueDate_idx" ON "CorrectiveAction"("status", "dueDate");
