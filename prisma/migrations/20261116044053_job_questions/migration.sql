-- CreateEnum
CREATE TYPE "JobQuestionKind" AS ENUM ('CONFIRM', 'DETAIL', 'SCALE', 'OUTCOME', 'ROLE');

-- CreateEnum
CREATE TYPE "JobQuestionStatus" AS ENUM ('OPEN', 'YES', 'NOT_YET', 'SKIPPED');

-- CreateEnum
CREATE TYPE "QuestionDraftDestination" AS ENUM ('BULLET', 'SKILL', 'CERTIFICATION');

-- CreateEnum
CREATE TYPE "JobQuestionSetStatus" AS ENUM ('GENERATING', 'READY', 'EMPTY', 'FAILED');

-- AlterEnum
ALTER TYPE "AiCallKind" ADD VALUE 'JOB_QUESTIONS';

-- CreateTable
CREATE TABLE "JobQuestionSet" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "status" "JobQuestionSetStatus" NOT NULL,
    "libraryRevision" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobQuestionSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobQuestion" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "setId" UUID NOT NULL,
    "requirementId" TEXT NOT NULL,
    "entryId" UUID,
    "kind" "JobQuestionKind" NOT NULL,
    "question" TEXT NOT NULL,
    "why" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topicKey" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "JobQuestionStatus" NOT NULL DEFAULT 'OPEN',
    "detail" TEXT,
    "followUp" TEXT,
    "followUpDetail" TEXT,
    "draftText" TEXT,
    "draftDestination" "QuestionDraftDestination",
    "draftDropped" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerTopic" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "topicKey" TEXT NOT NULL,
    "declined" BOOLEAN NOT NULL,
    "jobId" UUID,
    "question" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnswerTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceOrigin" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bulletId" UUID,
    "skillId" UUID,
    "entryId" UUID,
    "source" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "topicKey" TEXT NOT NULL,
    "kind" "JobQuestionKind" NOT NULL,
    "jobId" UUID,
    "questionId" UUID,
    "answeredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceOrigin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobQuestionSet_jobId_key" ON "JobQuestionSet"("jobId");

-- CreateIndex
CREATE INDEX "JobQuestionSet_userId_idx" ON "JobQuestionSet"("userId");

-- CreateIndex
CREATE INDEX "JobQuestion_userId_topicKey_idx" ON "JobQuestion"("userId", "topicKey");

-- CreateIndex
CREATE INDEX "JobQuestion_setId_position_idx" ON "JobQuestion"("setId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "JobQuestion_jobId_topicKey_key" ON "JobQuestion"("jobId", "topicKey");

-- CreateIndex
CREATE INDEX "AnswerTopic_userId_idx" ON "AnswerTopic"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerTopic_userId_topicKey_key" ON "AnswerTopic"("userId", "topicKey");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceOrigin_bulletId_key" ON "EvidenceOrigin"("bulletId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceOrigin_skillId_key" ON "EvidenceOrigin"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceOrigin_entryId_key" ON "EvidenceOrigin"("entryId");

-- CreateIndex
CREATE INDEX "EvidenceOrigin_userId_idx" ON "EvidenceOrigin"("userId");

-- CreateIndex
CREATE INDEX "EvidenceOrigin_userId_jobId_idx" ON "EvidenceOrigin"("userId", "jobId");

-- AddForeignKey
ALTER TABLE "JobQuestionSet" ADD CONSTRAINT "JobQuestionSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobQuestionSet" ADD CONSTRAINT "JobQuestionSet_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobQuestion" ADD CONSTRAINT "JobQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobQuestion" ADD CONSTRAINT "JobQuestion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobQuestion" ADD CONSTRAINT "JobQuestion_setId_fkey" FOREIGN KEY ("setId") REFERENCES "JobQuestionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobQuestion" ADD CONSTRAINT "JobQuestion_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerTopic" ADD CONSTRAINT "AnswerTopic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerTopic" ADD CONSTRAINT "AnswerTopic_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceOrigin" ADD CONSTRAINT "EvidenceOrigin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceOrigin" ADD CONSTRAINT "EvidenceOrigin_bulletId_fkey" FOREIGN KEY ("bulletId") REFERENCES "Bullet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceOrigin" ADD CONSTRAINT "EvidenceOrigin_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceOrigin" ADD CONSTRAINT "EvidenceOrigin_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceOrigin" ADD CONSTRAINT "EvidenceOrigin_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Same as the earlier tables: no policies. The Supabase Data API can read nothing.
-- Prisma connects as the database owner, which bypasses row level security.
ALTER TABLE "JobQuestionSet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnswerTopic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EvidenceOrigin" ENABLE ROW LEVEL SECURITY;
