import { clearProductCache } from "../../cache/redis.js";
import { queueLowStockEmail } from "../../jobs/email.queue.js";
import {
  emitProductEvent,
  emitUserNotification,
} from "../../realtime/socket.js";
import * as usersRepository from "../users/users.repository.js";
import { onOrderConfirmed } from "./orders.events.js";

let registered = false;

export function registerOrderEventListeners() {
  if (registered) return;
  registered = true;

  onOrderConfirmed(async ({ order, stockChanges }) => {
    await clearProductCache();

    for (const { product } of stockChanges) {
      emitProductEvent("product:updated", product);
    }

    emitUserNotification(order.createdById, {
      title: "Order confirmed",
      message: `Order ${order.id} was confirmed.`,
    });

    const lowStockChanges = stockChanges.filter(
      (change) => change.crossedLowStock,
    );
    if (lowStockChanges.length === 0) return;

    try {
      const recipients = await usersRepository.findInventoryAlertRecipients();
      await Promise.all(
        lowStockChanges.map(({ product }) =>
          queueLowStockEmail(
            product.id,
            product.name,
            product.stock,
            recipients.map(({ email }) => email),
          ),
        ),
      );
    } catch (error) {
      // A completed order must not be rolled back because the alert service is
      // temporarily unavailable. We learn the durable outbox solution later.
      console.error("Could not queue low-stock alert", error);
    }
  });
}
