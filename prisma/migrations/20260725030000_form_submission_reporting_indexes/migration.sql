CREATE INDEX "ConfigurableFormSubmission_organizationId_submittedAt_idx"
ON "ConfigurableFormSubmission"("organizationId", "submittedAt");

CREATE INDEX "ConfigurableFormSubmission_organizationId_status_submittedAt_idx"
ON "ConfigurableFormSubmission"("organizationId", "status", "submittedAt");

CREATE INDEX "ConfigurableFormSubmission_organizationId_entityType_submittedAt_idx"
ON "ConfigurableFormSubmission"("organizationId", "entityType", "submittedAt");
