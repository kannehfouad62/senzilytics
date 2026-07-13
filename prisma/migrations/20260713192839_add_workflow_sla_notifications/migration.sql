-- AlterTable
ALTER TABLE "WorkflowInstanceStep" ADD COLUMN     "overdueNotifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "WorkflowInstanceStep_status_dueAt_idx" ON "WorkflowInstanceStep"("status", "dueAt");
