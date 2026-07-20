CREATE TYPE "ConfigurableFormModule" AS ENUM ('OBSERVATION', 'INCIDENT', 'AUDIT', 'INSPECTION', 'CAPA', 'RISK', 'MOC', 'COMPLIANCE', 'TRAINING', 'CONTRACTOR', 'PERMIT_TO_WORK', 'GENERAL');
CREATE TYPE "ConfigurableFormVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ConfigurableFieldType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'DATE', 'DATETIME', 'BOOLEAN', 'SINGLE_SELECT', 'MULTI_SELECT', 'EMAIL', 'PHONE', 'FILE', 'SIGNATURE');

CREATE TABLE "ConfigurableFormDefinition" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "module" "ConfigurableFormModule" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConfigurableFormDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConfigurableFormVersion" (
  "id" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "ConfigurableFormVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "instructions" TEXT,
  "createdById" TEXT NOT NULL,
  "publishedById" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConfigurableFormVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConfigurableFormField" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "placeholder" TEXT,
  "fieldType" "ConfigurableFieldType" NOT NULL,
  "sequence" INTEGER NOT NULL,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "options" JSONB,
  "validation" JSONB,
  "visibilityRule" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConfigurableFormField_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConfigurableFormDefinition_organizationId_slug_key" ON "ConfigurableFormDefinition"("organizationId", "slug");
CREATE INDEX "ConfigurableFormDefinition_organizationId_module_isActive_idx" ON "ConfigurableFormDefinition"("organizationId", "module", "isActive");
CREATE UNIQUE INDEX "ConfigurableFormVersion_definitionId_version_key" ON "ConfigurableFormVersion"("definitionId", "version");
CREATE INDEX "ConfigurableFormVersion_definitionId_status_idx" ON "ConfigurableFormVersion"("definitionId", "status");
CREATE UNIQUE INDEX "ConfigurableFormField_versionId_key_key" ON "ConfigurableFormField"("versionId", "key");
CREATE UNIQUE INDEX "ConfigurableFormField_versionId_sequence_key" ON "ConfigurableFormField"("versionId", "sequence");
CREATE INDEX "ConfigurableFormField_versionId_fieldType_idx" ON "ConfigurableFormField"("versionId", "fieldType");

ALTER TABLE "ConfigurableFormDefinition" ADD CONSTRAINT "ConfigurableFormDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConfigurableFormDefinition" ADD CONSTRAINT "ConfigurableFormDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConfigurableFormVersion" ADD CONSTRAINT "ConfigurableFormVersion_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "ConfigurableFormDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConfigurableFormVersion" ADD CONSTRAINT "ConfigurableFormVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConfigurableFormVersion" ADD CONSTRAINT "ConfigurableFormVersion_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConfigurableFormField" ADD CONSTRAINT "ConfigurableFormField_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ConfigurableFormVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
