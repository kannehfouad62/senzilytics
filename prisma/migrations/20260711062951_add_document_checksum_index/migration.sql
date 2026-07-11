-- CreateIndex
CREATE INDEX "Document_organizationId_checksum_idx" ON "Document"("organizationId", "checksum");
