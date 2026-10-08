import type { RequestHandler } from "express";
import {
  createProduct as createProductInService,
  findProductById,
  listProducts,
} from "./products.service.js";

type CreateProductBody = {
  name?: unknown;
  price?: unknown;
};

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
  const { name, price } = req.body as CreateProductBody;

  if (typeof name !== "string" || name.trim() === "") {
    res.status(400).json({ error: "name must be a non-empty string" });
    return;
  }

  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
    res.status(400).json({ error: "price must be a non-negative number" });
    return;
  }

  const product = createProductInService({ name: name.trim(), price });
  res.status(201).json({ data: product });
};
