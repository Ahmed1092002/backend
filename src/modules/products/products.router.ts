import { randomUUID } from "node:crypto";
import { Router } from "express";

type Product = {
  id: string;
  name: string;
  price: number;
};

type CreateProductBody = {
  name?: unknown;
  price?: unknown;
};

const products: Product[] = [
  { id: "1", name: "Laptop", price: 1200 },
  { id: "2", name: "Keyboard", price: 80 },
];

export const productsRouter = Router();

productsRouter.get("/", (_req, res) => {
  res.status(200).json({ data: products });
});

productsRouter.get("/:id", (req, res) => {
  const product = products.find((item) => item.id === req.params.id);

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.status(200).json({ data: product });
});

productsRouter.post("/", (req, res) => {
  const { name, price } = req.body as CreateProductBody;

  if (typeof name !== "string" || name.trim() === "") {
    res.status(400).json({ error: "name must be a non-empty string" });
    return;
  }

  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
    res.status(400).json({ error: "price must be a non-negative number" });
    return;
  }

  const product: Product = {
    id: randomUUID(),
    name: name.trim(),
    price,
  };

  products.push(product);
  res.status(201).json({ data: product });
});
