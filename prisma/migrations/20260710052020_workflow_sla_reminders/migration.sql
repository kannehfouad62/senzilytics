-- AlterTable
ALTER TABLE "WorkflowInstanceStep" ADD COLUMN     "escalationSentAt" TIMESTAMP(3),
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);
