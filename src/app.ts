import express from "express";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/request-logger.js";
import { productsRouter } from "./modules/products/products.router.js";

export const app = express();

app.use(requestLogger);
app.use(express.json());
app.use("/products", productsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use(errorHandler);

app.get("/", (_req, res) => {
  res.status(200).json({
    message: "Mini ERP API",
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "mini-erp",
    timestamp: new Date().toISOString(),
  });
});
