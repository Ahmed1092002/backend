import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { saveOrderConfirmedEvent } from "../../jobs/outbox.service.js";
import { createOrdersService } from "./orders.service.js";

// This is the orders module's composition point. Infrastructure is assembled
// here once, then the controller receives a ready business service.
export const ordersService = createOrdersService({
  prisma,
  lowStockThreshold: env.lowStockThreshold,
  saveOrderConfirmedEvent,
});
