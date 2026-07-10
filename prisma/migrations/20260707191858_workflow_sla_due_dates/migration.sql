-- AlterTable
ALTER TABLE "WorkflowInstanceStep" ADD COLUMN     "dueAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WorkflowTemplateStep" ADD COLUMN     "slaHours" INTEGER;
