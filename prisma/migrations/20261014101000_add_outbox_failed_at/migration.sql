ALTER TABLE "OutboxEvent"
ADD COLUMN "failedAt" TIMESTAMP(3);

DROP INDEX "OutboxEvent_processedAt_availableAt_lockedAt_createdAt_idx";

-- Failed events stay visible for investigation but are no longer claimed.
CREATE INDEX "OutboxEvent_processedAt_failedAt_availableAt_lockedAt_createdAt_idx"
ON "OutboxEvent"("processedAt", "failedAt", "availableAt", "lockedAt", "createdAt");
