ALTER TABLE "OutboxEvent"
ADD COLUMN "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DROP INDEX "OutboxEvent_processedAt_lockedAt_createdAt_idx";

-- Finds only events whose retry delay has elapsed.
CREATE INDEX "OutboxEvent_processedAt_availableAt_lockedAt_createdAt_idx"
ON "OutboxEvent"("processedAt", "availableAt", "lockedAt", "createdAt");
