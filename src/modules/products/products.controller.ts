import type { RequestHandler } from "express";
import {
  createProduct as createProductInService,
  deleteProductById,
  findProductById,
  listProducts,
  updateProductById,
} from "./products.service.js";
import type {
  CreateProductInput,
  ListProductsQueryDto,
  UpdateProductInput,
} from "./products.validation.js";

export const getProducts: RequestHandler = async (_req, res) => {
  const { page, limit, search, minPrice, maxPrice } = res.locals
    .query as ListProductsQueryDto;
  const offset = (page - 1) * limit;
  const { products, total } = await listProducts({
    offset,
    limit,
    search,
    minPrice,
    maxPrice,
  });

  res.status(200).json({
    data: products,
    meta: { total, page, limit },
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
