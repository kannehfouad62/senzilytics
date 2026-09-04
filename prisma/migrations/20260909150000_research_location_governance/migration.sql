CREATE TYPE "ResearchLocationCapturePolicy" AS ENUM ('DISABLED', 'OPTIONAL', 'REQUIRED');

ALTER TABLE "ResearchCollectionWave"
ADD COLUMN "locationCapturePolicy" "ResearchLocationCapturePolicy" NOT NULL DEFAULT 'OPTIONAL',
ADD COLUMN "maximumLocationAccuracyM" DOUBLE PRECISION DEFAULT 250,
ADD COLUMN "retainPreciseLocation" BOOLEAN NOT NULL DEFAULT false;
