import { Router } from "express";
import { validate } from "../../middleware/validate.js";
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

productsRouter.get("/", validate(listProductsQuerySchema, "query"), getProducts);
productsRouter.get("/:id", getProductById);
productsRouter.post("/", validate(createProductSchema), createProduct);
productsRouter.patch("/:id", validate(updateProductSchema), updateProduct);
productsRouter.delete("/:id", deleteProduct);
