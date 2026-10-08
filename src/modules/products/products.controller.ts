import type { RequestHandler } from "express";
import {
  createProduct as createProductInService,
  findProductById,
  listProducts,
} from "./products.service.js";
import type { CreateProductInput } from "./products.validation.js";

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
