ALTER TABLE "PricingInquiry" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'Not provided';
ALTER TABLE "PricingInquiry" ALTER COLUMN "country" DROP DEFAULT;
ALTER TABLE "PricingInquiry" ALTER COLUMN "phoneNumber" DROP NOT NULL;
