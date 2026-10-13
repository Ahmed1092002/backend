import { clearProductCache } from "../../cache/redis.js";
import { queueLowStockEmail } from "../../jobs/email.queue.js";
import {
  emitProductEvent,
  emitUserNotification,
} from "../../realtime/socket.js";
import * as usersRepository from "../users/users.repository.js";
import {
  onOrderConfirmed,
  type OrderConfirmedEvent,
} from "./orders.events.js";

let registered = false;

export function registerOrderEventListeners() {
  if (registered) return;
  registered = true;

  onOrderConfirmed(clearCacheWhenOrderConfirmed);
  onOrderConfirmed(sendRealtimeUpdatesWhenOrderConfirmed);
  onOrderConfirmed(queueLowStockAlertsWhenOrderConfirmed);
}

async function clearCacheWhenOrderConfirmed() {
  await clearProductCache();
}

async function sendRealtimeUpdatesWhenOrderConfirmed({
  order,
  stockChanges,
}: OrderConfirmedEvent) {
  for (const { product } of stockChanges) {
    emitProductEvent("product:updated", product);
  }

  emitUserNotification(order.createdById, {
    title: "Order confirmed",
    message: `Order ${order.id} was confirmed.`,
  });
}

async function queueLowStockAlertsWhenOrderConfirmed({
  outboxEventId,
  stockChanges,
}: OrderConfirmedEvent) {
  const lowStockChanges = stockChanges.filter(
    (change) => change.crossedLowStock,
  );
  if (lowStockChanges.length === 0) return;

  if (!outboxEventId) {
    throw new Error("Low-stock alerts require an Outbox event ID");
  }

  const recipients = await usersRepository.findInventoryAlertRecipients();
  await Promise.all(
    lowStockChanges.map(({ product }) =>
      queueLowStockEmail(
        outboxEventId,
        product.id,
        product.name,
        product.stock,
        recipients.map(({ email }) => email),
      ),
    ),
  );
}
