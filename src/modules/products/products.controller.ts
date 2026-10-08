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
  UpdateProductInput,
} from "./products.validation.js";

export const getProducts: RequestHandler = (_req, res) => {
  res.status(200).json({ data: listProducts() });
};

export const getProductById: RequestHandler = (req, res) => {
  const { id } = req.params;

  if (typeof id !== "string") {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const product = findProductById(id);

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.status(200).json({ data: product });
};

export const createProduct: RequestHandler = (req, res) => {
  const product = createProductInService(req.body as CreateProductInput);
  res.status(201).json({ data: product });
};

export const updateProduct: RequestHandler = (req, res) => {
  const { id } = req.params;

  if (typeof id !== "string") {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const product = updateProductById(id, req.body as UpdateProductInput);

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.status(200).json({ data: product });
};

export const deleteProduct: RequestHandler = (req, res) => {
  const { id } = req.params;

  if (typeof id !== "string" || !deleteProductById(id)) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.status(204).send();
};
