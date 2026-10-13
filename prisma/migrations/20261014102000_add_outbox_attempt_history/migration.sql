CREATE TABLE "OutboxEventAttempt" (
    "id" TEXT NOT NULL,
    "outboxEventId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "error" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutboxEventAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutboxEventAttempt_outboxEventId_attemptNumber_key"
ON "OutboxEventAttempt"("outboxEventId", "attemptNumber");

CREATE INDEX "OutboxEventAttempt_outboxEventId_attemptedAt_idx"
ON "OutboxEventAttempt"("outboxEventId", "attemptedAt");

ALTER TABLE "OutboxEventAttempt" ADD CONSTRAINT "OutboxEventAttempt_outboxEventId_fkey"
FOREIGN KEY ("outboxEventId") REFERENCES "OutboxEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
