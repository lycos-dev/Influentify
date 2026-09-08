CREATE TYPE "CreatorStatus" AS ENUM ('CANDIDATE', 'APPROVED', 'VOIDED');
CREATE TYPE "ExclusionType" AS ENUM ('USED', 'VOIDED');

CREATE TABLE "Creator" (
  "id" TEXT NOT NULL,
  "name" TEXT,
  "handle" TEXT NOT NULL,
  "instagramUrl" TEXT NOT NULL,
  "country" TEXT,
  "city" TEXT,
  "niche" TEXT,
  "followers" INTEGER,
  "engagementRate" DOUBLE PRECISION,
  "avgLikes" INTEGER,
  "avgReelViews" INTEGER,
  "email" TEXT,
  "lastPostAt" TIMESTAMP(3),
  "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" "CreatorStatus" NOT NULL DEFAULT 'CANDIDATE',
  "source" TEXT DEFAULT 'manual',
  "sourceSnippet" TEXT,
  "notes" TEXT,
  "voidReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Campaign" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "countries" TEXT[],
  "niches" TEXT[],
  "minFollowers" INTEGER,
  "maxFollowers" INTEGER,
  "minEngagementRate" DOUBLE PRECISION,
  "minAvgReelViews" INTEGER,
  "emailRequired" BOOLEAN NOT NULL DEFAULT false,
  "activeWithinDays" INTEGER,
  "targetCount" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignCreator" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignCreator_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Exclusion" (
  "id" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "type" "ExclusionType" NOT NULL,
  "reason" TEXT,
  "sourceFile" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Exclusion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Creator_handle_key" ON "Creator"("handle");
CREATE INDEX "Creator_status_idx" ON "Creator"("status");
CREATE INDEX "Creator_country_idx" ON "Creator"("country");
CREATE INDEX "Creator_followers_idx" ON "Creator"("followers");
CREATE INDEX "Creator_score_idx" ON "Creator"("score");
CREATE UNIQUE INDEX "CampaignCreator_campaignId_creatorId_key" ON "CampaignCreator"("campaignId", "creatorId");
CREATE INDEX "Exclusion_handle_idx" ON "Exclusion"("handle");
CREATE INDEX "Exclusion_type_idx" ON "Exclusion"("type");
CREATE UNIQUE INDEX "Exclusion_handle_type_key" ON "Exclusion"("handle", "type");

ALTER TABLE "CampaignCreator"
  ADD CONSTRAINT "CampaignCreator_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignCreator"
  ADD CONSTRAINT "CampaignCreator_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
