-- CreateIndex
CREATE INDEX "WorkflowTemplate_organizationId_entityType_isActive_idx" ON "WorkflowTemplate"("organizationId", "entityType", "isActive");
