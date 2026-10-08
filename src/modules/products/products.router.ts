import { Router } from "express";
import { validateBody } from "../../middleware/validate-body.js";
import {
  createProduct,
  getProductById,
  getProducts,
  updateProduct,
} from "./products.controller.js";
import {
  createProductSchema,
  updateProductSchema,
} from "./products.validation.js";

export const productsRouter = Router();

productsRouter.get("/", getProducts);
productsRouter.get("/:id", getProductById);
productsRouter.post("/", validateBody(createProductSchema), createProduct);
productsRouter.patch("/:id", validateBody(updateProductSchema), updateProduct);
