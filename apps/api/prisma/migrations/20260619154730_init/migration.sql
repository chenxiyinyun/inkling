-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'FROZEN', 'BANNED');

-- CreateEnum
CREATE TYPE "AgeTier" AS ENUM ('CHILD', 'TEEN', 'ADULT');

-- CreateEnum
CREATE TYPE "LetterStatus" AS ENUM ('DRAFT', 'REVIEWING', 'DELIVERING', 'FLOATING', 'HOOKED', 'SEALED_OPEN', 'PAIRED', 'RECYCLED', 'DIMMED', 'ARCHIVED', 'FROZEN');

-- CreateEnum
CREATE TYPE "DeliveryVehicle" AS ENUM ('FOOT', 'CARRIAGE', 'PIGEON', 'FAST_HORSE', 'ALBATROSS');

-- CreateEnum
CREATE TYPE "RelationStatus" AS ENUM ('ACTIVE', 'DORMANT', 'ARCHIVED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('SAFE', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ReviewAction" AS ENUM ('PASS', 'REVIEW', 'BLOCK');

-- CreateEnum
CREATE TYPE "ReviewTargetType" AS ENUM ('LETTER', 'CORRESPONDENCE', 'PROFILE');

-- CreateEnum
CREATE TYPE "PenaltyType" AS ENUM ('WARNING', 'RATE_LIMIT', 'FREEZE', 'BAN');

-- CreateEnum
CREATE TYPE "Operator" AS ENUM ('AI', 'HUMAN');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('HARASSMENT', 'SEXUAL', 'CONTACT_INFO', 'SCAM', 'POLITICAL', 'SELF_HARM', 'MINOR_SAFETY', 'OTHER');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'GRANTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeletionStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "ageTier" "AgeTier" NOT NULL,
    "birthDate" TIMESTAMP(3),
    "frozenUntil" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "userId" TEXT NOT NULL,
    "penName" TEXT NOT NULL,
    "mbti" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "interestTags" JSONB NOT NULL DEFAULT '[]',
    "oneLiner" VARCHAR(60),
    "geohash5" TEXT,
    "matchPreference" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "guardianMode" BOOLEAN NOT NULL DEFAULT false,
    "invisible" BOOLEAN NOT NULL DEFAULT false,
    "reputation" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "parental_consents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "guardianContact" TEXT,
    "jurisdiction" TEXT,
    "status" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "grantedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parental_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "letters" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "theme" TEXT,
    "status" "LetterStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 0,
    "geohash5" TEXT,
    "poolVisibleAt" TIMESTAMP(3),
    "expireAt" TIMESTAMP(3),
    "recycleCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preview_snapshots" (
    "letterId" TEXT NOT NULL,
    "partialTags" JSONB NOT NULL DEFAULT '[]',
    "bodyExcerpt" TEXT NOT NULL,

    CONSTRAINT "preview_snapshots_pkey" PRIMARY KEY ("letterId")
);

-- CreateTable
CREATE TABLE "fishing_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "letterId" TEXT NOT NULL,
    "fishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockUntil" TIMESTAMP(3) NOT NULL,
    "released" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "fishing_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unseal_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "letterId" TEXT NOT NULL,
    "unsealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replyDeadline" TIMESTAMP(3) NOT NULL,
    "replied" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "unseal_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pen_pal_relations" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "sourceLetterId" TEXT,
    "status" "RelationStatus" NOT NULL DEFAULT 'ACTIVE',
    "exchangeCount" INTEGER NOT NULL DEFAULT 0,
    "intimacy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastLetterAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pen_pal_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correspondences" (
    "id" TEXT NOT NULL,
    "relationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "reviewStatus" "ReviewAction" NOT NULL DEFAULT 'PASS',
    "deliverAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correspondences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_tasks" (
    "id" TEXT NOT NULL,
    "letterId" TEXT,
    "correspondenceId" TEXT,
    "vehicle" "DeliveryVehicle" NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "departAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "etaAt" TIMESTAMP(3) NOT NULL,
    "arrivedAt" TIMESTAMP(3),

    CONSTRAINT "delivery_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_quotas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "sendLeft" INTEGER NOT NULL,
    "fishLeft" INTEGER NOT NULL,
    "unsealLeft" INTEGER NOT NULL,

    CONSTRAINT "daily_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_reviews" (
    "id" TEXT NOT NULL,
    "targetType" "ReviewTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "risk" "RiskLevel" NOT NULL,
    "action" "ReviewAction" NOT NULL,
    "hits" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalties" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PenaltyType" NOT NULL,
    "reason" TEXT NOT NULL,
    "relatedReviewId" TEXT,
    "operator" "Operator" NOT NULL DEFAULT 'AI',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),

    CONSTRAINT "penalties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetType" "ReviewTargetType",
    "targetId" TEXT,
    "reason" "ReportReason" NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_deletion_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "DeletionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "data_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_publicId_key" ON "users"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "user_profiles_geohash5_idx" ON "user_profiles"("geohash5");

-- CreateIndex
CREATE INDEX "user_profiles_mbti_idx" ON "user_profiles"("mbti");

-- CreateIndex
CREATE UNIQUE INDEX "parental_consents_userId_key" ON "parental_consents"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "letters_publicId_key" ON "letters"("publicId");

-- CreateIndex
CREATE INDEX "letters_status_poolVisibleAt_idx" ON "letters"("status", "poolVisibleAt");

-- CreateIndex
CREATE INDEX "letters_authorId_idx" ON "letters"("authorId");

-- CreateIndex
CREATE INDEX "letters_geohash5_idx" ON "letters"("geohash5");

-- CreateIndex
CREATE INDEX "fishing_records_letterId_idx" ON "fishing_records"("letterId");

-- CreateIndex
CREATE UNIQUE INDEX "fishing_records_userId_letterId_key" ON "fishing_records"("userId", "letterId");

-- CreateIndex
CREATE INDEX "unseal_records_letterId_idx" ON "unseal_records"("letterId");

-- CreateIndex
CREATE INDEX "unseal_records_replyDeadline_idx" ON "unseal_records"("replyDeadline");

-- CreateIndex
CREATE UNIQUE INDEX "pen_pal_relations_publicId_key" ON "pen_pal_relations"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "pen_pal_relations_userAId_userBId_key" ON "pen_pal_relations"("userAId", "userBId");

-- CreateIndex
CREATE INDEX "correspondences_relationId_idx" ON "correspondences"("relationId");

-- CreateIndex
CREATE INDEX "delivery_tasks_etaAt_arrivedAt_idx" ON "delivery_tasks"("etaAt", "arrivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "daily_quotas_userId_date_key" ON "daily_quotas"("userId", "date");

-- CreateIndex
CREATE INDEX "content_reviews_targetType_targetId_idx" ON "content_reviews"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "penalties_userId_idx" ON "penalties"("userId");

-- CreateIndex
CREATE INDEX "reports_targetUserId_idx" ON "reports"("targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_userId_targetUserId_key" ON "blocks"("userId", "targetUserId");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parental_consents" ADD CONSTRAINT "parental_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letters" ADD CONSTRAINT "letters_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preview_snapshots" ADD CONSTRAINT "preview_snapshots_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "letters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fishing_records" ADD CONSTRAINT "fishing_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fishing_records" ADD CONSTRAINT "fishing_records_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "letters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unseal_records" ADD CONSTRAINT "unseal_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unseal_records" ADD CONSTRAINT "unseal_records_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "letters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pen_pal_relations" ADD CONSTRAINT "pen_pal_relations_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pen_pal_relations" ADD CONSTRAINT "pen_pal_relations_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pen_pal_relations" ADD CONSTRAINT "pen_pal_relations_sourceLetterId_fkey" FOREIGN KEY ("sourceLetterId") REFERENCES "letters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correspondences" ADD CONSTRAINT "correspondences_relationId_fkey" FOREIGN KEY ("relationId") REFERENCES "pen_pal_relations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correspondences" ADD CONSTRAINT "correspondences_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "letters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_quotas" ADD CONSTRAINT "daily_quotas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

