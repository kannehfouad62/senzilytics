CREATE TYPE "ResearchDataLifecycleStatus" AS ENUM ('DRAFT','ACTIVE','LEGAL_HOLD','DISPOSAL_DUE','DISPOSED');
CREATE TYPE "ResearchDataDisposalMethod" AS ENUM ('SECURE_DELETION','ANONYMIZED_ARCHIVE','RETURN_TO_OWNER','CONTRACTUAL_TRANSFER');
CREATE TYPE "ResearchPrivacyReviewType" AS ENUM ('DEIDENTIFICATION','DISCLOSURE_RISK');
CREATE TYPE "ResearchPrivacyReviewStatus" AS ENUM ('DRAFT','UNDER_REVIEW','APPROVED','REJECTED');
CREATE TYPE "ResearchDisclosureRisk" AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
CREATE TYPE "ResearchDatasetAccessLevel" AS ENUM ('METADATA_ONLY','DEIDENTIFIED','ROW_LEVEL','IDENTIFIABLE');
CREATE TYPE "ResearchDatasetAccessStatus" AS ENUM ('PENDING','APPROVED','REJECTED','REVOKED','EXPIRED');

CREATE TABLE "ResearchDataLifecyclePlan" ("id" TEXT NOT NULL,"organizationId" TEXT NOT NULL,"projectId" TEXT NOT NULL,"status" "ResearchDataLifecycleStatus" NOT NULL DEFAULT 'DRAFT',"retentionBasis" TEXT NOT NULL,"retentionDays" INTEGER NOT NULL,"disposalMethod" "ResearchDataDisposalMethod" NOT NULL,"scheduledDisposalAt" TIMESTAMP(3) NOT NULL,"ownerId" TEXT NOT NULL,"approvedById" TEXT,"approvedAt" TIMESTAMP(3),"legalHoldReason" TEXT,"legalHoldAt" TIMESTAMP(3),"disposalEvidence" TEXT,"disposedById" TEXT,"disposedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "ResearchDataLifecyclePlan_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ResearchDataLifecyclePlan_projectId_key" ON "ResearchDataLifecyclePlan"("projectId");
CREATE INDEX "ResearchDataLifecyclePlan_organizationId_status_scheduledDisposalAt_idx" ON "ResearchDataLifecyclePlan"("organizationId","status","scheduledDisposalAt");
CREATE INDEX "ResearchDataLifecyclePlan_ownerId_status_idx" ON "ResearchDataLifecyclePlan"("ownerId","status");

CREATE TABLE "ResearchPrivacyReview" ("id" TEXT NOT NULL,"organizationId" TEXT NOT NULL,"projectId" TEXT NOT NULL,"datasetReference" TEXT NOT NULL,"type" "ResearchPrivacyReviewType" NOT NULL,"version" INTEGER NOT NULL DEFAULT 1,"status" "ResearchPrivacyReviewStatus" NOT NULL DEFAULT 'DRAFT',"method" TEXT NOT NULL,"directIdentifiersRemoved" BOOLEAN NOT NULL DEFAULT false,"quasiIdentifierControls" TEXT,"residualRisk" "ResearchDisclosureRisk" NOT NULL,"findings" TEXT NOT NULL,"mitigation" TEXT,"evidenceReference" TEXT NOT NULL,"createdById" TEXT NOT NULL,"reviewedById" TEXT,"submittedAt" TIMESTAMP(3),"reviewedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "ResearchPrivacyReview_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ResearchPrivacyReview_projectId_datasetReference_type_version_key" ON "ResearchPrivacyReview"("projectId","datasetReference","type","version");
CREATE INDEX "ResearchPrivacyReview_organizationId_status_residualRisk_idx" ON "ResearchPrivacyReview"("organizationId","status","residualRisk");
CREATE INDEX "ResearchPrivacyReview_projectId_type_status_idx" ON "ResearchPrivacyReview"("projectId","type","status");

CREATE TABLE "ResearchDatasetAccessRequest" ("id" TEXT NOT NULL,"organizationId" TEXT NOT NULL,"projectId" TEXT NOT NULL,"datasetReference" TEXT NOT NULL,"accessLevel" "ResearchDatasetAccessLevel" NOT NULL,"purpose" TEXT NOT NULL,"scope" TEXT NOT NULL,"safeguards" TEXT NOT NULL,"requestedById" TEXT NOT NULL,"status" "ResearchDatasetAccessStatus" NOT NULL DEFAULT 'PENDING',"decidedById" TEXT,"decisionReason" TEXT,"accessStartsAt" TIMESTAMP(3),"accessExpiresAt" TIMESTAMP(3),"decidedAt" TIMESTAMP(3),"revokedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "ResearchDatasetAccessRequest_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ResearchDatasetAccessRequest_organizationId_status_accessExpiresAt_idx" ON "ResearchDatasetAccessRequest"("organizationId","status","accessExpiresAt");
CREATE INDEX "ResearchDatasetAccessRequest_projectId_datasetReference_status_idx" ON "ResearchDatasetAccessRequest"("projectId","datasetReference","status");
CREATE INDEX "ResearchDatasetAccessRequest_requestedById_status_idx" ON "ResearchDatasetAccessRequest"("requestedById","status");

ALTER TABLE "ResearchDataLifecyclePlan" ADD CONSTRAINT "ResearchDataLifecyclePlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchDataLifecyclePlan" ADD CONSTRAINT "ResearchDataLifecyclePlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchDataLifecyclePlan" ADD CONSTRAINT "ResearchDataLifecyclePlan_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchDataLifecyclePlan" ADD CONSTRAINT "ResearchDataLifecyclePlan_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchDataLifecyclePlan" ADD CONSTRAINT "ResearchDataLifecyclePlan_disposedById_fkey" FOREIGN KEY ("disposedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchPrivacyReview" ADD CONSTRAINT "ResearchPrivacyReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchPrivacyReview" ADD CONSTRAINT "ResearchPrivacyReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchPrivacyReview" ADD CONSTRAINT "ResearchPrivacyReview_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchPrivacyReview" ADD CONSTRAINT "ResearchPrivacyReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchDatasetAccessRequest" ADD CONSTRAINT "ResearchDatasetAccessRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchDatasetAccessRequest" ADD CONSTRAINT "ResearchDatasetAccessRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchDatasetAccessRequest" ADD CONSTRAINT "ResearchDatasetAccessRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchDatasetAccessRequest" ADD CONSTRAINT "ResearchDatasetAccessRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
