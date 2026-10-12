import type { RequestHandler } from "express";
import {
  confirmOrder as confirmOrderInService,
  createOrder as createOrderInService,
} from "./orders.service.js";
import type { CreateOrderInput } from "./orders.validation.js";

export const createOrder: RequestHandler = async (req, res) => {
  const user = res.locals.user as { id: string };
  const order = await createOrderInService(req.body as CreateOrderInput, user.id);
  res.status(201).json({ data: order });
};

export const confirmOrder: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const user = res.locals.user as { id: string };

  if (typeof id !== "string") {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const order = await confirmOrderInService(id, user.id);

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.status(200).json({ data: order });
};
