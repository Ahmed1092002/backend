import type { ErrorRequestHandler } from "express";
import multer from "multer";
import { AppError } from "../errors/app-error.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Image must be 5 MB or smaller"
        : "Invalid image upload";
    res.status(400).json({ error: message });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ error: "Request body must be valid JSON" });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Internal server error" });
};
