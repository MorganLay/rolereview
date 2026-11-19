-- Quota slot taken before the model call. Null once the call settles or expires.
ALTER TABLE "AiCall" ADD COLUMN "heldUntil" TIMESTAMP(3);

CREATE INDEX "AiCall_userId_kind_heldUntil_idx" ON "AiCall"("userId", "kind", "heldUntil");
