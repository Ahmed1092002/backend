import { Prisma, type OutboxEvent } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../database/prisma.js";
import {
  publishOrderConfirmed,
  type OrderConfirmedEvent,
} from "../modules/orders/orders.events.js";

const POLL_INTERVAL_MS = 1_000;

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

async function releaseForRetry(eventId: string, workerId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.outboxEvent.updateMany({
    where: { id: eventId, lockedBy: workerId, processedAt: null },
    data: { lockedAt: null, lockedBy: null, lastError: message.slice(0, 1_000) },
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
    await publishOrderConfirmed(event.payload as unknown as OrderConfirmedEvent);
    await markProcessed(event.id, workerId);
  } catch (error) {
    await releaseForRetry(event.id, workerId, error);
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
