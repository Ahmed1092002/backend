import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/request-logger.js";
import { uploadsDirectory } from "./middleware/upload-image.js";
import { router } from "./router/router.js";

export const app = express();

app.use(requestLogger);
app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(uploadsDirectory));

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "mini-erp",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", router);
app.get("/", (_req, res) => {
  res.status(200).json({
    message: "Mini ERP API",
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use(errorHandler);
