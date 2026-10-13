import { Prisma, type OutboxEvent } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../database/prisma.js";
import {
  publishOrderConfirmed,
  type OrderConfirmedEvent,
} from "../modules/orders/orders.events.js";

const POLL_INTERVAL_MS = 1_000;
const MAX_RETRY_DELAY_MS = 60_000;
const MAX_ATTEMPTS = 10;

export async function findFailedOutboxEvents() {
  // Do not expose payloads from an operations endpoint: they may contain
  // business or user data. Operators only need enough detail to investigate.
  return prisma.outboxEvent.findMany({
    where: { failedAt: { not: null } },
    select: {
      id: true,
      type: true,
      createdAt: true,
      failedAt: true,
      attempts: true,
      lastError: true,
    },
    orderBy: { failedAt: "desc" },
  });
}

export async function replayFailedOutboxEvent(eventId: string) {
  // A replay is explicit and ADMIN-only. Reset attempts so the fixed event gets
  // a complete retry budget; the row itself remains the same audit record.
  const result = await prisma.outboxEvent.updateMany({
    where: { id: eventId, processedAt: null, failedAt: { not: null } },
    data: {
      failedAt: null,
      attempts: 0,
      lastError: null,
      lockedAt: null,
      lockedBy: null,
      availableAt: new Date(),
    },
  });

  return result.count === 1;
}

export async function saveOrderConfirmedEvent(
  tx: Prisma.TransactionClient,
  event: OrderConfirmedEvent,
) {
  // JSON is the durable boundary between the database transaction and a later
  // worker. Dates become ISO strings, which is exactly what JSON events use.
  const payload = JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue;

  await tx.outboxEvent.create({
    data: { type: "order.confirmed", payload },
  });
}

async function claimNextEvent(workerId: string): Promise<OutboxEvent | undefined> {
  // FOR UPDATE SKIP LOCKED lets several API instances poll safely: each one
  // claims a different row. An abandoned lease becomes available after 5 min.
  const events = await prisma.$queryRaw<OutboxEvent[]>(Prisma.sql`
    WITH next_event AS (
      SELECT "id"
      FROM "OutboxEvent"
      WHERE "processedAt" IS NULL
        AND "failedAt" IS NULL
        AND "availableAt" <= NOW()
        AND ("lockedAt" IS NULL OR "lockedAt" < NOW() - INTERVAL '5 minutes')
      ORDER BY "createdAt"
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "OutboxEvent" AS event
    SET "lockedAt" = NOW(),
        "lockedBy" = ${workerId},
        "attempts" = event."attempts" + 1
    FROM next_event
    WHERE event."id" = next_event."id"
    RETURNING event.*
  `);

  return events[0];
}

async function markProcessed(eventId: string, workerId: string) {
  await prisma.outboxEvent.updateMany({
    where: { id: eventId, lockedBy: workerId, processedAt: null },
    data: {
      processedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  });
}

async function releaseForRetry(
  event: OutboxEvent,
  workerId: string,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : String(error);
  if (event.attempts >= MAX_ATTEMPTS) {
    // Keep the row and its error for investigation. It is a dead letter, not
    // deleted data, and an operator can choose to replay it later.
    await prisma.outboxEvent.updateMany({
      where: { id: event.id, lockedBy: workerId, processedAt: null },
      data: {
        failedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lastError: message.slice(0, 1_000),
      },
    });
    console.error(
      `Outbox event ${event.id} exhausted ${MAX_ATTEMPTS} attempts`,
      error,
    );
    return;
  }

  // 1 s, 2 s, 4 s, 8 s … up to one minute. A failing dependency is given
  // room to recover instead of being hit again every polling second.
  const retryDelayMs = Math.min(
    1_000 * 2 ** Math.max(event.attempts - 1, 0),
    MAX_RETRY_DELAY_MS,
  );
  await prisma.outboxEvent.updateMany({
    where: { id: event.id, lockedBy: workerId, processedAt: null },
    data: {
      lockedAt: null,
      lockedBy: null,
      availableAt: new Date(Date.now() + retryDelayMs),
      lastError: message.slice(0, 1_000),
    },
  });
}

export async function processNextOutboxEvent(workerId: string) {
  const event = await claimNextEvent(workerId);
  if (!event) return false;

  try {
    if (event.type !== "order.confirmed") {
      throw new Error(`Unsupported outbox event type: ${event.type}`);
    }

    // The writer controls this payload shape. Runtime validation can be added
    // when other services are allowed to publish events into this table.
    const payload = event.payload as unknown as OrderConfirmedEvent;
    // The database row ID is the stable identity used by downstream consumers
    // to make their own work idempotent.
    await publishOrderConfirmed({ ...payload, outboxEventId: event.id });
    await markProcessed(event.id, workerId);
  } catch (error) {
    await releaseForRetry(event, workerId, error);
    console.error(`Outbox event ${event.id} failed`, error);
    // Wait for the next polling interval before retrying. A permanent failure
    // must not create a hot loop that overloads the API or database.
    return false;
  }

  return true;
}

export function startOutboxProcessor() {
  const workerId = `api-${process.pid}-${randomUUID()}`;
  let processing = false;

  const tick = async () => {
    if (processing) return;
    processing = true;
    try {
      // Drain the current backlog, then wait for the next polling interval.
      while (await processNextOutboxEvent(workerId)) {
        // The loop body is intentionally empty; processing happens above.
      }
    } catch (error) {
      console.error("Outbox processor failed", error);
    } finally {
      processing = false;
    }
  };

  void tick();
  return setInterval(() => void tick(), POLL_INTERVAL_MS);
}
