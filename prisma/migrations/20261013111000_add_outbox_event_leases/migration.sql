ALTER TABLE "OutboxEvent"
ADD COLUMN "lockedAt" TIMESTAMP(3),
ADD COLUMN "lockedBy" TEXT;

DROP INDEX "OutboxEvent_processedAt_createdAt_idx";

-- A worker looks for unprocessed events whose lease is empty or expired.
CREATE INDEX "OutboxEvent_processedAt_lockedAt_createdAt_idx"
ON "OutboxEvent"("processedAt", "lockedAt", "createdAt");
