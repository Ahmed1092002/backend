import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler.js";
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

productsRouter.get(
  "/",
  validate(listProductsQuerySchema, "query"),
  asyncHandler(getProducts),
);
productsRouter.get("/:id", asyncHandler(getProductById));
productsRouter.post("/", validate(createProductSchema), asyncHandler(createProduct));
productsRouter.patch(
  "/:id",
  validate(updateProductSchema),
  asyncHandler(updateProduct),
);
productsRouter.delete("/:id", asyncHandler(deleteProduct));
