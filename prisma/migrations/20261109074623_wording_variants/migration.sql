-- CreateEnum
CREATE TYPE "WordingKind" AS ENUM ('BULLET', 'HEADLINE', 'SUMMARY');

-- CreateEnum
CREATE TYPE "WordingStatus" AS ENUM ('PROPOSED', 'APPROVED');

-- CreateEnum
CREATE TYPE "WordingOrigin" AS ENUM ('CANONICAL', 'REWRITE', 'STRENGTHEN', 'USER', 'JOB');

-- CreateTable
CREATE TABLE "WordingVariant" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "WordingKind" NOT NULL,
    "status" "WordingStatus" NOT NULL,
    "origin" "WordingOrigin" NOT NULL,
    "bulletId" UUID,
    "jobId" UUID,
    "text" TEXT NOT NULL,
    "reason" TEXT,
    "sourceRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "basedOnId" UUID,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WordingVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WordingVariant_userId_kind_idx" ON "WordingVariant"("userId", "kind");

-- CreateIndex
CREATE INDEX "WordingVariant_userId_bulletId_idx" ON "WordingVariant"("userId", "bulletId");

-- CreateIndex
CREATE INDEX "WordingVariant_jobId_idx" ON "WordingVariant"("jobId");

-- AddForeignKey
ALTER TABLE "WordingVariant" ADD CONSTRAINT "WordingVariant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordingVariant" ADD CONSTRAINT "WordingVariant_bulletId_fkey" FOREIGN KEY ("bulletId") REFERENCES "Bullet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordingVariant" ADD CONSTRAINT "WordingVariant_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordingVariant" ADD CONSTRAINT "WordingVariant_basedOnId_fkey" FOREIGN KEY ("basedOnId") REFERENCES "WordingVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WordingVariant" ENABLE ROW LEVEL SECURITY;
