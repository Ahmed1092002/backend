import express from "express";

export const app = express();

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
