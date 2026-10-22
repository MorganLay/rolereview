-- AlterTable
ALTER TABLE "JobEvent" ADD COLUMN     "contactId" UUID;

-- CreateIndex
CREATE INDEX "JobEvent_contactId_idx" ON "JobEvent"("contactId");

-- AddForeignKey
ALTER TABLE "JobEvent" ADD CONSTRAINT "JobEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
