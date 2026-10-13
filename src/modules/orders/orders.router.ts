import { Router } from "express";
import { authenticate } from "../../middleware/authnticate.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validate } from "../../middleware/validate.js";
import { requireIdempotencyKey } from "../../middleware/idempotency-key.js";
import {
  confirmOrder,
  createOrder,
  downloadInvoice,
} from "./orders.controller.js";
import { createOrderSchema } from "./orders.validation.js";

export const ordersRouter = Router();

ordersRouter.post(
  "/",
  authenticate,
  requireRole("ADMIN", "MANAGER"),
  requireIdempotencyKey,
  validate(createOrderSchema),
  asyncHandler(createOrder),
);
ordersRouter.get(
  "/:id/invoice",
  authenticate,
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(downloadInvoice),
);
ordersRouter.post(
  "/:id/confirm",
  authenticate,
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(confirmOrder),
);
