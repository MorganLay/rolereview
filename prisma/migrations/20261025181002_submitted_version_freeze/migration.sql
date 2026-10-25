-- AlterTable
ALTER TABLE "CoverLetter" ADD COLUMN     "label" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TailoredResume" ADD COLUMN     "label" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- Versions already recorded as the one that was sent stay frozen.
UPDATE "TailoredResume" AS resume
SET "submittedAt" = resume."updatedAt"
FROM "Job" AS job
WHERE job."submittedResumeId" = resume."id"
  AND resume."submittedAt" IS NULL;

UPDATE "CoverLetter" AS letter
SET "submittedAt" = letter."updatedAt"
FROM "Job" AS job
WHERE job."submittedCoverLetterId" = letter."id"
  AND letter."submittedAt" IS NULL;
