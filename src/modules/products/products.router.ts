import { Router } from "express";

const products = [
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
