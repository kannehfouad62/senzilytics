-- CreateEnum
CREATE TYPE "WorkflowDecision" AS ENUM ('APPROVE', 'REJECT', 'SKIP');

-- AlterEnum
ALTER TYPE "WorkflowStepStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "WorkflowInstanceStep" ADD COLUMN     "comments" TEXT,
ADD COLUMN     "completedById" TEXT,
ADD COLUMN     "decision" "WorkflowDecision";

-- AddForeignKey
ALTER TABLE "WorkflowInstanceStep" ADD CONSTRAINT "WorkflowInstanceStep_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
