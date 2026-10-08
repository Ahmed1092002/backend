import { Router } from "express";
import { validateBody } from "../../middleware/validate-body.js";
import { validateQuery } from "../../middleware/validate-query.js";
import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  updateProduct,
} from "./products.controller.js";
import {
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from "./products.validation.js";

export const productsRouter = Router();

productsRouter.get("/", validateQuery(listProductsQuerySchema), getProducts);
productsRouter.get("/:id", getProductById);
productsRouter.post("/", validateBody(createProductSchema), createProduct);
productsRouter.patch("/:id", validateBody(updateProductSchema), updateProduct);
productsRouter.delete("/:id", deleteProduct);
