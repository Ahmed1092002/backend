import { Router } from "express";
import {
  createProduct,
  getProductById,
  getProducts,
} from "./products.controller.js";

export const productsRouter = Router();

productsRouter.get("/", getProducts);
productsRouter.get("/:id", getProductById);
productsRouter.post("/", createProduct);
