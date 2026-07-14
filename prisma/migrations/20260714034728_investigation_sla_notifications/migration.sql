-- AlterTable
ALTER TABLE "Investigation" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "overdueNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "status" "Status" NOT NULL DEFAULT 'OPEN';

-- CreateIndex
CREATE INDEX "Investigation_status_dueDate_idx" ON "Investigation"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Investigation_assignedToId_idx" ON "Investigation"("assignedToId");

-- AddForeignKey
ALTER TABLE "Investigation" ADD CONSTRAINT "Investigation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
