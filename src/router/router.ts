import { Router } from "express";

import { authRouter } from "../modules/auth/auth.router.js";
import { productsRouter } from "../modules/products/products.router.js";
import { usersRouter } from "../modules/users/users.router.js";

const router = Router();
router.use("/auth", authRouter);
router.use("/products", productsRouter);
router.use("/users", usersRouter);

export { router };
