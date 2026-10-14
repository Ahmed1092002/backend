# Outbox Pattern: Why It Exists and How It Works Here

## Start with the real problem

When an order is confirmed, the system needs to do several things:

1. Reduce stock.
2. Save `InventoryMovement` rows.
3. Change the order status to `CONFIRMED`.
4. Clear the product cache.
5. Send a Socket.IO notification.
6. Queue a low-stock email if a product crosses its low-stock threshold.

The first three are core database changes. They must succeed or fail together in one PostgreSQL transaction. The last three are side effects outside the database.

This code has a dangerous failure window:

```ts
await prisma.$transaction(confirmOrderInDatabase);
publishOrderConfirmed(event);
```

If the database transaction succeeds but the server crashes before `publishOrderConfirmed`, the order is confirmed and stock was reduced, but cache invalidation, socket updates, and email never happen.

Sending email inside the database transaction is not a good fix. Network operations can be slow or fail, and they should not keep a database transaction open.

## The idea in one sentence

Inside the **same transaction** that saves business data, write a small record that says: “after commit, this event must be published.” That record is the **outbox event**.

```text
transaction commits
  order + stock changes + inventory movements + outbox event
```

If the application crashes after commit, PostgreSQL still contains the event. A processor can publish it when the application is available again.

## Before the outbox: in-memory events and listeners

At startup, `src/server.ts` calls `registerOrderEventListeners()` once. That function adds callbacks to a `Set` in `orders.events.ts`:

```ts
onOrderConfirmed(clearCacheWhenOrderConfirmed);
onOrderConfirmed(emitRealtimeWhenOrderConfirmed);
onOrderConfirmed(queueLowStockEmailWhenOrderConfirmed);
```

The `Set` does not disappear after the first event. It remains in the Node.js process memory while the server is running. When code calls:

```ts
await publishOrderConfirmed(event);
```

the publisher loops over every callback in the `Set` and invokes it. The `registered` flag prevents accidentally registering the same callbacks twice.

This separates order business logic from cache, socket, and email details. However, memory is not durable: if the process dies, its listener work can be lost. The Outbox Pattern does not replace listeners; it makes the event that will reach those listeners durable.

## Data model

### `OutboxEvent`

The `OutboxEvent` model in `prisma/schema.prisma` represents one event waiting to be processed or already processed:

| Field | Meaning |
| --- | --- |
| `id` | Stable event UUID; also used for consumer idempotency |
| `type` | Event type, currently `order.confirmed` |
| `payload` | JSON containing the order and stock changes needed by listeners |
| `createdAt` | When the event was written in the transaction |
| `availableAt` | Earliest time it may be retried |
| `processedAt` | Success time; `null` means it has not succeeded yet |
| `failedAt` | Dead-letter time after retries are exhausted |
| `lockedAt`, `lockedBy` | Lease owned by the processor that claimed the event |
| `attempts` | Number of publication attempts |
| `lastError` | Latest compact error for quick inspection |

There is a composite index on the fields used to find ready events: `processedAt`, `failedAt`, `availableAt`, `lockedAt`, and `createdAt`.

### `OutboxEventAttempt`

Each failed attempt creates a row in this table:

```text
OutboxEvent 1 ---- * OutboxEventAttempt
```

It stores the attempt number, error, and attempt time. It is append-only history: a manual replay may clear `lastError` on the event, but previous failure evidence remains available for diagnosis.

### Why is there no foreign key from OutboxEvent to Order?

The outbox is generic. Today it contains `order.confirmed`; tomorrow it may contain `user.registered` or `product.created`. A direct FK to `Order` would make it order-specific. The order ID is part of the payload for the `order.confirmed` event type.

### Do not confuse OutboxEvent with IdempotencyKey

| Concept | Which duplication does it solve? |
| --- | --- |
| `IdempotencyKey` | The same HTTP create-order request arrives twice because of a retry/network issue |
| `OutboxEvent` | Important side effects after saving an order must not disappear after a crash |

`IdempotencyKey` is directly related to `Order` through `orderId`. The outbox is a separate business message waiting for delivery.

## How an event is created during order confirmation

In `src/modules/orders/orders.service.ts`, `confirmOrder` runs one transaction:

```text
load draft order
  -> safely update stock
  -> create InventoryMovement rows
  -> mark order CONFIRMED
  -> create OutboxEvent(type = order.confirmed)
commit
```

Simplified code:

```ts
await tx.outboxEvent.create({
  data: {
    type: "order.confirmed",
    payload: event,
  },
});
```

Before the transaction commits, neither the confirmed order nor the outbox event is visible as completed. If the transaction fails, both roll back. If it commits, both exist. That is the core value of the pattern.

## Processor: who reads the table?

