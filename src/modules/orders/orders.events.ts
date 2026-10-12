import type { ProductResponseDto } from "../products/products.dto.js";
import type { OrderResponseDto } from "./orders.dto.js";

export type OrderConfirmedEvent = {
  order: OrderResponseDto;
  stockChanges: {
    product: ProductResponseDto;
    crossedLowStock: boolean;
  }[];
};

type OrderConfirmedListener = (
  event: OrderConfirmedEvent,
) => void | Promise<void>;

const orderConfirmedListeners = new Set<OrderConfirmedListener>();

export function onOrderConfirmed(listener: OrderConfirmedListener) {
  orderConfirmedListeners.add(listener);
}

export async function publishOrderConfirmed(event: OrderConfirmedEvent) {
  // Run listeners in registration order: cache → real-time → email.
  for (const listener of orderConfirmedListeners) {
    try {
      await listener(event);
    } catch (error) {
      // The database transaction already succeeded. A non-critical side effect
      // such as Socket.IO or an alert must not make order confirmation fail.
      console.error("OrderConfirmed listener failed", error);
    }
  }
}
