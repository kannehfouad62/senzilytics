CREATE TYPE "SubscriptionPlan" AS ENUM ('ESSENTIAL', 'ENTERPRISE', 'PREMIUM');
ALTER TABLE "Organization" ADD COLUMN "subscriptionPlan" "SubscriptionPlan" NOT NULL DEFAULT 'PREMIUM', ADD COLUMN "contractedUserMinimum" INTEGER, ADD COLUMN "subscriptionNotes" TEXT;
CREATE TABLE "PricingInquiry" (
  "id" TEXT NOT NULL, "fullName" TEXT NOT NULL, "company" TEXT NOT NULL, "jobTitle" TEXT NOT NULL, "workEmail" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL, "requestedPlan" "SubscriptionPlan" NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" TEXT, CONSTRAINT "PricingInquiry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PricingInquiry_workEmail_createdAt_idx" ON "PricingInquiry"("workEmail", "createdAt");
CREATE INDEX "PricingInquiry_requestedPlan_createdAt_idx" ON "PricingInquiry"("requestedPlan", "createdAt");
ALTER TABLE "PricingInquiry" ADD CONSTRAINT "PricingInquiry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
