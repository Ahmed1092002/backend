import { Router } from "express";
import { createRateLimiter } from "../middleware/rate-limit.js";

import { authRouter } from "../modules/auth/auth.router.js";
import { productsRouter } from "../modules/products/products.router.js";
import { usersRouter } from "../modules/users/users.router.js";
import { ordersRouter } from "../modules/orders/orders.router.js";
import { outboxRouter } from "../modules/outbox/outbox.router.js";

const router = Router();

router.use(
  createRateLimiter({
    windowMs: 60 * 1000,
    limit: 100,
    message: "Too many API requests. Try again in one minute.",
  }),
);

router.use("/auth", authRouter);
router.use("/products", productsRouter);
router.use("/users", usersRouter);
router.use("/orders", ordersRouter);
router.use("/outbox-events", outboxRouter);

export { router };
