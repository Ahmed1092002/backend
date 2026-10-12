import { Router } from "express";
import { authenticate } from "../../middleware/authnticate.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validate } from "../../middleware/validate.js";
import { createOrder } from "./orders.controller.js";
import { createOrderSchema } from "./orders.validation.js";

export const ordersRouter = Router();

ordersRouter.post(
  "/",
  authenticate,
  requireRole("ADMIN", "MANAGER"),
  validate(createOrderSchema),
  asyncHandler(createOrder),
);