`src/jobs/outbox.service.ts` starts `startOutboxProcessor()` when the server starts. Approximately every second it finds a ready event and keeps draining the ready backlog.

In this learning version, the processor runs inside the API process because the Socket.IO server lives there. This is a deliberate simplification. A future separate worker would need a clear design for sending realtime messages, such as a Socket.IO Redis adapter or an independent realtime consumer.

## Claiming: why do two workers not normally process the same event?

The processor uses a PostgreSQL query with:

```sql
FOR UPDATE SKIP LOCKED
```

One worker selects and locks a row inside a transaction. Another worker skips that locked row and can claim a different one, rather than waiting or performing the same work.

The claim increments `attempts` and records `lockedAt` and `lockedBy`. This is a lease.

If a worker dies while it owns an event, the lease does not last forever. After a timeout, another worker can pick it up. This is why the system must not claim exactly-once delivery.

## Publishing success and failure

For an `order.confirmed` event, the processor performs roughly:

```ts
await publishOrderConfirmed({
  ...storedPayload,
  outboxEventId: event.id,
});

await markProcessed(event.id);
```

The listeners then perform:

```text
order.confirmed
  ├─ clear Redis product cache
  ├─ emit Socket.IO product/user notifications
  └─ queue low-stock email work when a threshold was crossed
```

If all side effects succeed, the processor sets `processedAt` and releases the lease.

If publishing fails:

1. It saves an `OutboxEventAttempt` row.
2. It stores `lastError`.
3. It releases the lease.
4. It delays `availableAt` with exponential backoff: 1s, 2s, 4s, and so on, capped at 60s.
5. After 10 attempts, it sets `failedAt` and stops automatic retries.

This is the dead-letter state. The event is not deleted because its failure must be inspectable.

## Manual replay

ADMIN-only endpoints under `/api/outbox-events` support operations:

- `GET /failed`: list dead-letter events without their payloads.
- `GET /:id`: inspect event state and attempt history.
- `POST /:id/replay`: return a failed event to the ready state.

Replay clears `failedAt`, resets the attempt counter, and makes the event available now. It does not delete `OutboxEventAttempt` history, so earlier failures remain visible.

## Is this exactly once? No.

Imagine a listener sends an email and the process crashes before `markProcessed`. When the processor restarts, it may publish the event again. This is **at-least-once delivery**: an event may be delivered more than once, but it is much less likely to be silently lost.

Every consumer should tolerate duplicates:

| Consumer | Why repetition is safe or reduced |
| --- | --- |
| Cache invalidation | Deleting the same cache key twice is safe |
| Socket.IO | A frontend should be able to deduplicate by event ID if needed |
| Low-stock queue | The job ID contains the `outboxEventId` and product ID, reducing duplicate enqueueing |
| Stock reduction | It happens in the transaction, never in the listener |

BullMQ and email do not provide magical exactly-once email either. A crash at the wrong time can still duplicate an email. The practical solution is idempotency and observability, not an impossible promise.

## Full flow

```text
Client confirms order
        |
        v
Order service transaction
  ├─ decrement stock safely
  ├─ insert inventory movements
  ├─ update order = CONFIRMED
  └─ insert OutboxEvent(order.confirmed)
        |
      COMMIT
        |
        v
Outbox processor claims event (lease)
        |
        v
publishOrderConfirmed
  ├─ clear Redis cache
  ├─ Socket.IO notifications
  └─ BullMQ low-stock email job
        |
        +-- success -> processedAt set
        |
        +-- failure -> attempt history + retry later
                              |
                              +-- exhausted -> failedAt (dead letter)
                                              |
                                              +-- ADMIN replay
```

## Why not use Redis instead of an outbox table?

Redis is useful for cache and queues, but it does not automatically share one atomic transaction with PostgreSQL. If an order is saved first and the application crashes before writing its Redis event, we still lose the event.

The outbox table is written by the same PostgreSQL transaction that saves the order. That is why the consistency story is much simpler and stronger.

## When should you use it?

Use an outbox when an important business write must reliably cause side effects or events: billing, email, inventory, audit, Kafka publication, or third-party integrations.

Do not add it to every small CRUD action or `console.log`. It adds tables, polling, retries, monitoring, and idempotency responsibilities. A simple CRUD feature without important side effects may not need it.

## Checklist for a new event type

1. Define a small, clear event type and payload.
2. Insert the OutboxEvent in the same transaction as the business change.
3. Add a clear handler/listener.
4. Make the handler idempotent.
5. Decide retry, dead-letter, and manual-replay behaviour.
6. Add useful logs and metrics/alerts when the event matters operationally.

The Outbox Pattern does not make a system failure-proof. It changes “the event disappeared and we do not know why” into a durable record that can be retried, monitored, and repaired.
