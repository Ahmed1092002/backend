import { Router } from "express";
import { authenticate } from "../../middleware/authnticate.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireRole } from "../../middleware/requireRole.js";
import { uploadProductImage } from "../../middleware/upload-image.js";
import { validate } from "../../middleware/validate.js";
import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  uploadImage,
  updateProduct,
  adjustStock,
  getStockMovements,
  getStockMovementsByCursor,
} from "./products.controller.js";
import {
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
  adjustProductStockSchema,
  stockMovementsQuerySchema,
  stockMovementsCursorQuerySchema,
} from "./products.validation.js";

export const productsRouter = Router();

productsRouter.get(
  "/",
  validate(listProductsQuerySchema, "query"),
  asyncHandler(getProducts),
);
productsRouter.get(
  "/:id/stock-movements",
  authenticate,
  requireRole("ADMIN", "MANAGER"),
  validate(stockMovementsQuerySchema, "query"),
  asyncHandler(getStockMovements),
);
productsRouter.get(
  "/:id/stock-movements/cursor",
  authenticate,
  requireRole("ADMIN", "MANAGER"),
  validate(stockMovementsCursorQuerySchema, "query"),
  asyncHandler(getStockMovementsByCursor),
);
productsRouter.get("/:id", asyncHandler(getProductById));
productsRouter.post("/", validate(createProductSchema), asyncHandler(createProduct));
productsRouter.patch(
  "/:id",
  validate(updateProductSchema),
  asyncHandler(updateProduct),
);
productsRouter.post(
  "/:id/stock-adjustments",
  authenticate,
  requireRole("ADMIN", "MANAGER"),
  validate(adjustProductStockSchema),
  asyncHandler(adjustStock),
);
productsRouter.post(
  "/:id/image",
  authenticate,
  requireRole("ADMIN", "MANAGER"),
  uploadProductImage,
  asyncHandler(uploadImage),
);
productsRouter.delete("/:id", asyncHandler(deleteProduct));
