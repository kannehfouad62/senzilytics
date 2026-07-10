-- AlterTable
ALTER TABLE "WorkflowTemplateStep" ADD COLUMN     "approveNextStepId" TEXT,
ADD COLUMN     "rejectNextStepId" TEXT;

-- AddForeignKey
ALTER TABLE "WorkflowTemplateStep" ADD CONSTRAINT "WorkflowTemplateStep_approveNextStepId_fkey" FOREIGN KEY ("approveNextStepId") REFERENCES "WorkflowTemplateStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTemplateStep" ADD CONSTRAINT "WorkflowTemplateStep_rejectNextStepId_fkey" FOREIGN KEY ("rejectNextStepId") REFERENCES "WorkflowTemplateStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
