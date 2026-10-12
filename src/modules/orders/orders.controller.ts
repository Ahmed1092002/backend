import type { RequestHandler } from "express";
import { createOrder as createOrderInService } from "./orders.service.js";
import type { CreateOrderInput } from "./orders.validation.js";

export const createOrder: RequestHandler = async (req, res) => {
  const user = res.locals.user as { id: string };
  const order = await createOrderInService(req.body as CreateOrderInput, user.id);
  res.status(201).json({ data: order });
};
