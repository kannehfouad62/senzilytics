/*
  Warnings:

  - The required column `versionGroupId` was added to the `Document` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "Document"
ADD COLUMN "isLatest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "versionGroupId" TEXT;

UPDATE "Document"
SET "versionGroupId" = "id"
WHERE "versionGroupId" IS NULL;

ALTER TABLE "Document"
ALTER COLUMN "versionGroupId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Document_organizationId_versionGroupId_version_idx" ON "Document"("organizationId", "versionGroupId", "version");
