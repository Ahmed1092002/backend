import type { RequestHandler } from "express";
import {
  createProduct as createProductInService,
  deleteProductById,
  findProductById,
  listProducts,
  setProductImage,
  updateProductById,
  adjustProductStock,
  listProductStockMovements,
} from "./products.service.js";
import type {
  CreateProductInput,
  ListProductsQueryDto,
  UpdateProductInput,
  AdjustProductStockInput,
  StockMovementsQueryDto,
} from "./products.validation.js";

export const getProducts: RequestHandler = async (_req, res) => {
  const { page, limit, search, minPrice, maxPrice, sortBy, sortOrder } = res.locals
    .query as ListProductsQueryDto;
  const offset = (page - 1) * limit;
  const { products, total } = await listProducts({
    offset,
    limit,
    sortBy,
    sortOrder,
    search,
    minPrice,
    maxPrice,
  });

  res.status(200).json({
    data: products,
    meta: { total, page, limit, sortBy, sortOrder },
  });
};

export const getProductById: RequestHandler = async (req, res) => {
  const { id } = req.params;

  if (typeof id !== "string") {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const product = await findProductById(id);

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.status(200).json({ data: product });
};

export const createProduct: RequestHandler = async (req, res) => {
  const product = await createProductInService(req.body as CreateProductInput);
  res.status(201).json({ data: product });
};

export const updateProduct: RequestHandler = async (req, res) => {
  const { id } = req.params;

  if (typeof id !== "string") {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const product = await updateProductById(id, req.body as UpdateProductInput);

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.status(200).json({ data: product });
};

export const deleteProduct: RequestHandler = async (req, res) => {
  const { id } = req.params;

  if (typeof id !== "string" || !(await deleteProductById(id))) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.status(204).send();
};

export const uploadImage: RequestHandler = async (req, res) => {
  const { id } = req.params;

  if (typeof id !== "string") {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "Image file is required" });
    return;
  }

  const product = await setProductImage(id, `/uploads/${req.file.filename}`);

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.status(200).json({ data: product });
};

export const adjustStock: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const user = res.locals.user as { id: string } | undefined;

  if (typeof id !== "string") {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const product = await adjustProductStock(
    id,
    req.body as AdjustProductStockInput,
    user!.id,
  );

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.status(200).json({ data: product });
};

export const getStockMovements: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { page, limit } = res.locals.query as StockMovementsQueryDto;

  if (typeof id !== "string") {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const result = await listProductStockMovements(id, {
    offset: (page - 1) * limit,
    limit,
  });

  if (!result) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.status(200).json({
    data: result.movements,
    meta: { total: result.total, page, limit },
  });
};
